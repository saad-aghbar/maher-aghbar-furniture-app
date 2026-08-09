import {
  PrismaClient,
  Priority,
  SalesOrderStatus,
  ProductionOrderStatus,
  StageInstanceStatus,
  TaskStatus,
  RequestStatus,
  RequestSource,
  QuotationStatus,
  ContractStatus,
  InvoiceStatus,
  PaymentMethod,
  DeliveryStatus,
  QualityResult,
  ChecklistItemResult,
  ReturnReason,
  BlockerCategory,
} from '@prisma/client';
import { buildStageTaskInstructions } from '../stage-task-instructions';
import {
  VAT,
  addDays,
  createRng,
  daysAgo,
  lineTotals,
  money,
  monthsAgo,
  seasonalityWeight,
  type Rng,
} from './util';
import type { DealerRef } from './people';
import type { ProductRef } from './catalog';

type StageDef = { id: string; code: string; nameEn: string; sortOrder: number };

function progressForAge(daysAgoCreated: number, rng: Rng): {
  soStatus: SalesOrderStatus;
  progress: number | null;
  priority: Priority;
} {
  // Older than ~45 days → mostly delivered/completed
  if (daysAgoCreated > 120) {
    return {
      soStatus: rng.chance(0.85) ? SalesOrderStatus.COMPLETED : SalesOrderStatus.DELIVERED,
      progress: 100,
      priority: Priority.NORMAL,
    };
  }
  if (daysAgoCreated > 60) {
    if (rng.chance(0.75)) {
      return { soStatus: SalesOrderStatus.DELIVERED, progress: 100, priority: Priority.NORMAL };
    }
    return {
      soStatus: SalesOrderStatus.IN_PRODUCTION,
      progress: rng.int(55, 90),
      priority: rng.chance(0.2) ? Priority.HIGH : Priority.NORMAL,
    };
  }
  if (daysAgoCreated > 21) {
    const roll = rng.next();
    if (roll < 0.15) return { soStatus: SalesOrderStatus.READY_FOR_DELIVERY, progress: rng.int(92, 100), priority: Priority.HIGH };
    if (roll < 0.55) return { soStatus: SalesOrderStatus.IN_PRODUCTION, progress: rng.int(20, 80), priority: Priority.NORMAL };
    if (roll < 0.7) return { soStatus: SalesOrderStatus.READY_FOR_PRODUCTION, progress: rng.int(3, 12), priority: Priority.NORMAL };
    if (roll < 0.82) return { soStatus: SalesOrderStatus.WAITING_FOR_MATERIALS, progress: rng.int(5, 15), priority: Priority.HIGH };
    if (roll < 0.9) return { soStatus: SalesOrderStatus.ON_HOLD, progress: rng.int(10, 40), priority: Priority.NORMAL };
    return { soStatus: SalesOrderStatus.DELIVERED, progress: 100, priority: Priority.NORMAL };
  }
  // Last 3 weeks — active pipeline mix
  const roll = rng.next();
  if (roll < 0.12) return { soStatus: SalesOrderStatus.DRAFT, progress: null, priority: Priority.NORMAL };
  if (roll < 0.22) return { soStatus: SalesOrderStatus.CONFIRMED, progress: null, priority: Priority.HIGH };
  if (roll < 0.3) return { soStatus: SalesOrderStatus.WAITING_FOR_PAYMENT, progress: null, priority: Priority.NORMAL };
  if (roll < 0.4) return { soStatus: SalesOrderStatus.READY_FOR_PRODUCTION, progress: rng.int(2, 10), priority: Priority.NORMAL };
  if (roll < 0.75) return { soStatus: SalesOrderStatus.IN_PRODUCTION, progress: rng.int(15, 70), priority: rng.chance(0.25) ? Priority.URGENT : Priority.NORMAL };
  if (roll < 0.88) return { soStatus: SalesOrderStatus.READY_FOR_DELIVERY, progress: rng.int(90, 100), priority: Priority.HIGH };
  if (roll < 0.94) return { soStatus: SalesOrderStatus.WAITING_FOR_MATERIALS, progress: rng.int(5, 20), priority: Priority.URGENT };
  return { soStatus: SalesOrderStatus.ON_HOLD, progress: rng.int(8, 30), priority: Priority.NORMAL };
}

