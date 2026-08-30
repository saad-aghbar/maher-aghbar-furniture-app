import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ManufacturingComplexity,
  Prisma,
  SalesOrderLineSetupStatus,
  SalesOrderMaterialRequirementSource,
  SalesOrderProductionSetupStatus,
  SalesOrderStatus,
} from '@maher/database';
import type { AuthUser, OrderLineSpecSnapshot, OrderMeasurement } from '@maher/types';
import {
  buildCatalogDiff,
  normalizeOrderMeasurements,
} from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import type { BomDefaults } from '../../common/helpers/order-costing.util';
import {
  buildMaterialCostMap,
  type MaterialCostMap,
} from '../../common/helpers/order-costing.util';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryService } from '../inventory/inventory.service';
import { WorkflowSnapshotService } from './workflow/workflow-snapshot.service';
import type {
  MaterialRequirementInputDto,
  PatchLineSetupDto,
  PutLineMaterialsDto,
} from './order-production-setup.dto';
import { PIECE2_EXPECTED_MATERIAL_COSTING_HOOK } from './order-production-setup.costing-hook';

type Tx = Prisma.TransactionClient;

type Dims = {
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
};

export type SetupValidationIssue = {
  code: string;
  message: string;
  lineId?: string;
  section?: 'spec' | 'materials' | 'workflow' | 'packaging' | 'review';
};