function productionStatusFor(progress: number): ProductionOrderStatus {
  if (progress >= 100) return ProductionOrderStatus.COMPLETED;
  if (progress >= 90) return ProductionOrderStatus.READY_FOR_DELIVERY;
  if (progress >= 78) return ProductionOrderStatus.QUALITY_CHECK;
  if (progress > 0) return ProductionOrderStatus.IN_PROGRESS;
  return ProductionOrderStatus.PLANNED;
}

function stageStatuses(progress: number, stageCount: number): StageInstanceStatus[] {
  // Evenly map progress across stages
  const activeIdx = Math.min(
    stageCount - 1,
    Math.floor((progress / 100) * stageCount),
  );
  return Array.from({ length: stageCount }, (_, i) => {
    if (progress >= 100) return StageInstanceStatus.COMPLETED;
    if (i < activeIdx) return StageInstanceStatus.COMPLETED;
    if (i === activeIdx) {
      if (progress === 0) return StageInstanceStatus.READY;
      return StageInstanceStatus.IN_PROGRESS;
    }
    if (i === activeIdx + 1 && progress > 0) return StageInstanceStatus.READY;
    return StageInstanceStatus.PENDING;
  });
}

function currentStageCode(stages: StageDef[], progress: number): string {
  const statuses = stageStatuses(progress, stages.length);
  const idx = statuses.findIndex(
    (s) => s === StageInstanceStatus.IN_PROGRESS || s === StageInstanceStatus.READY,
  );
  if (idx >= 0) return stages[idx]!.code;
  return stages[stages.length - 1]!.code;
}

function pickAssignee(
  stageAssignees: Record<string, string[]>,
  code: string,
  rng: Rng,
): string | undefined {
  const pool = stageAssignees[code] ?? [];
  if (!pool.length) return undefined;
  return rng.pick(pool);
}