@Injectable()
export class OrderProductionSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly workflowSnapshots: WorkflowSnapshotService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
  ) {}

  private assertStaff(user?: AuthUser) {
    if (user?.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Dealers cannot access production setup.',
      });
    }
  }

  private asSpec(value: unknown): OrderLineSpecSnapshot | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as OrderLineSpecSnapshot;
  }

  private num(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private fabricLabel(spec: OrderLineSpecSnapshot | null): string | null {
    if (!spec?.fabric) return null;
    const parts = [spec.fabric.type, spec.fabric.code, spec.fabric.color]
      .map((x) => (x != null ? String(x).trim() : ''))
      .filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }

  private dimsEqual(a: Dims | null | undefined, b: Dims | null | undefined): boolean {
    const keys: (keyof Dims)[] = ['width', 'height', 'depth', 'seatHeight'];
    for (const k of keys) {
      const av = this.num(a?.[k]);
      const bv = this.num(b?.[k]);
      if (av == null && bv == null) continue;
      if (av == null || bv == null) return false;
      if (Math.abs(av - bv) > 0.001) return false;
    }
    return true;
  }

  private buildChanges(
    complexity: ManufacturingComplexity | null | undefined,
    catalog: Dims | null,
    order: Dims | null,
    fabricLabel: string | null,
    measurements?: OrderMeasurement[] | null,
    opts?: { catalogFabricLabel?: string | null; skipCompare?: boolean },
  ) {
    return buildCatalogDiff({
      complexity,
      catalogDimensions: catalog,
      orderDimensions: order,
      catalogFabricLabel: opts?.catalogFabricLabel ?? null,
      orderFabricLabel: fabricLabel,
      measurements: measurements ?? null,
      skipCompare: opts?.skipCompare,
    });
  }

  /**
   * Lazy-create setup + line rows seeded from catalog / orderSpec. Never mutates Product.
   */
  async ensureSetup(salesOrderId: string, user?: AuthUser): Promise<Record<string, unknown>> {
    this.assertStaff(user);
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        lines: {
          where: { productionRequired: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
                width: true,
                height: true,
                depth: true,
                seatHeight: true,
                bomDefaults: true,
                imageUrl: true,
                workflowConfiguration: { select: { workflowId: true } },
                stageMaterialInputs: {
                  include: {
                    inventoryItem: {
                      select: {
                        id: true,
                        sku: true,
                        nameEn: true,
                        nameAr: true,
                        category: true,
                        unit: true,
                      },
                    },
                  },
                },
                stageInventoryOutputs: {
                  select: {
                    expectedPieceCount: true,
                    pieceLabels: true,
                    inventoryTracking: true,
                  },
                },
              },
            },
          },
        },
        documents: { select: { id: true }, take: 50 },
        productionSetup: true,
        productionOrders: { select: { id: true }, take: 1 },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });
    }

    if (order.productionSetup) {
      return this.getSetup(salesOrderId, user);
    }

    if (order.productionOrders.length > 0) {
      // Legacy confirmed SO without setup — synthesize RELEASED shell for read-only views
      const setup = await this.prisma.salesOrderProductionSetup.create({
        data: {
          salesOrderId,
          status: SalesOrderProductionSetupStatus.RELEASED,
          releasedAt: new Date(),
          lines: {
            create: order.lines.map((line) => this.seedLineCreateData(line, order.documents.map((d) => d.id), true)),
          },
        },
      });
      void setup;
      return this.getSetup(salesOrderId, user);
    }

    await this.prisma.salesOrderProductionSetup.create({
      data: {
        salesOrderId,
        status: SalesOrderProductionSetupStatus.SETUP_REQUIRED,
        lines: {
          create: order.lines.map((line) =>
            this.seedLineCreateData(
              line,
              order.documents.map((d) => d.id),
              false,
            ),
          ),
        },
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: user?.id,
        action: 'production-setup.created',
        entityType: 'SalesOrderProductionSetup',
        entityId: salesOrderId,
        newValues: { salesOrderId, lineCount: order.lines.length },
      },
    });

    return this.getSetup(salesOrderId, user);
  }

  private seedLineCreateData(
    line: {
      id: string;
      description: string;
      manufacturingComplexity: ManufacturingComplexity | null;
      orderSpec: unknown;
      productId: string | null;
      product: {
        nameEn: string;
        width: unknown;
        height: unknown;
        depth: unknown;
        seatHeight: unknown;
        bomDefaults: unknown;
        workflowConfiguration: { workflowId: string } | null;
        stageMaterialInputs: Array<{
          inventoryItemId: string;
          qtyPerUnit: unknown;
          unit: string;
          inventoryItem: {
            id: string;
            sku: string;
            nameEn: string;
            category: string;
            unit: string;
          };
        }>;
        stageInventoryOutputs: Array<{
          expectedPieceCount: unknown;
          pieceLabels: unknown;
          inventoryTracking: string;
        }>;
      } | null;
    },
    documentIds: string[],
    released: boolean,
  ): Prisma.SalesOrderLineSetupCreateWithoutProductionSetupInput {
    const spec = this.asSpec(line.orderSpec);
    const complexity =
      line.manufacturingComplexity ??
      (spec?.manufacturingComplexity as ManufacturingComplexity | undefined) ??
      (line.productId ? ManufacturingComplexity.STANDARD : ManufacturingComplexity.CUSTOM);

    const catalogDimensions: Dims = {
      width: this.num(line.product?.width) ?? this.num(spec?.catalogDimensions?.width),
      height: this.num(line.product?.height) ?? this.num(spec?.catalogDimensions?.height),
      depth: this.num(line.product?.depth) ?? this.num(spec?.catalogDimensions?.depth),
      seatHeight: this.num(line.product?.seatHeight) ?? this.num(spec?.catalogDimensions?.seatHeight),
    };
    const orderDimensions: Dims = {
      width: this.num(spec?.requestedDimensions?.width) ?? catalogDimensions.width,
      height: this.num(spec?.requestedDimensions?.height) ?? catalogDimensions.height,
      depth: this.num(spec?.requestedDimensions?.depth) ?? catalogDimensions.depth,
      seatHeight: this.num(spec?.requestedDimensions?.seatHeight) ?? catalogDimensions.seatHeight,
    };
    const requestedFabric = this.fabricLabel(spec);
    const packaging = this.extractPackaging(line.product?.stageInventoryOutputs ?? []);
    const measurements = normalizeOrderMeasurements(spec?.customMeasurements);

    const materials = this.seedMaterials({
      complexity,
      product: line.product,
      requestedFabric,
    });

    const needsReview = complexity === ManufacturingComplexity.MODIFIED || complexity === ManufacturingComplexity.CUSTOM;
    const hasWorkflow = Boolean(line.product?.workflowConfiguration?.workflowId);
    const lineStatus = released
      ? SalesOrderLineSetupStatus.READY
      : needsReview
        ? SalesOrderLineSetupStatus.NEEDS_REVIEW
        : complexity === ManufacturingComplexity.STANDARD && hasWorkflow && materials.length > 0
          ? SalesOrderLineSetupStatus.NOT_STARTED
          : SalesOrderLineSetupStatus.NOT_STARTED;

    const specAttachmentIds = Array.isArray(spec?.attachmentIds)
      ? spec!.attachmentIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const mergedDocIds = [...new Set([...documentIds, ...specAttachmentIds])];

    return {
      salesOrderLine: { connect: { id: line.id } },
      status: lineStatus,
      manufacturingName: line.description || line.product?.nameEn || 'Custom piece',
      manufacturingComplexity: complexity,
      catalogDimensions: catalogDimensions as Prisma.InputJsonValue,
      orderDimensions: orderDimensions as Prisma.InputJsonValue,
      measurements: (measurements ?? undefined) as Prisma.InputJsonValue | undefined,
      workflow: line.product?.workflowConfiguration?.workflowId
        ? { connect: { id: line.product.workflowConfiguration.workflowId } }
        : undefined,
      workflowConfirmedAt:
        complexity === ManufacturingComplexity.STANDARD && hasWorkflow ? new Date() : undefined,
      packagingExpectation: packaging as Prisma.InputJsonValue,
      referenceDocumentIds: mergedDocIds as Prisma.InputJsonValue,
      requestedFabricLabel: requestedFabric ?? undefined,
      materialRequirements: materials.length
        ? {
            create: materials,
          }
        : undefined,
    };
  }

  private extractPackaging(
    outputs: Array<{ expectedPieceCount: unknown; pieceLabels: unknown; inventoryTracking: string }>,
  ) {
    const finished =
      outputs.find((o) => o.inventoryTracking === 'PRODUCES_FINISHED') ?? outputs[0] ?? null;
    if (!finished) {
      return { pieceLabels: [], expectedPieceCount: 1 };
    }
    const labels = Array.isArray(finished.pieceLabels) ? finished.pieceLabels : [];
    const count = this.num(finished.expectedPieceCount) ?? (labels.length || 1);
    return { pieceLabels: labels, expectedPieceCount: count };
  }

  private seedMaterials(input: {
    complexity: ManufacturingComplexity;
    requestedFabric: string | null;
    product: {
      bomDefaults: unknown;
      stageMaterialInputs: Array<{
        inventoryItemId: string;
        qtyPerUnit: unknown;
        unit: string;
        inventoryItem: {
          id: string;
          sku: string;
          nameEn: string;
          category: string;
          unit: string;
        };
      }>;
    } | null;
  }): Prisma.SalesOrderLineMaterialRequirementCreateWithoutLineSetupInput[] {
    if (!input.product || input.complexity === ManufacturingComplexity.CUSTOM) {
      return [];
    }

    const needsReview = input.complexity === ManufacturingComplexity.MODIFIED;
    const fromStages = input.product.stageMaterialInputs;
    if (fromStages.length > 0) {
      const byItem = new Map<string, Prisma.SalesOrderLineMaterialRequirementCreateWithoutLineSetupInput>();
      let sort = 0;
      for (const row of fromStages) {
        const existing = byItem.get(row.inventoryItemId);
        const qty = Number(row.qtyPerUnit) || 0;
        if (existing) {
          existing.expectedQty = new Prisma.Decimal(Number(existing.expectedQty) + qty);
          continue;
        }
        const isFabric = String(row.inventoryItem.category).toUpperCase() === 'FABRIC';
        byItem.set(row.inventoryItemId, {
          inventoryItem: { connect: { id: row.inventoryItemId } },
          sku: row.inventoryItem.sku,
          displayName: row.inventoryItem.nameEn,
          category: row.inventoryItem.category as never,
          unit: row.unit || row.inventoryItem.unit || 'pcs',
          expectedQty: new Prisma.Decimal(qty || 1),
          source: SalesOrderMaterialRequirementSource.CATALOG,
          needsReview: needsReview && isFabric,
          requestedFabricLabel: isFabric ? input.requestedFabric ?? undefined : undefined,
          sortOrder: sort++,
        });
      }
      return [...byItem.values()];
    }

    const bom = (input.product.bomDefaults ?? null) as BomDefaults | null;
    const materials = bom?.materials ?? [];
    return materials.map((m, idx) => ({
      sku: m.sku?.trim() || undefined,
      displayName: m.sku?.trim() || m.category || 'Material',
      category: (m.category as never) ?? undefined,
      unit: 'pcs',
      expectedQty: new Prisma.Decimal(Number(m.qty) || 1),
      source: SalesOrderMaterialRequirementSource.CATALOG,
      needsReview:
        needsReview &&
        (String(m.category ?? '').toUpperCase() === 'FABRIC' || Boolean(input.requestedFabric)),
      requestedFabricLabel:
        String(m.category ?? '').toUpperCase() === 'FABRIC'
          ? input.requestedFabric ?? undefined
          : undefined,
      sortOrder: idx,
    }));
  }

  async getSetup(salesOrderId: string, user?: AuthUser): Promise<Record<string, unknown>> {
    this.assertStaff(user);
    const setup = await this.prisma.salesOrderProductionSetup.findUnique({
      where: { salesOrderId },
      include: {
        salesOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            projectName: true,
            customerId: true,
            customer: { select: { id: true, nameEn: true, nameAr: true, code: true } },
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
          include: {
            salesOrderLine: {
              select: {
                id: true,
                description: true,
                quantity: true,
                productId: true,
                manufacturingComplexity: true,
                orderSpec: true,
                product: {
                  select: {
                    id: true,
                    sku: true,
                    nameEn: true,
                    nameAr: true,
                    nameHe: true,
                    imageUrl: true,
                  },
                },
              },
            },
            workflow: {
              select: {
                id: true,
                code: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
                status: true,
                activeVersionId: true,
                activeVersion: {
                  select: {
                    id: true,
                    versionNumber: true,
                    nodes: {
                      orderBy: { sortOrder: 'asc' },
                      select: {
                        nodeKey: true,
                        sortOrder: true,
                        stageDefinition: {
                          select: {
                            code: true,
                            nameEn: true,
                            nameAr: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            materialRequirements: {
              orderBy: { sortOrder: 'asc' },
              include: {
                inventoryItem: {
                  select: {
                    id: true,
                    sku: true,
                    nameEn: true,
                    nameAr: true,
                    nameHe: true,
                    category: true,
                    unit: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!setup) {
      return this.ensureSetup(salesOrderId, user);
    }

    const lineQtyById = new Map(
      setup.lines.map((l) => [l.id, Number(l.salesOrderLine.quantity) || 1]),
    );
    const readiness = await this.computeMaterialReadiness(setup.lines, lineQtyById);
    const validation = this.validateSetup(setup);
    const progress = this.computeProgress(setup);
    const materialCosts = await this.loadMaterialCostsForSetup(setup.lines);
    const attachmentsByLine = await this.resolveSetupAttachments(setup.lines);
    const actualCostByLine = await this.loadActualCostByLineSetup(
      salesOrderId,
      setup.lines.map((l) => l.id),
      materialCosts,
    );

    return {
      id: setup.id,
      salesOrderId: setup.salesOrderId,
      status: setup.status,
      releasedAt: setup.releasedAt,
      releasedById: setup.releasedById,
      salesOrder: setup.salesOrder,
      progress,
      validation,
      materialReadiness: readiness.summary,
      costingHook: PIECE2_EXPECTED_MATERIAL_COSTING_HOOK,
      postReleaseEditing: {
        locked: setup.status === SalesOrderProductionSetupStatus.RELEASED,
        revisionSystem: false,
        note: 'Released setups stay SETUP_LOCKED. No reopen/revision flow in Piece 4.',
      },
      lines: setup.lines.map((line) => {
        const catalog = (line.catalogDimensions ?? null) as Dims | null;
        const orderDims = (line.orderDimensions ?? null) as Dims | null;
        const measurements = normalizeOrderMeasurements(line.measurements);
        const lineReadiness = readiness.byLineSetupId[line.id];
        const skipCompare =
          line.manufacturingComplexity === ManufacturingComplexity.CUSTOM ||
          !line.salesOrderLine.productId;
        const changes = this.buildChanges(
          line.manufacturingComplexity,
          catalog,
          orderDims,
          line.requestedFabricLabel,
          measurements,
          { skipCompare },
        );
        const lineIssues = validation.issues.filter((i) => i.lineId === line.salesOrderLineId);
        const lineQty = lineQtyById.get(line.id) || 1;
        const materials = line.materialRequirements.map((m) => {
          const sku = m.sku ?? m.inventoryItem?.sku ?? null;
          const expectedQty = Number(m.expectedQty);
          const mappedCost = sku && materialCosts.has(sku) ? materialCosts.get(sku)! : null;
          const costAvailable = mappedCost != null && mappedCost > 0;
          const unitCost = costAvailable ? mappedCost : null;
          const estimatedLineCost =
            costAvailable && unitCost != null ? unitCost * expectedQty * lineQty : null;
          return {
            id: m.id,
            inventoryItemId: m.inventoryItemId,
            sku,
            displayName: m.displayName ?? m.inventoryItem?.nameEn ?? null,
            category: m.category ?? m.inventoryItem?.category ?? null,
            unit: m.unit,
            expectedQty,
            totalExpectedQty: expectedQty * lineQty,
            source: m.source,
            needsReview: m.needsReview,
            notes: m.notes,
            requestedFabricLabel: m.requestedFabricLabel,
            inventoryItem: m.inventoryItem,
            availability: lineReadiness?.byRequirementId[m.id] ?? null,
            unitCost,
            estimatedCost: estimatedLineCost,
            costAvailable,
            costUnavailable: !costAvailable,
          };
        });
        const costSummary = this.summarizeLineMaterialCosts(materials);
        const fabricMaterials = materials.filter(
          (m) => String(m.category ?? '').toUpperCase().includes('FABRIC'),
        );
        const selectedFabric =
          fabricMaterials.find((m) => m.inventoryItemId) ?? fabricMaterials[0] ?? null;
        const fabricAvail = selectedFabric?.availability ?? null;
        return {
          id: line.id,
          salesOrderLineId: line.salesOrderLineId,
          status: line.status,
          manufacturingName: line.manufacturingName,
          manufacturingComplexity: line.manufacturingComplexity,
          quantity: Number(line.salesOrderLine.quantity),
          catalogDimensions: catalog,
          orderDimensions: orderDims,
          measurements: measurements ?? [],
          changes,
          changesFromCatalog: changes,
          requestedFabricLabel: line.requestedFabricLabel,
          fabric: {
            requestedLabel: line.requestedFabricLabel,
            selected: selectedFabric,
            expectedQty: fabricMaterials.reduce((s, m) => s + m.expectedQty, 0),
            availableQty: fabricAvail?.available ?? null,
            shortageQty: fabricAvail?.short ?? null,
            unitCostAvailable: selectedFabric?.costAvailable ?? false,
            unitCost: selectedFabric?.unitCost ?? null,
            notes: selectedFabric?.notes ?? null,
            imageUrl: selectedFabric?.inventoryItem?.imageUrl ?? null,
          },
          factoryNotes: line.factoryNotes,
          packagingExpectation: line.packagingExpectation,
          referenceDocumentIds: line.referenceDocumentIds,
          attachments: attachmentsByLine.get(line.id) ?? [],
          materialsReviewedAt: line.materialsReviewedAt,
          workflowId: line.workflowId,
          workflowConfirmedAt: line.workflowConfirmedAt,
          workflow: line.workflow
            ? {
                id: line.workflow.id,
                code: line.workflow.code,
                nameEn: line.workflow.nameEn,
                nameAr: line.workflow.nameAr,
                nameHe: line.workflow.nameHe,
                stagePath: (line.workflow.activeVersion?.nodes ?? []).map((n) => ({
                  stageCode: n.stageDefinition.code,
                  nameEn: n.stageDefinition.nameEn,
                  nameAr: n.stageDefinition.nameAr,
                })),
              }
            : null,
          product: line.salesOrderLine.product,
          basedOnProduct:
            line.manufacturingComplexity === ManufacturingComplexity.CUSTOM &&
            line.salesOrderLine.product
              ? {
                  id: line.salesOrderLine.product.id,
                  nameEn: line.salesOrderLine.product.nameEn,
                  sku: line.salesOrderLine.product.sku,
                }
              : null,
          description: line.salesOrderLine.description,
          materials,
          estimatedCostSummary: costSummary,
          actualCostSummary: actualCostByLine.get(line.id) ?? null,
          materialStatus: lineReadiness?.status ?? 'NEEDS_SELECTION',
          sectionProgress: this.lineSectionProgress(line, lineIssues),
          issues: lineIssues,
        };
      }),
    };
  }

  private async resolveSetupAttachments(
    lines: Array<{ id: string; referenceDocumentIds: unknown }>,
  ): Promise<Map<string, Array<{ id: string; fileName: string; mimeType: string; url: string }>>> {
    const allIds = new Set<string>();
    const lineIdLists = new Map<string, string[]>();
    for (const line of lines) {
      const raw = line.referenceDocumentIds;
      const ids = Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
        : [];
      lineIdLists.set(line.id, ids);
      for (const id of ids) allIds.add(id);
    }
    const out = new Map<
      string,
      Array<{ id: string; fileName: string; mimeType: string; url: string }>
    >();
    if (allIds.size === 0) {
      for (const line of lines) out.set(line.id, []);
      return out;
    }
    const docs = await this.prisma.document.findMany({
      where: { id: { in: [...allIds] }, archivedAt: null },
      select: { id: true, fileName: true, mimeType: true },
    });
    const byId = new Map(docs.map((d) => [d.id, d]));
    for (const line of lines) {
      const ids = lineIdLists.get(line.id) ?? [];
      out.set(
        line.id,
        ids
          .map((id) => byId.get(id))
          .filter((d): d is { id: string; fileName: string; mimeType: string } => Boolean(d))
          .map((d) => ({
            id: d.id,
            fileName: d.fileName,
            mimeType: d.mimeType,
            url: `/uploads/documents/${d.id}/link`,
          })),
      );
    }
    return out;
  }

  /**
   * Read-only actual material cost rollup from finalized usage × valuation.
   * Does not invent costs; missing valuation → incomplete, never 0.
   */
  private async loadActualCostByLineSetup(
    salesOrderId: string,
    lineSetupIds: string[],
    materialCosts: MaterialCostMap,
  ): Promise<
    Map<
      string,
      {
        totalActual: number | null;
        costAvailable: boolean;
        someCostsUnavailable: boolean;
        incomplete: boolean;
        label: string;
        bySku: Array<{ sku: string; actualQty: number; unitCost: number | null; cost: number | null }>;
      }
    >
  > {
    const empty = new Map();
    if (lineSetupIds.length === 0) return empty;
    const pos = await this.prisma.productionOrder.findMany({
      where: { salesOrderId },
      select: {
        id: true,
        salesOrderLineId: true,
        materialUsages: {
          where: { finalizedAt: { not: null } },
          select: {
            sku: true,
            actualQty: true,
            returnedQty: true,
            scrapQty: true,
          },
        },
      },
    });
    if (pos.length === 0) return empty;

    const lineSetupBySoLine = await this.prisma.salesOrderLineSetup.findMany({
      where: { id: { in: lineSetupIds } },
      select: { id: true, salesOrderLineId: true },
    });
    const setupIdBySoLine = new Map(
      lineSetupBySoLine.map((l) => [l.salesOrderLineId, l.id]),
    );

    const bySetup = new Map<
      string,
      Map<string, { actualQty: number }>
    >();

    for (const po of pos) {
      if (!po.salesOrderLineId) continue;
      const setupId = setupIdBySoLine.get(po.salesOrderLineId);
      if (!setupId) continue;
      let skuMap = bySetup.get(setupId);
      if (!skuMap) {
        skuMap = new Map();
        bySetup.set(setupId, skuMap);
      }
      for (const u of po.materialUsages) {
        const qty =
          (u.actualQty != null ? Number(u.actualQty) : 0) +
          Number(u.scrapQty ?? 0) -
          Number(u.returnedQty ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const prev = skuMap.get(u.sku) ?? { actualQty: 0 };
        prev.actualQty += qty;
        skuMap.set(u.sku, prev);
      }
    }

    const result = new Map<
      string,
      {
        totalActual: number | null;
        costAvailable: boolean;
        someCostsUnavailable: boolean;
        incomplete: boolean;
        label: string;
        bySku: Array<{ sku: string; actualQty: number; unitCost: number | null; cost: number | null }>;
      }
    >();

    for (const [setupId, skuMap] of bySetup) {
      const bySku: Array<{
        sku: string;
        actualQty: number;
        unitCost: number | null;
        cost: number | null;
      }> = [];
      let total = 0;
      let anyAvailable = false;
      let anyUnavailable = false;
      for (const [sku, { actualQty }] of skuMap) {
        const mapped = materialCosts.has(sku) ? materialCosts.get(sku)! : null;
        const costAvailable = mapped != null && mapped > 0;
        if (costAvailable) {
          anyAvailable = true;
          total += mapped! * actualQty;
          bySku.push({ sku, actualQty, unitCost: mapped, cost: mapped! * actualQty });
        } else {
          anyUnavailable = true;
          bySku.push({ sku, actualQty, unitCost: null, cost: null });
        }
      }
      result.set(setupId, {
        totalActual: anyAvailable ? total : null,
        costAvailable: anyAvailable,
        someCostsUnavailable: anyUnavailable,
        incomplete: anyUnavailable || !anyAvailable,
        label: 'Actual material cost (usage)',
        bySku,
      });
    }
    return result;
  }

  private async loadMaterialCostsForSetup(
    lines: Array<{
      materialRequirements: Array<{
        sku: string | null;
        inventoryItem?: { sku: string; standardCost?: unknown } | null;
      }>;
    }>,
  ): Promise<MaterialCostMap> {
    const skus = new Set<string>();
    for (const line of lines) {
      for (const m of line.materialRequirements) {
        const sku = m.sku ?? m.inventoryItem?.sku;
        if (sku) skus.add(sku);
      }
    }
    if (skus.size === 0) return new Map();
    const skuList = [...skus];
    const [items, txs] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { sku: { in: skuList }, archivedAt: null },
        select: { sku: true, standardCost: true },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItem: { sku: { in: skuList } },
          unitCost: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 800,
        select: {
          unitCost: true,
          type: true,
          inventoryItem: { select: { sku: true } },
        },
      }),
    ]);
    return buildMaterialCostMap({
      standardCosts: items,
      transactions: txs.map((t) => ({
        sku: t.inventoryItem.sku,
        unitCost: t.unitCost,
        type: t.type,
      })),
    });
  }

  private summarizeLineMaterialCosts(
    materials: Array<{
      category: string | null;
      expectedQty: number;
      unitCost: number | null;
      estimatedCost: number | null;
      costAvailable: boolean;
    }>,
  ) {
    const buckets = {
      fabricQty: 0,
      fabricCost: 0,
      woodQty: 0,
      woodCost: 0,
      foamQty: 0,
      foamCost: 0,
      accessoriesQty: 0,
      accessoriesCost: 0,
      otherQty: 0,
      otherCost: 0,
    };
    let anyAvailable = false;
    let anyUnavailable = false;
    for (const m of materials) {
      const qty = m.expectedQty;
      const cost = m.costAvailable && m.estimatedCost != null ? m.estimatedCost : 0;
      if (m.costAvailable) anyAvailable = true;
      else anyUnavailable = true;
      const c = String(m.category ?? '').toUpperCase();
      if (c.includes('FABRIC')) {
        buckets.fabricQty += qty;
        buckets.fabricCost += cost;
      } else if (c.includes('WOOD')) {
        buckets.woodQty += qty;
        buckets.woodCost += cost;
      } else if (c.includes('FOAM')) {
        buckets.foamQty += qty;
        buckets.foamCost += cost;
      } else if (c.includes('ACCESS')) {
        buckets.accessoriesQty += qty;
        buckets.accessoriesCost += cost;
      } else {
        buckets.otherQty += qty;
        buckets.otherCost += cost;
      }
    }
    const total =
      buckets.fabricCost +
      buckets.woodCost +
      buckets.foamCost +
      buckets.accessoriesCost +
      buckets.otherCost;
    return {
      ...buckets,
      totalEstimated: anyAvailable ? total : null,
      costAvailable: anyAvailable,
      someCostsUnavailable: anyUnavailable,
      incomplete: anyUnavailable || !anyAvailable,
      estimateIncomplete: anyUnavailable || !anyAvailable,
      label: 'Estimated material cost (planned)',
    };
  }

  private lineSectionProgress(
    line: {
      manufacturingName: string | null;
      orderDimensions: unknown;
      workflowId: string | null;
      workflowConfirmedAt: Date | null;
      materialsReviewedAt: Date | null;
      packagingExpectation: unknown;
      materialRequirements: Array<{ inventoryItemId: string | null; needsReview: boolean }>;
      manufacturingComplexity: ManufacturingComplexity | null;
    },
    issues: SetupValidationIssue[],
  ) {
    const hasSpec =
      Boolean(line.manufacturingName?.trim()) &&
      line.orderDimensions != null &&
      !issues.some((i) => i.section === 'spec');
    const materialsOk =
      line.materialRequirements.length > 0 &&
      line.materialRequirements.every((m) => m.inventoryItemId) &&
      !line.materialRequirements.some((m) => m.needsReview) &&
      !issues.some((i) => i.section === 'materials');
    const workflowOk =
      Boolean(line.workflowId && line.workflowConfirmedAt) &&
      !issues.some((i) => i.section === 'workflow');
    const packagingOk = line.packagingExpectation != null;
    return {
      spec: hasSpec,
      materials: materialsOk,
      workflow: workflowOk,
      packaging: packagingOk,
      review: hasSpec && materialsOk && workflowOk,
    };
  }

  private computeProgress(setup: {
    status: SalesOrderProductionSetupStatus;
    lines: Array<{ status: SalesOrderLineSetupStatus }>;
  }) {
    const total = setup.lines.length || 1;
    const ready = setup.lines.filter((l) => l.status === SalesOrderLineSetupStatus.READY).length;
    const needsReview = setup.lines.filter((l) => l.status === SalesOrderLineSetupStatus.NEEDS_REVIEW).length;
    return {
      totalLines: setup.lines.length,
      readyLines: ready,
      needsReviewLines: needsReview,
      percent: Math.round((ready / total) * 100),
      headerStatus: setup.status,
      steps: [
        { key: 'setup', done: setup.status !== SalesOrderProductionSetupStatus.SETUP_REQUIRED },
        {
          key: 'lines',
          done: ready === setup.lines.length && setup.lines.length > 0,
        },
        { key: 'ready', done: setup.status === SalesOrderProductionSetupStatus.READY_FOR_RELEASE || setup.status === SalesOrderProductionSetupStatus.RELEASED },
        { key: 'released', done: setup.status === SalesOrderProductionSetupStatus.RELEASED },
      ],
    };
  }

  private validateSetup(setup: {
    status: SalesOrderProductionSetupStatus;
    lines: Array<{
      salesOrderLineId: string;
      status: SalesOrderLineSetupStatus;
      manufacturingName: string | null;
      workflowId: string | null;
      workflowConfirmedAt: Date | null;
      manufacturingComplexity: ManufacturingComplexity | null;
      materialRequirements: Array<{
        inventoryItemId: string | null;
        needsReview: boolean;
        expectedQty: unknown;
      }>;
    }>;
  }): { ok: boolean; issues: SetupValidationIssue[] } {
    const issues: SetupValidationIssue[] = [];
    if (!setup.lines.length) {
      issues.push({
        code: 'NO_LINES',
        message: 'Sales order has no production-required lines.',
        section: 'spec',
      });
    }
    for (const line of setup.lines) {
      if (!line.manufacturingName?.trim()) {
        issues.push({
          code: 'NAME_REQUIRED',
          message: 'Manufacturing name is required.',
          lineId: line.salesOrderLineId,
          section: 'spec',
        });
      }
      if (!line.workflowId) {
        issues.push({
          code: 'WORKFLOW_REQUIRED',
          message: 'Select a published workflow for this line.',
          lineId: line.salesOrderLineId,
          section: 'workflow',
        });
      } else if (!line.workflowConfirmedAt) {
        issues.push({
          code: 'WORKFLOW_UNCONFIRMED',
          message: 'Confirm the selected workflow path.',
          lineId: line.salesOrderLineId,
          section: 'workflow',
        });
      }
      if (!line.materialRequirements.length) {
        issues.push({
          code: 'MATERIALS_REQUIRED',
          message: 'Add at least one expected material.',
          lineId: line.salesOrderLineId,
          section: 'materials',
        });
      }
      for (const m of line.materialRequirements) {
        if (!m.inventoryItemId) {
          issues.push({
            code: 'MATERIAL_ITEM_REQUIRED',
            message: 'Every material must be linked to an inventory item.',
            lineId: line.salesOrderLineId,
            section: 'materials',
          });
          break;
        }
        if (Number(m.expectedQty) <= 0) {
          issues.push({
            code: 'MATERIAL_QTY_REQUIRED',
            message: 'Material expected quantity must be greater than zero.',
            lineId: line.salesOrderLineId,
            section: 'materials',
          });
          break;
        }
        if (m.needsReview) {
          issues.push({
            code: 'MATERIAL_NEEDS_REVIEW',
            message: 'Review modified materials before marking ready.',
            lineId: line.salesOrderLineId,
            section: 'materials',
          });
          break;
        }
      }
      if (line.status !== SalesOrderLineSetupStatus.READY && setup.status === SalesOrderProductionSetupStatus.READY_FOR_RELEASE) {
        issues.push({
          code: 'LINE_NOT_READY',
          message: 'All lines must be READY before release.',
          lineId: line.salesOrderLineId,
          section: 'review',
        });
      }
    }
    return { ok: issues.length === 0, issues };
  }

  private async computeMaterialReadiness(
    lines: Array<{
      id: string;
      materialRequirements: Array<{
        id: string;
        inventoryItemId: string | null;
        expectedQty: unknown;
        needsReview: boolean;
      }>;
    }>,
    lineQtyById: Map<string, number>,
  ) {
    const byLineSetupId: Record<
      string,
      {
        status: 'READY' | 'SHORTAGE' | 'NEEDS_SELECTION' | 'NEEDS_REVIEW';
        byRequirementId: Record<
          string,
          { available: number; reserved: number; free: number; short: number; status: string }
        >;
      }
    > = {};
    let anyShortage = false;
    let anyNeedsSelection = false;
    let anyNeedsReview = false;

    for (const line of lines) {
      const qty = lineQtyById.get(line.id) || 1;
      const byRequirementId: Record<
        string,
        { available: number; reserved: number; free: number; short: number; status: string }
      > = {};
      let lineStatus: 'READY' | 'SHORTAGE' | 'NEEDS_SELECTION' | 'NEEDS_REVIEW' = 'READY';

      for (const m of line.materialRequirements) {
        if (m.needsReview) {
          lineStatus = 'NEEDS_REVIEW';
          anyNeedsReview = true;
          byRequirementId[m.id] = {
            available: 0,
            reserved: 0,
            free: 0,
            short: 0,
            status: 'NEEDS_REVIEW',
          };
          continue;
        }
        if (!m.inventoryItemId) {
          lineStatus = lineStatus === 'NEEDS_REVIEW' ? lineStatus : 'NEEDS_SELECTION';
          anyNeedsSelection = true;
          byRequirementId[m.id] = {
            available: 0,
            reserved: 0,
            free: 0,
            short: Number(m.expectedQty) * qty,
            status: 'NEEDS_SELECTION',
          };
          continue;
        }
        const balance = await this.prisma.inventoryBalance.findFirst({
          where: {
            inventoryItemId: m.inventoryItemId,
            warehouse: { type: 'RAW_MATERIALS', isActive: true },
          },
          orderBy: { availableQty: 'desc' },
        });
        const available = Number(balance?.availableQty ?? 0);
        const reserved = Number(balance?.reservedQty ?? 0);
        const free = available - reserved;
        const needed = Number(m.expectedQty) * qty;
        const short = Math.max(0, needed - free);
        if (short > 0) {
          lineStatus = lineStatus === 'NEEDS_REVIEW' || lineStatus === 'NEEDS_SELECTION' ? lineStatus : 'SHORTAGE';
          anyShortage = true;
        }
        byRequirementId[m.id] = {
          available,
          reserved,
          free,
          short,
          status: short > 0 ? 'SHORTAGE' : 'READY',
        };
      }

      if (!line.materialRequirements.length) {
        lineStatus = 'NEEDS_SELECTION';
        anyNeedsSelection = true;
      }

      byLineSetupId[line.id] = { status: lineStatus, byRequirementId };
    }

    return {
      byLineSetupId,
      summary: {
        status: anyNeedsReview
          ? 'NEEDS_REVIEW'
          : anyNeedsSelection
            ? 'NEEDS_SELECTION'
            : anyShortage
              ? 'SHORTAGE'
              : 'READY',
        anyShortage,
        anyNeedsSelection,
        anyNeedsReview,
      },
    };
  }

  async patchLine(salesOrderId: string, lineId: string, dto: PatchLineSetupDto, user: AuthUser) {
    this.assertStaff(user);
    const setup = await this.requireEditableSetup(salesOrderId);
    const line = setup.lines.find((l) => l.salesOrderLineId === lineId || l.id === lineId);
    if (!line) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Setup line not found.' });
    }

    if (dto.workflowId) {
      const wf = await this.prisma.productionWorkflow.findUnique({
        where: { id: dto.workflowId },
      });
      if (!wf?.activeVersionId || wf.status === 'ARCHIVED') {
        throw new BadRequestException({
          code: 'WORKFLOW_INVALID',
          message: 'Select a published active workflow.',
        });
      }
    }

    const data: Prisma.SalesOrderLineSetupUpdateInput = {
      ...(dto.manufacturingName !== undefined ? { manufacturingName: dto.manufacturingName } : {}),
      ...(dto.factoryNotes !== undefined ? { factoryNotes: dto.factoryNotes } : {}),
      ...(dto.orderDimensions !== undefined
        ? { orderDimensions: dto.orderDimensions as Prisma.InputJsonValue }
        : {}),
      ...(dto.measurements !== undefined
        ? {
            measurements: (normalizeOrderMeasurements(dto.measurements) ??
              []) as Prisma.InputJsonValue,
          }
        : {}),
      ...(dto.requestedFabricLabel !== undefined
        ? { requestedFabricLabel: dto.requestedFabricLabel }
        : {}),
      ...(dto.manufacturingComplexity !== undefined
        ? {
            manufacturingComplexity: dto.manufacturingComplexity as ManufacturingComplexity,
          }
        : {}),
      ...(dto.packagingExpectation !== undefined
        ? { packagingExpectation: dto.packagingExpectation as Prisma.InputJsonValue }
        : {}),
      ...(dto.referenceDocumentIds !== undefined
        ? { referenceDocumentIds: dto.referenceDocumentIds as Prisma.InputJsonValue }
        : {}),
      ...(dto.workflowId !== undefined
        ? {
            workflow: dto.workflowId
              ? { connect: { id: dto.workflowId } }
              : { disconnect: true },
            workflowConfirmedAt: dto.confirmWorkflow ? new Date() : null,
          }
        : {}),
      ...(dto.confirmWorkflow && !dto.workflowId
        ? { workflowConfirmedAt: new Date() }
        : {}),
      ...(dto.materialsReviewed
        ? {
            materialsReviewedAt: new Date(),
            materialRequirements: {
              updateMany: {
                where: { needsReview: true },
                data: { needsReview: false },
              },
            },
          }
        : {}),
    };

    await this.prisma.salesOrderLineSetup.update({
      where: { id: line.id },
      data,
    });

    await this.recomputeLineAndHeaderStatus(setup.id, line.id);
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'production-setup.line.patch',
        entityType: 'SalesOrderLineSetup',
        entityId: line.id,
        newValues: dto as object,
      },
    });
    return this.getSetup(salesOrderId, user);
  }

  async putMaterials(
    salesOrderId: string,
    lineId: string,
    dto: PutLineMaterialsDto,
    user: AuthUser,
  ) {
    this.assertStaff(user);
    const setup = await this.requireEditableSetup(salesOrderId);
    const line = setup.lines.find((l) => l.salesOrderLineId === lineId || l.id === lineId);
    if (!line) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Setup line not found.' });
    }

    const resolved = await this.resolveMaterialRows(dto.materials, line.requestedFabricLabel);

    await this.prisma.$transaction(async (tx) => {
      await tx.salesOrderLineMaterialRequirement.deleteMany({ where: { lineSetupId: line.id } });
      if (resolved.length) {
        await tx.salesOrderLineMaterialRequirement.createMany({
          data: resolved.map((m, idx) => ({
            lineSetupId: line.id,
            inventoryItemId: m.inventoryItemId,
            sku: m.sku,
            displayName: m.displayName,
            category: m.category as never,
            unit: m.unit,
            expectedQty: m.expectedQty,
            source: m.source,
            needsReview: m.needsReview,
            notes: m.notes,
            requestedFabricLabel: m.requestedFabricLabel,
            sortOrder: idx,
          })),
        });
      }
      await tx.salesOrderLineSetup.update({
        where: { id: line.id },
        data: {
          materialsReviewedAt: resolved.some((m) => m.needsReview) ? null : new Date(),
        },
      });
    });

    await this.recomputeLineAndHeaderStatus(setup.id, line.id);
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'production-setup.materials.put',
        entityType: 'SalesOrderLineSetup',
        entityId: line.id,
        newValues: { count: resolved.length },
      },
    });
    return this.getSetup(salesOrderId, user);
  }

  private async resolveMaterialRows(
    materials: MaterialRequirementInputDto[],
    lineFabricLabel: string | null,
  ) {
    const out: Array<{
      inventoryItemId: string | null;
      sku: string | null;
      displayName: string | null;
      category: string | null;
      unit: string;
      expectedQty: number;
      source: SalesOrderMaterialRequirementSource;
      needsReview: boolean;
      notes: string | null;
      requestedFabricLabel: string | null;
    }> = [];

    for (const m of materials) {
      let item =
        m.inventoryItemId != null
          ? await this.prisma.inventoryItem.findFirst({
              where: { id: m.inventoryItemId, archivedAt: null },
            })
          : m.sku
            ? await this.prisma.inventoryItem.findFirst({
                where: { sku: m.sku, archivedAt: null },
              })
            : null;

      const category = (m.category ?? item?.category ?? null) as string | null;
      const isFabric = String(category ?? '').toUpperCase() === 'FABRIC';
      out.push({
        inventoryItemId: item?.id ?? null,
        sku: item?.sku ?? m.sku ?? null,
        displayName: m.displayName ?? item?.nameEn ?? null,
        category,
        unit: m.unit ?? item?.unit ?? 'pcs',
        expectedQty: Number(m.expectedQty) || 0,
        source: (m.source as SalesOrderMaterialRequirementSource) ?? SalesOrderMaterialRequirementSource.FACTORY_MODIFIED,
        needsReview: Boolean(m.needsReview),
        notes: m.notes ?? null,
        requestedFabricLabel: m.requestedFabricLabel ?? (isFabric ? lineFabricLabel : null),
      });
    }
    return out;
  }

  async seedFromCatalog(salesOrderId: string, lineId: string, user: AuthUser) {
    this.assertStaff(user);
    const setup = await this.requireEditableSetup(salesOrderId);
    const line = setup.lines.find((l) => l.salesOrderLineId === lineId || l.id === lineId);
    if (!line) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Setup line not found.' });
    }

    const soLine = await this.prisma.salesOrderLine.findUnique({
      where: { id: line.salesOrderLineId },
      include: {
        product: {
          select: {
            id: true,
            nameEn: true,
            width: true,
            height: true,
            depth: true,
            seatHeight: true,
            bomDefaults: true,
            workflowConfiguration: { select: { workflowId: true } },
            stageMaterialInputs: {
              include: {
                inventoryItem: {
                  select: {
                    id: true,
                    sku: true,
                    nameEn: true,
                    category: true,
                    unit: true,
                  },
                },
              },
            },
            stageInventoryOutputs: {
              select: {
                expectedPieceCount: true,
                pieceLabels: true,
                inventoryTracking: true,
              },
            },
          },
        },
      },
    });
    if (!soLine?.productId || !soLine.product) {
      throw new BadRequestException({
        code: 'NO_CATALOG_PRODUCT',
        message: 'Cannot seed from catalog for a CUSTOM line without a product.',
      });
    }

    const seeded = this.seedLineCreateData(
      {
        id: soLine.id,
        description: soLine.description,
        manufacturingComplexity: soLine.manufacturingComplexity,
        orderSpec: soLine.orderSpec,
        productId: soLine.productId,
        product: soLine.product as never,
      },
      Array.isArray(line.referenceDocumentIds)
        ? (line.referenceDocumentIds as string[])
        : [],
      false,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.salesOrderLineMaterialRequirement.deleteMany({ where: { lineSetupId: line.id } });
      // Explicit CUSTOM on the setup line is sticky — seed may refresh materials/dims
      // from catalog inspiration but must not auto-clear CUSTOM.
      const keepCustom =
        line.manufacturingComplexity === ManufacturingComplexity.CUSTOM;
      await tx.salesOrderLineSetup.update({
        where: { id: line.id },
        data: {
          manufacturingName: seeded.manufacturingName,
          manufacturingComplexity: keepCustom
            ? ManufacturingComplexity.CUSTOM
            : seeded.manufacturingComplexity,
          catalogDimensions: seeded.catalogDimensions,
          // Preserve order dims when MODIFIED/CUSTOM already set (no auto material scale either —
          // seedMaterials copies catalog qty as-is).
          orderDimensions: keepCustom
            ? (line.orderDimensions as Prisma.InputJsonValue) ?? seeded.orderDimensions
            : seeded.orderDimensions,
          workflowId: soLine.product!.workflowConfiguration?.workflowId ?? null,
          workflowConfirmedAt: seeded.workflowConfirmedAt ?? null,
          packagingExpectation: seeded.packagingExpectation,
          requestedFabricLabel: keepCustom
            ? line.requestedFabricLabel
            : seeded.requestedFabricLabel,
          measurements: keepCustom
            ? ((line.measurements as Prisma.InputJsonValue) ?? seeded.measurements ?? Prisma.JsonNull)
            : seeded.measurements ?? Prisma.JsonNull,
          status: SalesOrderLineSetupStatus.NEEDS_REVIEW,
          materialsReviewedAt: null,
          materialRequirements: seeded.materialRequirements,
        },
      });
    });

    await this.recomputeLineAndHeaderStatus(setup.id, line.id);
    return this.getSetup(salesOrderId, user);
  }

  async markReady(salesOrderId: string, user: AuthUser) {
    this.assertStaff(user);
    const setup = await this.requireEditableSetup(salesOrderId);
    // Refresh statuses
    for (const line of setup.lines) {
      await this.recomputeLineAndHeaderStatus(setup.id, line.id);
    }
    const current = await this.prisma.salesOrderProductionSetup.findUniqueOrThrow({
      where: { id: setup.id },
      include: {
        lines: { include: { materialRequirements: true } },
      },
    });
    const validation = this.validateSetup(current);
    if (!validation.ok) {
      throw new BadRequestException({
        code: 'SETUP_INCOMPLETE',
        message: 'Cannot mark ready until all setup issues are resolved.',
        details: validation.issues,
      });
    }

    await this.prisma.salesOrderLineSetup.updateMany({
      where: { productionSetupId: setup.id },
      data: { status: SalesOrderLineSetupStatus.READY },
    });
    await this.prisma.salesOrderProductionSetup.update({
      where: { id: setup.id },
      data: { status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'production-setup.mark-ready',
        entityType: 'SalesOrderProductionSetup',
        entityId: setup.id,
      },
    });
    return this.getSetup(salesOrderId, user);
  }

  async releasePreview(salesOrderId: string, user?: AuthUser) {
    const setup = (await this.getSetup(salesOrderId, user)) as {
      status: SalesOrderProductionSetupStatus;
      validation: { ok: boolean; issues: SetupValidationIssue[] };
      materialReadiness: unknown;
      lines: Array<{
        salesOrderLineId: string;
        manufacturingName: string | null;
        quantity: number;
        manufacturingComplexity: ManufacturingComplexity | null;
        workflow: unknown;
        packagingExpectation: unknown;
        materialStatus: string;
        materials: Array<{
          sku: string | null;
          displayName: string | null;
          expectedQty: number;
          totalExpectedQty: number;
          availability: unknown;
        }>;
      }>;
    };
    return {
      salesOrderId,
      headerStatus: setup.status,
      canRelease:
        setup.status === SalesOrderProductionSetupStatus.READY_FOR_RELEASE &&
        setup.validation.ok,
      validation: setup.validation,
      materialReadiness: setup.materialReadiness,
      lines: setup.lines.map((l) => ({
        salesOrderLineId: l.salesOrderLineId,
        manufacturingName: l.manufacturingName,
        quantity: l.quantity,
        manufacturingComplexity: l.manufacturingComplexity,
        workflow: l.workflow,
        packagingExpectation: l.packagingExpectation,
        materialStatus: l.materialStatus,
        materials: l.materials.map((m) => ({
          sku: m.sku,
          displayName: m.displayName,
          expectedQty: m.expectedQty,
          totalExpectedQty: m.totalExpectedQty,
          availability: m.availability,
        })),
      })),
      note: 'Material shortage does not block release; SO may become WAITING_FOR_MATERIALS.',
    };
  }

  async release(salesOrderId: string, user: AuthUser) {
    this.assertStaff(user);
    const existingPos = await this.prisma.productionOrder.count({
      where: { salesOrderId },
    });
    if (existingPos > 0) {
      throw new ConflictException({
        code: 'ALREADY_RELEASED',
        message: 'Production orders already exist for this sales order.',
      });
    }

    const setupRow = await this.requireEditableSetup(salesOrderId);
    for (const line of setupRow.lines) {
      await this.recomputeLineAndHeaderStatus(setupRow.id, line.id);
    }

    const setup = await this.prisma.salesOrderProductionSetup.findUniqueOrThrow({
      where: { salesOrderId },
      include: {
        salesOrder: {
          include: {
            lines: { where: { productionRequired: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
        lines: {
          include: {
            materialRequirements: true,
            salesOrderLine: true,
          },
        },
      },
    });

    if (setup.status !== SalesOrderProductionSetupStatus.READY_FOR_RELEASE) {
      // Allow release if validation passes even if mark-ready skipped
      const validation = this.validateSetup(setup);
      if (!validation.ok) {
        throw new BadRequestException({
          code: 'SETUP_INCOMPLETE',
          message: 'Production setup is incomplete and cannot be released.',
          details: validation.issues,
        });
      }
      await this.prisma.salesOrderProductionSetup.update({
        where: { id: setup.id },
        data: { status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE },
      });
    } else {
      const validation = this.validateSetup(setup);
      if (!validation.ok) {
        throw new BadRequestException({
          code: 'SETUP_INCOMPLETE',
          message: 'Production setup is incomplete and cannot be released.',
          details: validation.issues,
        });
      }
    }

    const order = setup.salesOrder;
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const lineSetup of setup.lines) {
        const line = lineSetup.salesOrderLine;
        const poNumber = await this.sequences.next('PO', 'PO');
        const productionOrder = await tx.productionOrder.create({
          data: {
            number: poNumber,
            salesOrderId: order.id,
            salesOrderLineId: line.id,
            customerId: order.customerId,
            productId: line.productId ?? undefined,
            productDescription: lineSetup.manufacturingName || line.description,
            quantity: line.quantity,
            specifications: line.specifications ?? undefined,
            requiredDeliveryDate: order.requiredDeliveryDate ?? undefined,
            status: 'PLANNED',
            createdById: user.id,
            notes: lineSetup.factoryNotes ?? undefined,
          },
        });

        const materialOverrides = lineSetup.materialRequirements
          .filter((m) => m.inventoryItemId && m.sku)
          .map((m) => ({
            inventoryItemId: m.inventoryItemId!,
            sku: m.sku!,
            qtyPerUnit: Number(m.expectedQty),
            unit: m.unit || 'pcs',
            required: true,
            quantityMode: 'LINEAR' as const,
          }));

        const snapshot = await this.workflowSnapshots.createSnapshotForProductionOrder(
          {
            productionOrderId: productionOrder.id,
            productId: line.productId,
            productDescription: lineSetup.manufacturingName || line.description,
            quantity: Number(line.quantity),
            specifications: line.specifications,
            createdById: user.id,
            workflowId: lineSetup.workflowId ?? undefined,
            materialOverrides,
          },
          tx,
        );
        if (!snapshot) {
          throw new BadRequestException({
            code: 'WORKFLOW_REQUIRED',
            message: `Could not create workflow snapshot for line ${line.id}.`,
          });
        }
      }

      const readiness = await this.inventory.tryReserveForSalesOrder(order.id, user.id, tx);
      if (!readiness.ready) {
        await tx.productionOrder.updateMany({
          where: { salesOrderId: order.id, status: 'PLANNED' },
          data: { status: 'WAITING_FOR_MATERIALS' },
        });
      }

      await tx.salesOrderProductionSetup.update({
        where: { id: setup.id },
        data: {
          status: SalesOrderProductionSetupStatus.RELEASED,
          releasedAt: new Date(),
          releasedById: user.id,
        },
      });
      await tx.salesOrderLineSetup.updateMany({
        where: { productionSetupId: setup.id },
        data: { status: SalesOrderLineSetupStatus.READY },
      });

      return tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: readiness.ready
            ? SalesOrderStatus.READY_FOR_PRODUCTION
            : SalesOrderStatus.WAITING_FOR_MATERIALS,
        },
        include: {
          lines: true,
          productionOrders: { include: { stages: true, tasks: true } },
        },
      });
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'production-setup.release',
        entityType: 'SalesOrder',
        entityId: order.id,
        newValues: {
          productionOrderCount: updated.productionOrders?.length ?? 0,
          status: updated.status,
        },
      },
    });

    await this.notifications
      .notifyCustomerUsers(order.customerId, {
        templateCode: 'ORDER_CONFIRMED',
        vars: { number: order.number },
        linkUrl: `/sales-orders/${order.id}`,
      })
      .catch(() => undefined);

    // Piece 2: intentionally skip scheduling.generateForProductionOrder
    return {
      id: setup.id,
      salesOrderId: order.id,
      status: SalesOrderProductionSetupStatus.RELEASED,
      salesOrderStatus: updated.status,
      productionOrderIds: (updated.productionOrders ?? []).map((po: { id: string }) => po.id),
      workerAssignmentRequired: true,
      schedulingSkipped: true,
    };
  }

  private async requireEditableSetup(salesOrderId: string) {
    let setup = await this.prisma.salesOrderProductionSetup.findUnique({
      where: { salesOrderId },
      include: {
        lines: { include: { materialRequirements: true, salesOrderLine: true } },
      },
    });
    if (!setup) {
      await this.ensureSetup(salesOrderId);
      setup = await this.prisma.salesOrderProductionSetup.findUnique({
        where: { salesOrderId },
        include: {
          lines: { include: { materialRequirements: true, salesOrderLine: true } },
        },
      });
    }
    if (!setup) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production setup not found.' });
    }
    if (setup.status === SalesOrderProductionSetupStatus.RELEASED) {
      throw new BadRequestException({
        code: 'SETUP_LOCKED',
        message: 'Production setup is released and cannot be edited.',
      });
    }
    if (setup.status === SalesOrderProductionSetupStatus.SETUP_REQUIRED) {
      await this.prisma.salesOrderProductionSetup.update({
        where: { id: setup.id },
        data: { status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS },
      });
      setup.status = SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS;
    }
    return setup;
  }

  private async recomputeLineAndHeaderStatus(setupId: string, lineSetupId: string) {
    const line = await this.prisma.salesOrderLineSetup.findUniqueOrThrow({
      where: { id: lineSetupId },
      include: { materialRequirements: true },
    });
    const issues = this.validateSetup({
      status: SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      lines: [
        {
          salesOrderLineId: line.salesOrderLineId,
          status: line.status,
          manufacturingName: line.manufacturingName,
          workflowId: line.workflowId,
          workflowConfirmedAt: line.workflowConfirmedAt,
          manufacturingComplexity: line.manufacturingComplexity,
          materialRequirements: line.materialRequirements,
        },
      ],
    }).issues.filter((i) => i.lineId === line.salesOrderLineId);

    const needsReview =
      line.materialRequirements.some((m) => m.needsReview) ||
      line.manufacturingComplexity === ManufacturingComplexity.CUSTOM ||
      line.manufacturingComplexity === ManufacturingComplexity.MODIFIED;

    let status = line.status;
    if (issues.length === 0) {
      status = SalesOrderLineSetupStatus.READY;
    } else if (needsReview || line.materialRequirements.some((m) => m.needsReview)) {
      status = SalesOrderLineSetupStatus.NEEDS_REVIEW;
    } else {
      status = SalesOrderLineSetupStatus.NOT_STARTED;
    }

    await this.prisma.salesOrderLineSetup.update({
      where: { id: lineSetupId },
      data: { status },
    });

    const all = await this.prisma.salesOrderLineSetup.findMany({
      where: { productionSetupId: setupId },
    });
    const allReady = all.length > 0 && all.every((l) => l.status === SalesOrderLineSetupStatus.READY);
    await this.prisma.salesOrderProductionSetup.update({
      where: { id: setupId },
      data: {
        status: allReady
          ? SalesOrderProductionSetupStatus.READY_FOR_RELEASE
          : SalesOrderProductionSetupStatus.SETUP_IN_PROGRESS,
      },
    });
  }

  /** True when setup is RELEASED (confirm may proceed as legacy alias). */
  async isReleased(salesOrderId: string): Promise<boolean> {
    const setup = await this.prisma.salesOrderProductionSetup.findUnique({
      where: { salesOrderId },
      select: { status: true },
    });
    return setup?.status === SalesOrderProductionSetupStatus.RELEASED;
  }
}