export async function seedSalesTimeline(
  prisma: PrismaClient,
  opts: {
    adminId: string;
    dealers: DealerRef[];
    products: ProductRef[];
    stageAssignees: Record<string, string[]>;
    inspectorId?: string;
    driverId?: string;
  },
) {
  const rng = createRng();
  const stageDefs = (
    await prisma.productionStageDefinition.findMany({ orderBy: { sortOrder: 'asc' } })
  ) as StageDef[];

  let soSeq = 1000;
  let poSeq = 2000;
  let tskSeq = 5000;
  let invSeq = 3000;
  let paySeq = 4000;
  let delSeq = 6000;
  let rfqSeq = 7000;
  let qSeq = 8000;
  let ctrSeq = 9000;
  let qiSeq = 10000;
  let retSeq = 11000;
  let blkSeq = 1;

  let orderCount = 0;
  let productionCount = 0;
  let deliveredCount = 0;

  // ~200 orders across 8 months with seasonality
  for (let mo = 7; mo >= 0; mo -= 1) {
    const weight = seasonalityWeight(mo);
    const baseCount = Math.round(22 * weight);
    for (let i = 0; i < baseCount; i += 1) {
      const dayInMonth = rng.int(1, 26);
      const createdAt = monthsAgo(mo, dayInMonth);
      const daysAgoCreated = Math.max(
        0,
        Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)),
      );
      const dealer = rng.pick(opts.dealers);
      const product = rng.pick(opts.products);
      const qty = rng.int(1, product.categoryCode === 'CHAIR' ? 8 : 4);
      const unit = Number(product.basePrice) * (0.95 + rng.next() * 0.15);
      const totals = lineTotals(qty, unit);
      const { soStatus, progress, priority } = progressForAge(daysAgoCreated, rng);

      // Late flag: delivery in past but still in production
      let deliveryOffset = rng.int(10, 35);
      if (
        soStatus === SalesOrderStatus.IN_PRODUCTION &&
        daysAgoCreated > 25 &&
        rng.chance(0.25)
      ) {
        deliveryOffset = -rng.int(2, 14);
      }
      const requiredDelivery = addDays(createdAt, deliveryOffset);

      const soNumber = `SO-${String(soSeq++).padStart(5, '0')}`;
      const projectName = `${dealer.nameEn.split(' ')[0]} · ${product.nameEn}`;

      // RFQ + Quotation for confirmed+ paths
      let quotationId: string | undefined;
      if (soStatus !== SalesOrderStatus.DRAFT || rng.chance(0.4)) {
        const rfq = await prisma.requestForQuotation.create({
          data: {
            number: `RFQ-${String(rfqSeq++).padStart(5, '0')}`,
            customerId: dealer.id,
            source: rng.chance(0.55) ? RequestSource.PORTAL : RequestSource.SALES,
            status: RequestStatus.QUOTED,
            priority,
            projectName,
            requiredDeliveryDate: requiredDelivery,
            externalOrderNumber: `PO-${dealer.username.toUpperCase()}-${rng.int(100, 999)}`,
            requestDate: addDays(createdAt, -3),
            submittedAt: addDays(createdAt, -2),
            createdById: opts.adminId,
            assignedSalesId: opts.adminId,
            items: {
              create: [
                {
                  productId: product.id,
                  productName: product.nameEn,
                  quantity: money(qty),
                  fabricType: 'Velvet',
                  fabricCode: 'FAB-VEL-SAND',
                  woodType: 'Beech',
                  sortOrder: 0,
                },
              ],
            },
          },
        });

        const quote = await prisma.quotation.create({
          data: {
            number: `Q-${String(qSeq++).padStart(5, '0')}`,
            version: 1,
            customerId: dealer.id,
            requestId: rfq.id,
            status: QuotationStatus.ACCEPTED,
            issueDate: addDays(createdAt, -1),
            expirationDate: addDays(createdAt, 21),
            salesRepId: opts.adminId,
            createdById: opts.adminId,
            sentAt: addDays(createdAt, -1),
            acceptedAt: createdAt,
            subtotal: money(totals.subtotal),
            taxTotal: money(totals.taxAmount),
            total: money(totals.lineTotal),
            paymentTerms: '30% deposit, balance on delivery',
            lines: {
                create: [
                  {
                    productId: product.id,
                    description: product.nameEn,
                    quantity: money(qty),
                    unitPrice: money(unit),
                    taxRate: VAT,
                    subtotal: money(totals.subtotal),
                    taxAmount: money(totals.taxAmount),
                    lineTotal: money(totals.lineTotal),
                    sortOrder: 0,
                  },
                ],
              },
            },
          });
          quotationId = quote.id;
      }

      const mfg = Number(product.manufacturingCost ?? unit * 0.45) * qty;
      const so = await prisma.salesOrder.create({
        data: {
          number: soNumber,
          customerId: dealer.id,
          quotationId,
          orderDate: createdAt,
          requiredDeliveryDate: requiredDelivery,
          status: soStatus,
          priority,
          projectName,
          externalOrderNumber: `EXT-${rng.int(1000, 9999)}`,
          deliveryAddress: `${dealer.nameEn}, Jordan`,
          assignedEmployeeId: opts.adminId,
          notes: rng.chance(0.3) ? 'Match approved fabric sample' : null,
          subtotal: money(totals.subtotal),
          taxTotal: money(totals.taxAmount),
          total: money(totals.lineTotal),
          manufacturingCost: money(mfg),
          costBreakdown: {
            fabricCost: mfg * 0.35,
            woodCost: mfg * 0.4,
            foamCost: mfg * 0.15,
            accessoriesCost: mfg * 0.1,
          },
          depositRequired: money(totals.lineTotal * 0.3),
          createdById: opts.adminId,
          createdAt,
          updatedAt: createdAt,
          lines: {
            create: [
              {
                productId: product.id,
                description: product.nameEn,
                quantity: money(qty),
                unitPrice: money(unit),
                taxRate: VAT,
                lineTotal: money(totals.lineTotal),
                productionRequired: true,
                deliveryRequired: true,
                sortOrder: 0,
              },
            ],
          },
        },
        include: { lines: true },
      });
      orderCount += 1;

      if (
        [
          SalesOrderStatus.DELIVERED,
          SalesOrderStatus.COMPLETED,
          SalesOrderStatus.IN_PRODUCTION,
          SalesOrderStatus.READY_FOR_DELIVERY,
        ].includes(soStatus) &&
        rng.chance(0.35)
      ) {
        await prisma.contract.create({
          data: {
            number: `CTR-${String(ctrSeq++).padStart(5, '0')}`,
            customerId: dealer.id,
            salesOrderId: so.id,
            startDate: createdAt,
            endDate: addDays(createdAt, 120),
            contractValue: money(totals.lineTotal),
            status: ContractStatus.ACTIVE,
            warranty: '24 months manufacturing warranty',
            paymentSchedule: '30% deposit, balance on delivery',
            terms: 'Standard commercial supply',
          },
        });
      }

      if (progress != null) {
        const statuses = stageStatuses(progress, stageDefs.length);
        const poStatus = productionStatusFor(progress);
        const po = await prisma.productionOrder.create({
          data: {
            number: `PO-${String(poSeq++).padStart(5, '0')}`,
            salesOrderId: so.id,
            salesOrderLineId: so.lines[0]!.id,
            customerId: dealer.id,
            productId: product.id,
            productDescription: product.nameEn,
            quantity: money(qty),
            status: poStatus,
            priority,
            progressPercent: progress,
            currentStageCode: currentStageCode(stageDefs, progress),
            requiredDeliveryDate: requiredDelivery,
            plannedStartDate: addDays(createdAt, 1),
            actualStartDate: progress > 0 ? addDays(createdAt, 2) : null,
            actualCompletionDate: progress >= 100 ? addDays(createdAt, Math.min(daysAgoCreated - 2, 40)) : null,
            createdById: opts.adminId,
            createdAt: addDays(createdAt, 1),
            stages: {
              create: stageDefs.map((stage, idx) => {
                const st = statuses[idx]!;
                return {
                  stageDefinitionId: stage.id,
                  status: st,
                  progressPercent:
                    st === StageInstanceStatus.COMPLETED
                      ? 100
                      : st === StageInstanceStatus.IN_PROGRESS
                        ? rng.int(25, 75)
                        : 0,
                  actualStart:
                    st === StageInstanceStatus.COMPLETED || st === StageInstanceStatus.IN_PROGRESS
                      ? addDays(createdAt, 2 + idx)
                      : null,
                  actualEnd: st === StageInstanceStatus.COMPLETED ? addDays(createdAt, 3 + idx) : null,
                  plannedEnd: addDays(createdAt, 5 + idx * 3),
                };
              }),
            },
          },
          include: { stages: true },
        });
        productionCount += 1;

        for (const stageInstance of po.stages) {
          const stageDef = stageDefs.find((s) => s.id === stageInstance.stageDefinitionId)!;
          const taskStatus: TaskStatus =
            stageInstance.status === StageInstanceStatus.COMPLETED
              ? TaskStatus.COMPLETED
              : stageInstance.status === StageInstanceStatus.IN_PROGRESS
                ? TaskStatus.IN_PROGRESS
                : stageInstance.status === StageInstanceStatus.READY
                  ? TaskStatus.READY
                  : stageInstance.status === StageInstanceStatus.BLOCKED
                    ? TaskStatus.BLOCKED
                    : TaskStatus.NOT_STARTED;

          const task = await prisma.productionTask.create({
            data: {
              number: `TSK-${String(tskSeq++).padStart(6, '0')}`,
              productionOrderId: po.id,
              stageDefinitionId: stageDef.id,
              stageInstanceId: stageInstance.id,
              name: stageDef.nameEn,
              description: buildStageTaskInstructions({
                stageCode: stageDef.code,
                stageNameEn: stageDef.nameEn,
                productDescription: product.nameEn,
                quantity: qty,
                specifications: 'Fabric FAB-VEL-SAND · Color CLR-WAL',
              }),
              status: taskStatus,
              progressPercent: stageInstance.progressPercent,
              assignedEmployeeId: pickAssignee(opts.stageAssignees, stageDef.code, rng),
              priority,
              actualStart: stageInstance.actualStart,
              actualCompletion: stageInstance.actualEnd,
            },
          });

          if (taskStatus === TaskStatus.COMPLETED || taskStatus === TaskStatus.IN_PROGRESS) {
            await prisma.taskTimeEntry.create({
              data: {
                taskId: task.id,
                userId: task.assignedEmployeeId ?? opts.adminId,
                startedAt: stageInstance.actualStart ?? addDays(createdAt, 2),
                endedAt:
                  taskStatus === TaskStatus.COMPLETED
                    ? stageInstance.actualEnd ?? addDays(createdAt, 3)
                    : null,
                minutes:
                  taskStatus === TaskStatus.COMPLETED ? rng.int(90, 360) : null,
              },
            });
          }

          // Occasional open blocker on in-progress mid stages
          if (
            taskStatus === TaskStatus.IN_PROGRESS &&
            stageDef.code === 'UPHOLSTERY' &&
            rng.chance(0.12)
          ) {
            await prisma.taskBlocker.create({
              data: {
                taskId: task.id,
                category: BlockerCategory.MATERIAL_MISSING,
                reason: 'Velvet roll batch delayed from mill',
                reportedById: task.assignedEmployeeId ?? opts.adminId,
              },
            });
            await prisma.productionTask.update({
              where: { id: task.id },
              data: { status: TaskStatus.BLOCKED },
            });
            blkSeq += 1;
          }
        }

        if (progress >= 78) {
          const insp = await prisma.qualityInspection.create({
            data: {
              number: `QI-${String(qiSeq++).padStart(5, '0')}`,
              productionOrderId: po.id,
              stageCode: 'INSPECTION',
              inspectorId: opts.inspectorId ?? opts.adminId,
              inspectedAt: addDays(createdAt, 20),
              result: progress >= 90 ? QualityResult.PASSED : QualityResult.PASSED_WITH_NOTES,
              notes: progress >= 90 ? null : 'Minor seam touch-up noted',
              items: {
                create: [
                  { checklistCode: 'DIM', label: 'Dimensions vs drawing', result: ChecklistItemResult.PASS },
                  { checklistCode: 'FAB', label: 'Fabric match', result: ChecklistItemResult.PASS },
                  { checklistCode: 'FIN', label: 'Finish quality', result: ChecklistItemResult.PASS },
                  {
                    checklistCode: 'HW',
                    label: 'Hardware fit',
                    result: progress >= 90 ? ChecklistItemResult.PASS : ChecklistItemResult.FAIL,
                    note: progress >= 90 ? null : 'Tighten leg bolts',
                  },
                ],
              },
            },
          });
          if (progress < 90 && rng.chance(0.4)) {
            await prisma.qualityDefect.create({
              data: {
                inspectionId: insp.id,
                description: 'Loose leg bolt on left rear',
                stageCode: 'ASSEMBLY',
                severity: 'LOW',
                correctiveAction: 'Retorque before pack',
              },
            });
            await prisma.reworkRequest.create({
              data: {
                number: `RWK-${String(qiSeq).padStart(5, '0')}`,
                productionOrderId: po.id,
                inspectionId: insp.id,
                description: 'Retorque hardware after QC note',
                assignedToId: pickAssignee(opts.stageAssignees, 'ASSEMBLY', rng),
                status: progress >= 95 ? 'COMPLETED' : 'OPEN',
                completedAt: progress >= 95 ? addDays(createdAt, 21) : null,
              },
            });
          }
        }
      }

      // Finance for issued work
      if (
        [
          SalesOrderStatus.WAITING_FOR_PAYMENT,
          SalesOrderStatus.IN_PRODUCTION,
          SalesOrderStatus.READY_FOR_DELIVERY,
          SalesOrderStatus.DELIVERED,
          SalesOrderStatus.COMPLETED,
          SalesOrderStatus.READY_FOR_PRODUCTION,
        ].includes(soStatus)
      ) {
        let invStatus = InvoiceStatus.ISSUED;
        let paid = 0;
        if (soStatus === SalesOrderStatus.WAITING_FOR_PAYMENT) {
          invStatus = InvoiceStatus.ISSUED;
          paid = 0;
        } else if (soStatus === SalesOrderStatus.COMPLETED || (soStatus === SalesOrderStatus.DELIVERED && rng.chance(0.7))) {
          invStatus = InvoiceStatus.PAID;
          paid = totals.lineTotal;
        } else if (soStatus === SalesOrderStatus.DELIVERED) {
          invStatus = InvoiceStatus.PARTIALLY_PAID;
          paid = totals.lineTotal * 0.3;
        } else if (daysAgoCreated > 40 && soStatus === SalesOrderStatus.IN_PRODUCTION && rng.chance(0.2)) {
          invStatus = InvoiceStatus.OVERDUE;
          paid = totals.lineTotal * 0.3;
        } else {
          invStatus = InvoiceStatus.PARTIALLY_PAID;
          paid = totals.lineTotal * 0.3;
        }
        const outstanding = totals.lineTotal - paid;
        const inv = await prisma.invoice.create({
          data: {
            number: `INV-${String(invSeq++).padStart(5, '0')}`,
            customerId: dealer.id,
            salesOrderId: so.id,
            status: invStatus,
            invoiceDate: createdAt,
            dueDate: addDays(createdAt, 30),
            subtotal: money(totals.subtotal),
            taxTotal: money(totals.taxAmount),
            total: money(totals.lineTotal),
            paidAmount: money(paid),
            outstandingAmount: money(outstanding),
            createdById: opts.adminId,
            lines: {
              create: [
                {
                  description: product.nameEn,
                  quantity: money(qty),
                  unitPrice: money(unit),
                  taxRate: VAT,
                  lineTotal: money(totals.lineTotal),
                },
              ],
            },
          },
        });

        if (paid > 0) {
          await prisma.payment.create({
            data: {
              number: `PAY-${String(paySeq++).padStart(5, '0')}`,
              customerId: dealer.id,
              invoiceId: inv.id,
              amount: money(paid),
              method: PaymentMethod.BANK_TRANSFER,
              paymentDate: addDays(createdAt, 2),
              referenceNumber: `TRF-${rng.int(10000, 99999)}`,
              createdById: opts.adminId,
            },
          });
        }
        if (invStatus === InvoiceStatus.PAID && paid < totals.lineTotal) {
          // no-op
        } else if (invStatus === InvoiceStatus.PAID && outstanding === 0 && paid === totals.lineTotal * 0.3) {
          // ensure full pay recorded — already set paid = total
        }

        await prisma.statementEntry.create({
          data: {
            customerId: dealer.id,
            entryDate: createdAt,
            type: 'INVOICE',
            reference: inv.number,
            debit: money(totals.lineTotal),
            credit: money(0),
            balance: money(outstanding),
          },
        });
        if (paid > 0) {
          await prisma.statementEntry.create({
            data: {
              customerId: dealer.id,
              entryDate: addDays(createdAt, 2),
              type: 'PAYMENT',
              reference: `PAY against ${inv.number}`,
              debit: money(0),
              credit: money(paid),
              balance: money(outstanding),
            },
          });
        }
      }

      if (
        soStatus === SalesOrderStatus.DELIVERED ||
        soStatus === SalesOrderStatus.COMPLETED ||
        soStatus === SalesOrderStatus.READY_FOR_DELIVERY
      ) {
        const delivered =
          soStatus === SalesOrderStatus.DELIVERED || soStatus === SalesOrderStatus.COMPLETED;
        await prisma.delivery.create({
          data: {
            number: `DEL-${String(delSeq++).padStart(5, '0')}`,
            salesOrderId: so.id,
            customerId: dealer.id,
            deliveryAddress: `${dealer.nameEn}, Jordan`,
            deliveryDate: delivered ? addDays(createdAt, Math.min(daysAgoCreated - 1, deliveryOffset)) : requiredDelivery,
            deliveryWindow: '09:00–14:00',
            driverId: opts.driverId,
            vehicle: 'Truck JO-41',
            status: delivered ? DeliveryStatus.DELIVERED : DeliveryStatus.PLANNED,
            recipientName: delivered ? 'Receiving desk' : null,
            items: {
              create: [
                {
                  description: product.nameEn,
                  quantity: money(qty),
                },
              ],
            },
          },
        });
        if (delivered) deliveredCount += 1;

        if (delivered && rng.chance(0.06)) {
          await prisma.returnRequest.create({
            data: {
              number: `RET-${String(retSeq++).padStart(5, '0')}`,
              customerId: dealer.id,
              salesOrderId: so.id,
              productDesc: product.nameEn,
              quantity: money(1),
              reason: rng.chance(0.5)
                ? ReturnReason.DELIVERY_DAMAGE
                : ReturnReason.MANUFACTURING_DEFECT,
              description: 'Customer reported edge scuff on delivery',
              approvalStatus: rng.pick(['PENDING', 'APPROVED', 'REJECTED']),
            },
          });
        }
      }
    }
  }

  // Live RFQs / quotes not yet converted (~30)
  for (let i = 0; i < 30; i += 1) {
    const dealer = rng.pick(opts.dealers);
    const product = rng.pick(opts.products);
    const status = rng.pick([
      RequestStatus.DRAFT,
      RequestStatus.SUBMITTED,
      RequestStatus.UNDER_REVIEW,
      RequestStatus.READY_FOR_QUOTATION,
      RequestStatus.NEEDS_INFORMATION,
    ]);
    const rfq = await prisma.requestForQuotation.create({
      data: {
        number: `RFQ-LIVE-${String(i + 1).padStart(3, '0')}`,
        customerId: dealer.id,
        source: RequestSource.PORTAL,
        status,
        priority: rng.chance(0.3) ? Priority.HIGH : Priority.NORMAL,
        projectName: `Open inquiry ${i + 1}`,
        requiredDeliveryDate: daysAgo(-rng.int(14, 45)),
        requestDate: daysAgo(rng.int(1, 20)),
        submittedAt: status === RequestStatus.DRAFT ? null : daysAgo(rng.int(1, 18)),
        createdById: opts.adminId,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.nameEn,
              quantity: money(rng.int(1, 4)),
              sortOrder: 0,
            },
          ],
        },
      },
    });
    if (status === RequestStatus.READY_FOR_QUOTATION || rng.chance(0.35)) {
      const qty = 2;
      const unit = Number(product.basePrice);
      const totals = lineTotals(qty, unit);
      await prisma.quotation.create({
        data: {
          number: `Q-LIVE-${String(i + 1).padStart(3, '0')}`,
          version: 1,
          customerId: dealer.id,
          requestId: rfq.id,
          status: rng.pick([QuotationStatus.DRAFT, QuotationStatus.SENT, QuotationStatus.VIEWED]),
          issueDate: daysAgo(rng.int(0, 10)),
          expirationDate: daysAgo(-14),
          salesRepId: opts.adminId,
          createdById: opts.adminId,
          subtotal: money(totals.subtotal),
          taxTotal: money(totals.taxAmount),
          total: money(totals.lineTotal),
          lines: {
            create: [
              {
                productId: product.id,
                description: product.nameEn,
                quantity: money(qty),
                unitPrice: money(unit),
                taxRate: VAT,
                subtotal: money(totals.subtotal),
                taxAmount: money(totals.taxAmount),
                lineTotal: money(totals.lineTotal),
              },
            ],
          },
        },
      });
    }
  }

  return { orderCount, productionCount, deliveredCount, blockers: blkSeq - 1 };
}
