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
import type { AuthUser, OrderFabricSelection, OrderLineSpecSnapshot, OrderMeasurement } from '@maher/types';
import {
  buildCatalogDiff,
  normalizeOrderFabrics,
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
import { distributeMaterialsToSnapshotNodes } from './distribute-stage-materials';
import { expectedQtyNumber } from './fabric-readiness';
import { ensureFabricProcurementsForSalesOrder } from './ensure-fabric-procurements';
import type {
  MaterialRequirementInputDto,
  PatchLineSetupDto,
  PutLineMaterialsDto,
} from './order-production-setup.dto';
import { PIECE2_EXPECTED_MATERIAL_COSTING_HOOK } from './order-production-setup.costing-hook';
import {
  CATALOG_TEMPLATE_AUDIT_ACTION,
  bomMaterialCount,
  catalogSeedActionAvailable,
  catalogSeedRequiresWorkflowConfirm,
  countExecutableWorkflowTasks,
  countSemiWipOutputs,
  fabricLabelFromSpec,
  hasUsableCatalogProductionDefinition,
  isProductionOrderLocked,
  resolveLinePlanType,
  SEED_WILL_NOT_CHANGE,
  STARTED_PRODUCTION_STATUSES,
  type CatalogSeedPreviewDto,
  type CatalogSeedUnavailableReason,
  type CatalogWorkflowIdentity,
} from './catalog-seed-preview';

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
    const fromList = spec?.fabrics
      ?.map((row) => {
        const parts = [row.type, row.code, row.color]
          .map((x) => (x != null ? String(x).trim() : ''))
          .filter(Boolean);
        return parts.join(' · ');
      })
      .filter(Boolean);
    if (fromList?.length) return fromList.join('; ');
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
      await ensureFabricProcurementsForSalesOrder(this.prisma, salesOrderId);
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
    await ensureFabricProcurementsForSalesOrder(this.prisma, salesOrderId);

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
          quantityMode?: string | null;
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
    const dealerFabrics = normalizeOrderFabrics(spec?.fabrics, spec?.fabric ?? undefined);
    const packaging = this.extractPackaging(line.product?.stageInventoryOutputs ?? []);
    const measurements = normalizeOrderMeasurements(spec?.customMeasurements);

    const materials = this.seedMaterials({
      complexity,
      product: line.product,
      requestedFabric,
      dealerFabrics,
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
    dealerFabrics?: OrderFabricSelection[];
    product: {
      bomDefaults: unknown;
      stageMaterialInputs: Array<{
        inventoryItemId: string;
        qtyPerUnit: unknown;
        unit: string;
        quantityMode?: string | null;
        workflowNodeId?: string | null;
        stageDefinition?: { code?: string | null } | null;
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
    const dealerFabrics = input.dealerFabrics ?? [];
    const needsReview = input.complexity === ManufacturingComplexity.MODIFIED;
    const fromStages = input.product?.stageMaterialInputs ?? [];
    const fabricStages = fromStages.filter(
      (row) => String(row.inventoryItem.category).toUpperCase() === 'FABRIC',
    );
    const otherStages = fromStages.filter(
      (row) => String(row.inventoryItem.category).toUpperCase() !== 'FABRIC',
    );

    const rows: Prisma.SalesOrderLineMaterialRequirementCreateWithoutLineSetupInput[] = [];
    let sort = 0;

    if (input.product && input.complexity !== ManufacturingComplexity.CUSTOM && otherStages.length > 0) {
      const byItem = new Map<string, Prisma.SalesOrderLineMaterialRequirementCreateWithoutLineSetupInput>();
      for (const row of otherStages) {
        const existing = byItem.get(row.inventoryItemId);
        const qty = Number(row.qtyPerUnit) || 0;
        if (existing) {
          const prev = expectedQtyNumber(existing.expectedQty) ?? 0;
          existing.expectedQty = new Prisma.Decimal(prev + qty);
          continue;
        }
        byItem.set(row.inventoryItemId, {
          inventoryItem: { connect: { id: row.inventoryItemId } },
          sku: row.inventoryItem.sku,
          displayName: row.inventoryItem.nameEn,
          category: row.inventoryItem.category as never,
          unit: row.unit || row.inventoryItem.unit || 'pcs',
          expectedQty: new Prisma.Decimal(qty || 1),
          source: SalesOrderMaterialRequirementSource.CATALOG,
          needsReview,
          stageCode: row.stageDefinition?.code ?? undefined,
          workflowNodeId: row.workflowNodeId ?? undefined,
          sortOrder: sort++,
        });
      }
      rows.push(...byItem.values());
    } else if (
      input.product &&
      input.complexity !== ManufacturingComplexity.CUSTOM &&
      otherStages.length === 0 &&
      fabricStages.length === 0
    ) {
      const bom = (input.product.bomDefaults ?? null) as BomDefaults | null;
      const materials = bom?.materials ?? [];
      for (const [idx, m] of materials.entries()) {
        const isFabric = String(m.category ?? '').toUpperCase() === 'FABRIC';
        if (isFabric) continue;
        rows.push({
          sku: m.sku?.trim() || undefined,
          displayName: m.sku?.trim() || m.category || 'Material',
          category: (m.category as never) ?? undefined,
          unit: 'pcs',
          expectedQty: new Prisma.Decimal(Number(m.qty) || 1),
          source: SalesOrderMaterialRequirementSource.CATALOG,
          needsReview,
          sortOrder: sort++,
        });
        void idx;
      }
    }

    const catalogFabricPool = [...fabricStages];
    if (dealerFabrics.length) {
      for (const sel of dealerFabrics) {
        const catalog = catalogFabricPool.shift();
        const labelParts = [sel.type, sel.code, sel.color].filter((x) => String(x ?? '').trim());
        const label = labelParts.length ? labelParts.join(' · ') : input.requestedFabric;
        const qty = sel.quantity != null && Number.isFinite(Number(sel.quantity))
          ? Number(sel.quantity)
          : catalog
            ? Number(catalog.qtyPerUnit) || null
            : null;
        rows.push({
          inventoryItem: catalog ? { connect: { id: catalog.inventoryItemId } } : undefined,
          sku: catalog?.inventoryItem.sku,
          displayName: catalog?.inventoryItem.nameEn ?? sel.type ?? 'Fabric',
          category: 'FABRIC' as never,
          unit: sel.unit || catalog?.unit || catalog?.inventoryItem.unit || 'm',
          expectedQty: qty != null ? new Prisma.Decimal(qty) : null,
          qtyIsEstimate: qty == null,
          source: SalesOrderMaterialRequirementSource.CATALOG,
          needsReview: needsReview || Boolean(label),
          requestedFabricLabel: label ?? undefined,
          stageCode: catalog?.stageDefinition?.code ?? undefined,
          workflowNodeId: catalog?.workflowNodeId ?? undefined,
          fabricRole: sel.role ?? undefined,
          fabricSelectionKey: sel.key ?? undefined,
          sortOrder: sort++,
        });
      }
      for (const catalog of catalogFabricPool) {
        const qty = Number(catalog.qtyPerUnit) || 1;
        rows.push({
          inventoryItem: { connect: { id: catalog.inventoryItemId } },
          sku: catalog.inventoryItem.sku,
          displayName: catalog.inventoryItem.nameEn,
          category: catalog.inventoryItem.category as never,
          unit: catalog.unit || catalog.inventoryItem.unit || 'm',
          expectedQty: new Prisma.Decimal(qty),
          source: SalesOrderMaterialRequirementSource.CATALOG,
          needsReview: needsReview || Boolean(input.requestedFabric),
          requestedFabricLabel: input.requestedFabric ?? undefined,
          stageCode: catalog.stageDefinition?.code ?? undefined,
          workflowNodeId: catalog.workflowNodeId ?? undefined,
          sortOrder: sort++,
        });
      }
    } else {
      for (const catalog of catalogFabricPool) {
        const qty = Number(catalog.qtyPerUnit) || 1;
        rows.push({
          inventoryItem: { connect: { id: catalog.inventoryItemId } },
          sku: catalog.inventoryItem.sku,
          displayName: catalog.inventoryItem.nameEn,
          category: catalog.inventoryItem.category as never,
          unit: catalog.unit || catalog.inventoryItem.unit || 'm',
          expectedQty: new Prisma.Decimal(qty),
          source: SalesOrderMaterialRequirementSource.CATALOG,
          needsReview: needsReview || Boolean(input.requestedFabric),
          requestedFabricLabel: input.requestedFabric ?? undefined,
          stageCode: catalog.stageDefinition?.code ?? undefined,
          workflowNodeId: catalog.workflowNodeId ?? undefined,
          sortOrder: sort++,
        });
      }
    }

    return rows;
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

    const factoryReleased = await this.isFactoryReleasedForSalesOrder(salesOrderId);
    const planEditable = !factoryReleased;

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
      /** True until Confirm / factory release — materials, packaging, path stay editable. */
      planEditable,
      factoryReleased,
      postReleaseEditing: {
        locked: factoryReleased,
        revisionSystem: false,
        note: factoryReleased
          ? 'Setup is locked after Confirm / factory work starts.'
          : 'Preparing: materials, packaging, and path can still be edited for this order.',
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
          const expectedQty = expectedQtyNumber(m.expectedQty);
          const mappedCost = sku && materialCosts.has(sku) ? materialCosts.get(sku)! : null;
          const costAvailable = mappedCost != null && mappedCost > 0;
          const unitCost = costAvailable ? mappedCost : null;
          const estimatedLineCost =
            costAvailable && unitCost != null && expectedQty != null
              ? unitCost * expectedQty * lineQty
              : null;
          return {
            id: m.id,
            inventoryItemId: m.inventoryItemId,
            sku,
            displayName: m.displayName ?? m.inventoryItem?.nameEn ?? null,
            category: m.category ?? m.inventoryItem?.category ?? null,
            unit: m.unit,
            expectedQty,
            qtyIsEstimate: m.qtyIsEstimate,
            totalExpectedQty: expectedQty != null ? expectedQty * lineQty : null,
            source: m.source,
            needsReview: m.needsReview,
            notes: m.notes,
            requestedFabricLabel: m.requestedFabricLabel,
            fabricRole: m.fabricRole,
            fabricSelectionKey: m.fabricSelectionKey,
            stageCode: m.stageCode,
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
            expectedQty: fabricMaterials.reduce((s, m) => s + (m.expectedQty ?? 0), 0),
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
      // Fabric requirements may carry an unknown quantity until the dealer spec lands.
      expectedQty: number | null;
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
      const qty = m.expectedQty ?? 0;
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

  private validateSetup(
    setup: {
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
          category?: string | null;
          qtyIsEstimate?: boolean | null;
        }>;
      }>;
    },
    opts?: {
      requireMaterials?: boolean;
      requireWorkflow?: boolean;
      requireLinesReady?: boolean;
    },
  ): { ok: boolean; issues: SetupValidationIssue[] } {
    const requireMaterials = opts?.requireMaterials !== false;
    const requireWorkflow = opts?.requireWorkflow !== false;
    const requireLinesReady = opts?.requireLinesReady !== false;
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
      if (requireWorkflow) {
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
      }
      if (requireMaterials) {
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
          if (expectedQtyNumber(m.expectedQty) == null) {
            const isFabric = String(m.category ?? '').toUpperCase() === 'FABRIC';
            if (!isFabric && !m.qtyIsEstimate) {
              issues.push({
                code: 'MATERIAL_QTY_REQUIRED',
                message: 'Material expected quantity must be greater than zero.',
                lineId: line.salesOrderLineId,
                section: 'materials',
              });
              break;
            }
          } else if (Number(m.expectedQty) <= 0) {
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
      }
      if (
        requireLinesReady &&
        line.status !== SalesOrderLineSetupStatus.READY &&
        setup.status === SalesOrderProductionSetupStatus.READY_FOR_RELEASE
      ) {
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
        category?: string | null;
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
            short: (expectedQtyNumber(m.expectedQty) ?? 0) * qty,
            status: 'NEEDS_SELECTION',
          };
          continue;
        }
        const isFabric = String(m.category ?? '').toUpperCase() === 'FABRIC';
        if (isFabric) {
          byRequirementId[m.id] = {
            available: 0,
            reserved: 0,
            free: 0,
            short: 0,
            status: 'ORDER_ALLOCATED',
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
        const needed = (expectedQtyNumber(m.expectedQty) ?? 0) * qty;
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
    await this.syncLineMaterialsToProductionOrders(line.id);
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
      // Null until a fabric quantity is known (dealer spec / supplier confirm).
      expectedQty: number | null;
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
        expectedQty: expectedQtyNumber(m.expectedQty),
        source: (m.source as SalesOrderMaterialRequirementSource) ?? SalesOrderMaterialRequirementSource.FACTORY_MODIFIED,
        needsReview: Boolean(m.needsReview),
        notes: m.notes ?? null,
        requestedFabricLabel: m.requestedFabricLabel ?? (isFabric ? lineFabricLabel : null),
      });
    }
    return out;
  }

  async previewSeedFromCatalog(
    salesOrderId: string,
    lineId: string,
    user: AuthUser,
  ): Promise<CatalogSeedPreviewDto> {
    this.assertStaff(user);
    return this.buildCatalogSeedPreview(salesOrderId, lineId);
  }

  async seedFromCatalog(
    salesOrderId: string,
    lineId: string,
    user: AuthUser,
    opts?: { confirmWorkflowChange?: boolean },
  ) {
    this.assertStaff(user);
    const preview = await this.buildCatalogSeedPreview(salesOrderId, lineId);
    const planType = resolveLinePlanType({
      manufacturingComplexity: preview.manufacturingComplexity,
      productId: preview.productId,
    });
    if (planType === 'CUSTOM' || !preview.productId || !preview.product) {
      throw new BadRequestException({
        code: 'CUSTOM_NO_TEMPLATE',
        message:
          'Custom products have no catalog production plan. Prepare the production plan for this order.',
      });
    }
    if (preview.factoryLocked) {
      throw new BadRequestException({
        code: 'SETUP_LOCKED',
        message: 'Production has started or been confirmed — setup can no longer be edited.',
      });
    }
    if (preview.requiresWorkflowChangeConfirmation && !opts?.confirmWorkflowChange) {
      throw new BadRequestException({
        code: 'WORKFLOW_CHANGE_REQUIRED',
        message:
          'The product production plan uses a different workflow. Confirm the change before applying.',
        details: preview,
      });
    }

    const setup = await this.requireEditableLineSetup(salesOrderId, lineId);
    const line = setup.lines.find((l) => l.salesOrderLineId === lineId || l.id === lineId);
    if (!line) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Setup line not found.' });
    }

    const soLine = await this.prisma.salesOrderLine.findUnique({
      where: { id: line.salesOrderLineId },
      include: { product: { select: this.catalogProductSelect() } },
    });
    if (!soLine?.productId || !soLine.product) {
      throw new BadRequestException({
        code: 'CUSTOM_NO_TEMPLATE',
        message:
          'Custom products have no catalog production plan. Prepare the production plan for this order.',
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

    const previousComplexity = line.manufacturingComplexity;
    const catalogWorkflowId = soLine.product.workflowConfiguration?.workflowId ?? null;
    const quantityModeByItemId = this.quantityModeByInventoryItem(
      soLine.product.stageMaterialInputs,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.salesOrderLineMaterialRequirement.deleteMany({ where: { lineSetupId: line.id } });
      const stickyComplexity =
        line.manufacturingComplexity ?? soLine.manufacturingComplexity ?? seeded.manufacturingComplexity;
      const keepOrderSpec =
        stickyComplexity === ManufacturingComplexity.CUSTOM ||
        stickyComplexity === ManufacturingComplexity.MODIFIED;
      await tx.salesOrderLineSetup.update({
        where: { id: line.id },
        data: {
          manufacturingName: seeded.manufacturingName,
          manufacturingComplexity: stickyComplexity,
          catalogDimensions: seeded.catalogDimensions,
          orderDimensions: keepOrderSpec
            ? (line.orderDimensions as Prisma.InputJsonValue) ?? seeded.orderDimensions
            : seeded.orderDimensions,
          workflowId: catalogWorkflowId,
          workflowConfirmedAt: seeded.workflowConfirmedAt ?? null,
          packagingExpectation: seeded.packagingExpectation,
          requestedFabricLabel: line.requestedFabricLabel ?? seeded.requestedFabricLabel,
          measurements: keepOrderSpec
            ? ((line.measurements as Prisma.InputJsonValue) ?? seeded.measurements ?? Prisma.JsonNull)
            : seeded.measurements ?? Prisma.JsonNull,
          status: SalesOrderLineSetupStatus.NEEDS_REVIEW,
          materialsReviewedAt: null,
          materialRequirements: seeded.materialRequirements,
        },
      });
    });

    await ensureFabricProcurementsForSalesOrder(this.prisma, salesOrderId);
    await this.recomputeLineAndHeaderStatus(setup.id, line.id);
    await this.syncLineMaterialsToProductionOrders(line.id, quantityModeByItemId);

    if (preview.requiresWorkflowChangeConfirmation && catalogWorkflowId) {
      for (const poId of preview.unreleasedProductionOrderIds) {
        await this.workflowSnapshots.assignWorkflowToProductionOrder(
          poId,
          catalogWorkflowId,
          user.id,
        );
      }
    }

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: CATALOG_TEMPLATE_AUDIT_ACTION,
        entityType: 'SalesOrderLineSetup',
        entityId: line.id,
        oldValues: {
          salesOrderId,
          lineId: line.salesOrderLineId,
          manufacturingComplexity: previousComplexity,
          current: preview.current,
        },
        newValues: {
          salesOrderId,
          lineId: line.salesOrderLineId,
          productId: preview.product.id,
          product: preview.product,
          sourceWorkflow: preview.productPlan.workflow,
          previousSetup: preview.current,
          appliedSetup: preview.productPlan,
          appliedBy: user.id,
          appliedAt: new Date().toISOString(),
          workflowChanged: preview.requiresWorkflowChangeConfirmation,
          manufacturingComplexity: previousComplexity,
        },
      },
    });

    return this.getSetup(salesOrderId, user);
  }

  private catalogProductSelect() {
    return {
      id: true,
      sku: true,
      nameEn: true,
      nameAr: true,
      nameHe: true,
      width: true,
      height: true,
      depth: true,
      seatHeight: true,
      bomDefaults: true,
      workflowConfiguration: {
        select: {
          workflowId: true,
          workflow: {
            select: {
              id: true,
              code: true,
              nameEn: true,
              nameAr: true,
              nameHe: true,
              status: true,
              activeVersion: {
                select: {
                  id: true,
                  versionNumber: true,
                  status: true,
                  nodes: {
                    select: {
                      defaultEstimatedMinutes: true,
                      stageDefinition: { select: { executionKind: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
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
          stageDefinition: { select: { code: true } },
        },
      },
      stageInventoryOutputs: {
        select: {
          expectedPieceCount: true,
          pieceLabels: true,
          inventoryTracking: true,
        },
      },
    } satisfies Prisma.ProductSelect;
  }

  private quantityModeByInventoryItem(
    rows: Array<{ inventoryItemId: string; quantityMode?: string | null }>,
  ): Map<string, 'LINEAR' | 'FIXED' | 'SETUP_PLUS_LINEAR' | 'BATCH' | 'PARALLEL_CAPACITY'> {
    const out = new Map<
      string,
      'LINEAR' | 'FIXED' | 'SETUP_PLUS_LINEAR' | 'BATCH' | 'PARALLEL_CAPACITY'
    >();
    for (const row of rows) {
      if (out.has(row.inventoryItemId)) continue;
      out.set(row.inventoryItemId, this.asQuantityMode(row.quantityMode));
    }
    return out;
  }

  private asQuantityMode(
    value: unknown,
  ): 'LINEAR' | 'FIXED' | 'SETUP_PLUS_LINEAR' | 'BATCH' | 'PARALLEL_CAPACITY' {
    const mode = String(value ?? 'LINEAR').toUpperCase();
    if (
      mode === 'FIXED' ||
      mode === 'SETUP_PLUS_LINEAR' ||
      mode === 'BATCH' ||
      mode === 'PARALLEL_CAPACITY'
    ) {
      return mode;
    }
    return 'LINEAR';
  }

  private workflowIdentity(
    workflow:
      | {
          id: string;
          code?: string | null;
          nameEn?: string | null;
          nameAr?: string | null;
          nameHe?: string | null;
          activeVersion?: { versionNumber?: number | null } | null;
        }
      | null
      | undefined,
    versionNumber?: number | null,
  ): CatalogWorkflowIdentity | null {
    if (!workflow?.id) return null;
    return {
      id: workflow.id,
      code: workflow.code ?? null,
      nameEn: workflow.nameEn ?? null,
      nameAr: workflow.nameAr ?? null,
      nameHe: workflow.nameHe ?? null,
      versionNumber: versionNumber ?? workflow.activeVersion?.versionNumber ?? null,
    };
  }

  private async buildCatalogSeedPreview(
    salesOrderId: string,
    lineId: string,
  ): Promise<CatalogSeedPreviewDto> {
    const setup = await this.prisma.salesOrderProductionSetup.findUnique({
      where: { salesOrderId },
      include: {
        lines: { include: { materialRequirements: true, workflow: true } },
      },
    });
    if (!setup) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production setup not found.' });
    }
    const line = setup.lines.find((l) => l.salesOrderLineId === lineId || l.id === lineId);
    if (!line) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Setup line not found.' });
    }

    const soLine = await this.prisma.salesOrderLine.findUnique({
      where: { id: line.salesOrderLineId },
      include: { product: { select: this.catalogProductSelect() } },
    });

    const pos = await this.prisma.productionOrder.findMany({
      where: { salesOrderLineId: line.salesOrderLineId, archivedAt: null },
      select: {
        id: true,
        status: true,
        releasedToFactoryAt: true,
        actualStartDate: true,
        workflowSnapshot: {
          select: {
            sourceWorkflowId: true,
            sourceVersionNumber: true,
            sourceWorkflow: {
              select: {
                id: true,
                code: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
              },
            },
          },
        },
        tasks: {
          where: { status: { not: 'CANCELLED' } },
          select: { id: true },
        },
      },
    });

    const factoryLocked = pos.some((po) => isProductionOrderLocked(po));
    const unreleasedProductionOrderIds = pos
      .filter((po) => !isProductionOrderLocked(po))
      .map((po) => po.id);
    const snapshot = pos.find((po) => po.workflowSnapshot)?.workflowSnapshot ?? null;
    const currentWorkflow = this.workflowIdentity(
      snapshot?.sourceWorkflow ?? line.workflow,
      snapshot?.sourceVersionNumber ?? null,
    );
    const currentWorkflowId =
      snapshot?.sourceWorkflowId ?? line.workflowId ?? currentWorkflow?.id ?? null;

    const emptySummary = {
      materials: 0,
      workflow: null as CatalogWorkflowIdentity | null,
      stages: 0,
      tasks: 0,
      semiWip: 0,
      hasDurationEstimates: false,
    };

    const current = {
      ...emptySummary,
      materials: line.materialRequirements.length,
      workflow: currentWorkflow,
      stages: snapshot ? 0 : line.workflow ? 0 : 0,
      tasks: pos.reduce((n, po) => n + (po.tasks?.length ?? 0), 0),
      hasExistingPlan:
        line.materialRequirements.length > 0 ||
        Boolean(currentWorkflowId) ||
        pos.some((po) => (po.tasks?.length ?? 0) > 0),
    };

    if (snapshot) {
      const snapNodes = await this.prisma.productionOrderWorkflowSnapshotNode.count({
        where: {
          snapshot: { productionOrderId: { in: pos.map((p) => p.id) } },
        },
      });
      current.stages = snapNodes;
    }

    const product = soLine?.product ?? null;
    const complexity =
      soLine?.manufacturingComplexity ??
      line.manufacturingComplexity ??
      null;
    const requestedFabric =
      line.requestedFabricLabel ?? fabricLabelFromSpec(soLine?.orderSpec) ?? null;
    const spec = this.asSpec(soLine?.orderSpec);
    const dealerFabrics = normalizeOrderFabrics(spec?.fabrics, spec?.fabric ?? undefined);

    if (!soLine?.productId || !product) {
      return {
        salesOrderId,
        lineId: line.salesOrderLineId,
        setupLineId: line.id,
        manufacturingComplexity: complexity,
        productId: soLine?.productId ?? null,
        product: null,
        quantity: Number(soLine?.quantity) || 0,
        requestedFabricLabel: requestedFabric,
        actionAvailable: false,
        unavailableReason: 'no_product',
        hasUsableDefinition: false,
        workflowWouldChange: false,
        requiresWorkflowChangeConfirmation: false,
        factoryLocked,
        current,
        productPlan: emptySummary,
        materials: [],
        willNotChange: SEED_WILL_NOT_CHANGE,
        assignmentImpact: {
          workersPreserved: true,
          datesPreserved: true,
          timesPreserved: true,
          sequencePreserved: true,
          assignmentsWouldBeRemoved: false,
        },
        unreleasedProductionOrderIds,
      };
    }

    const wf = product.workflowConfiguration?.workflow ?? null;
    const version = wf?.activeVersion ?? null;
    const published = String(version?.status ?? '').toUpperCase() === 'PUBLISHED';
    const nodeCount = version?.nodes?.length ?? 0;
    const usable = hasUsableCatalogProductionDefinition({
      workflowId: product.workflowConfiguration?.workflowId ?? null,
      published,
      nodeCount,
      stageMaterialInputCount: product.stageMaterialInputs.length,
      bomMaterialCount: bomMaterialCount(product.bomDefaults),
      stageInventoryOutputCount: product.stageInventoryOutputs.length,
    });

    const seededMaterials = this.seedMaterials({
      complexity: complexity ?? ManufacturingComplexity.STANDARD,
      product: product as never,
      requestedFabric,
      dealerFabrics,
    });
    const modeByItem = this.quantityModeByInventoryItem(product.stageMaterialInputs);
    const materials = seededMaterials.map((m) => {
      const itemId =
        m.inventoryItem && 'connect' in m.inventoryItem
          ? (m.inventoryItem as { connect: { id: string } }).connect.id
          : null;
      return {
        sku: (m.sku as string | undefined) ?? null,
        expectedQty: Number(m.expectedQty) || 0,
        quantityMode: itemId ? (modeByItem.get(itemId) ?? 'LINEAR') : 'LINEAR',
      };
    });

    const catalogWorkflow = this.workflowIdentity(wf, version?.versionNumber ?? null);
    const catalogWorkflowId = product.workflowConfiguration?.workflowId ?? null;
    const workflowWouldChange = catalogSeedRequiresWorkflowConfirm({
      hasProductionOrder: pos.length > 0,
      currentWorkflowId,
      catalogWorkflowId,
    });

    let unavailableReason: CatalogSeedUnavailableReason = null;
    const planType = resolveLinePlanType({
      manufacturingComplexity: complexity,
      productId: soLine.productId,
    });
    if (planType === 'CUSTOM') unavailableReason = 'custom';
    else if (!usable) unavailableReason = 'no_definition';
    else if (factoryLocked) unavailableReason = 'locked';

    const actionAvailable = catalogSeedActionAvailable({
      manufacturingComplexity: complexity,
      productId: soLine.productId,
      usableDefinition: usable,
      planEditable: !factoryLocked,
      factoryLocked,
    });

    const productPlan = {
      materials: materials.length,
      workflow: catalogWorkflow,
      stages: nodeCount,
      tasks: countExecutableWorkflowTasks(
        (version?.nodes ?? []).map((n) => ({
          executionKind: n.stageDefinition?.executionKind ?? null,
        })),
      ),
      semiWip: countSemiWipOutputs(product.stageInventoryOutputs),
      hasDurationEstimates: (version?.nodes ?? []).some(
        (n) => Number(n.defaultEstimatedMinutes) > 0,
      ),
    };

    return {
      salesOrderId,
      lineId: line.salesOrderLineId,
      setupLineId: line.id,
      manufacturingComplexity: complexity,
      productId: soLine.productId,
      product: {
        id: product.id,
        sku: product.sku ?? null,
        nameEn: product.nameEn ?? null,
        nameAr: product.nameAr ?? null,
        nameHe: product.nameHe ?? null,
      },
      quantity: Number(soLine.quantity) || 0,
      requestedFabricLabel: requestedFabric,
      actionAvailable,
      unavailableReason,
      hasUsableDefinition: usable,
      workflowWouldChange,
      requiresWorkflowChangeConfirmation: workflowWouldChange,
      factoryLocked,
      current,
      productPlan,
      materials,
      willNotChange: SEED_WILL_NOT_CHANGE,
      assignmentImpact: {
        workersPreserved: !workflowWouldChange,
        datesPreserved: !workflowWouldChange,
        timesPreserved: !workflowWouldChange,
        sequencePreserved: !workflowWouldChange,
        assignmentsWouldBeRemoved: workflowWouldChange,
      },
      unreleasedProductionOrderIds,
    };
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

  /**
   * Open Production Plan path: soft-prepare catalog defaults on incomplete lines,
   * create production orders if missing, return primary PO id for the plan editor.
   * Does not factory-release (releasedToFactoryAt stays null).
   */
  async ensurePlanOrders(salesOrderId: string, user: AuthUser) {
    this.assertStaff(user);
    await this.ensureSetup(salesOrderId, user);

    const existingPos = await this.prisma.productionOrder.findMany({
      where: { salesOrderId, archivedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existingPos.length > 0) {
      return {
        salesOrderId,
        productionOrderIds: existingPos.map((p) => p.id),
        primaryProductionOrderId: existingPos[0]!.id,
        created: false,
      };
    }

    await this.softPrepareLinesForPlan(salesOrderId, user);
    const released = await this.release(salesOrderId, user, { forPlanOpen: true });
    const ids = released.productionOrderIds ?? [];
    return {
      salesOrderId,
      productionOrderIds: ids,
      primaryProductionOrderId: ids[0] ?? null,
      created: true,
    };
  }

  /**
   * Best-effort catalog fill so draft POs can be created for the plan desk.
   * Materials stay optional here — the editor is where the team finishes them.
   */
  private async softPrepareLinesForPlan(salesOrderId: string, user: AuthUser) {
    const setup = await this.prisma.salesOrderProductionSetup.findUniqueOrThrow({
      where: { salesOrderId },
      include: {
        lines: {
          include: {
            materialRequirements: true,
            salesOrderLine: {
              include: {
                product: {
                  select: {
                    id: true,
                    nameEn: true,
                    workflowConfiguration: { select: { workflowId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const line of setup.lines) {
      const product = line.salesOrderLine.product;
      const complexity =
        line.manufacturingComplexity ?? line.salesOrderLine.manufacturingComplexity;
      // STANDARD: opening Production Plan must not auto-import the product template.
      // CUSTOM: no catalog template exists — leave materials empty for the manual desk.
      if (
        !line.materialRequirements.length &&
        complexity !== ManufacturingComplexity.STANDARD &&
        complexity !== ManufacturingComplexity.CUSTOM
      ) {
        await this.seedFromCatalog(salesOrderId, line.id, user).catch(() => undefined);
      }

      const refreshed = await this.prisma.salesOrderLineSetup.findUniqueOrThrow({
        where: { id: line.id },
        select: {
          manufacturingName: true,
          workflowId: true,
          workflowConfirmedAt: true,
        },
      });

      const name =
        refreshed.manufacturingName?.trim() ||
        line.salesOrderLine.description ||
        product?.nameEn ||
        'Piece';
      const workflowId =
        refreshed.workflowId ?? product?.workflowConfiguration?.workflowId ?? null;

      if (!workflowId) {
        await this.prisma.salesOrderLineSetup.update({
          where: { id: line.id },
          data: {
            manufacturingName: name,
            status: SalesOrderLineSetupStatus.NEEDS_REVIEW,
          },
        });
        continue;
      }

      await this.prisma.salesOrderLineSetup.update({
        where: { id: line.id },
        data: {
          manufacturingName: name,
          workflowId,
          workflowConfirmedAt: refreshed.workflowConfirmedAt ?? new Date(),
          status: SalesOrderLineSetupStatus.READY,
        },
      });
    }

    const prepared = await this.prisma.salesOrderLineSetup.findMany({
      where: { productionSetupId: setup.id },
      select: { workflowId: true },
    });
    if (prepared.length > 0 && prepared.every((row) => Boolean(row.workflowId))) {
      await this.prisma.salesOrderProductionSetup.update({
        where: { id: setup.id },
        data: { status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE },
      });
    }
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

  async release(
    salesOrderId: string,
    user: AuthUser,
    opts?: { forPlanOpen?: boolean },
  ) {
    this.assertStaff(user);
    const forPlanOpen = Boolean(opts?.forPlanOpen);
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
    // Plan-open already soft-prepared lines; recompute would block on empty materials.
    if (!forPlanOpen) {
      for (const line of setupRow.lines) {
        await this.recomputeLineAndHeaderStatus(setupRow.id, line.id);
      }
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

    const validation = this.validateSetup(setup, {
      requireMaterials: !forPlanOpen,
      requireWorkflow: !forPlanOpen,
      requireLinesReady: !forPlanOpen,
    });
    if (!validation.ok) {
      throw new BadRequestException({
        code: 'SETUP_INCOMPLETE',
        message: forPlanOpen
          ? 'Production plan needs a name and workflow path before it can open.'
          : 'Production setup is incomplete and cannot be released.',
        details: validation.issues,
      });
    }
    if (setup.status !== SalesOrderProductionSetupStatus.READY_FOR_RELEASE) {
      await this.prisma.salesOrderProductionSetup.update({
        where: { id: setup.id },
        data: { status: SalesOrderProductionSetupStatus.READY_FOR_RELEASE },
      });
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
        if (!snapshot && !forPlanOpen) {
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

  private async isFactoryReleasedForSalesOrder(salesOrderId: string): Promise<boolean> {
    const released = await this.prisma.productionOrder.findFirst({
      where: {
        salesOrderId,
        OR: [
          { releasedToFactoryAt: { not: null } },
          { actualStartDate: { not: null } },
          {
            status: {
              in: [
                'IN_PROGRESS',
                'ON_HOLD',
                'QUALITY_CHECK',
                'READY_FOR_PACKAGING',
                'READY_FOR_DELIVERY',
                'COMPLETED',
              ],
            },
          },
        ],
      },
      select: { id: true },
    });
    return Boolean(released);
  }

  private async requireEditableLineSetup(salesOrderId: string, lineId: string) {
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
    const line = setup.lines.find((l) => l.salesOrderLineId === lineId || l.id === lineId);
    if (!line) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Setup line not found.' });
    }
    if (await this.isLineProductionLocked(line.salesOrderLineId)) {
      throw new BadRequestException({
        code: 'SETUP_LOCKED',
        message: 'Production has started or been confirmed — setup can no longer be edited.',
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

  private async isLineProductionLocked(salesOrderLineId: string): Promise<boolean> {
    const locked = await this.prisma.productionOrder.findFirst({
      where: {
        salesOrderLineId,
        archivedAt: null,
        OR: [
          { releasedToFactoryAt: { not: null } },
          { actualStartDate: { not: null } },
          { status: { in: [...STARTED_PRODUCTION_STATUSES] } },
        ],
      },
      select: { id: true },
    });
    return Boolean(locked);
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
    // Lock only after Confirm / factory release — Preparing may still edit materials & packaging.
    if (await this.isFactoryReleasedForSalesOrder(salesOrderId)) {
      throw new BadRequestException({
        code: 'SETUP_LOCKED',
        message: 'Production has started or been confirmed — setup can no longer be edited.',
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

  /** Push line material requirements into unreleased PO workflow snapshots (Preparing edits). */
  private async syncLineMaterialsToProductionOrders(
    lineSetupId: string,
    quantityModeByItemId?: Map<
      string,
      'LINEAR' | 'FIXED' | 'SETUP_PLUS_LINEAR' | 'BATCH' | 'PARALLEL_CAPACITY'
    >,
  ) {
    const line = await this.prisma.salesOrderLineSetup.findUnique({
      where: { id: lineSetupId },
      include: {
        materialRequirements: { orderBy: { sortOrder: 'asc' } },
        salesOrderLine: { select: { id: true } },
      },
    });
    if (!line?.salesOrderLineId) return;

    const pos = await this.prisma.productionOrder.findMany({
      where: {
        salesOrderLineId: line.salesOrderLineId,
        archivedAt: null,
        releasedToFactoryAt: null,
        actualStartDate: null,
        status: { notIn: [...STARTED_PRODUCTION_STATUSES] },
      },
      select: { id: true },
    });
    if (!pos.length) return;

    const overrides = line.materialRequirements
      .filter((m) => m.inventoryItemId && m.sku)
      .map((m) => ({
        inventoryItemId: m.inventoryItemId!,
        sku: m.sku!,
        qtyPerUnit: Number(m.expectedQty),
        unit: m.unit || 'pcs',
        required: true as const,
        quantityMode: quantityModeByItemId?.get(m.inventoryItemId!) ?? ('LINEAR' as const),
      }));

    const productId = await this.prisma.salesOrderLine.findUnique({
      where: { id: line.salesOrderLineId },
      select: { productId: true },
    });
    const catalogInputs = productId?.productId
      ? await this.prisma.productStageMaterialInput.findMany({
          where: { productId: productId.productId },
          select: {
            inventoryItemId: true,
            workflowNodeId: true,
            stageDefinitionId: true,
            qtyPerUnit: true,
            unit: true,
            quantityMode: true,
          },
        })
      : [];

    for (const po of pos) {
      const snapshot = await this.prisma.productionOrderWorkflowSnapshot.findUnique({
        where: { productionOrderId: po.id },
        include: {
          nodes: {
            orderBy: { sortOrder: 'asc' },
            include: { materialInputs: true },
          },
        },
      });
      if (!snapshot?.nodes.length) continue;

      const distributed = distributeMaterialsToSnapshotNodes(
        snapshot.nodes.map((n) => ({
          id: n.id,
          stageCode: n.stageCode,
          sourceWorkflowNodeId: n.sourceWorkflowNodeId,
          stageDefinitionId: n.stageDefinitionId,
          consumesRawMaterials: n.consumesRawMaterials,
          sortOrder: n.sortOrder,
        })),
        catalogInputs,
        overrides,
      );

      await this.prisma.$transaction(async (tx) => {
        for (const node of snapshot.nodes) {
          await tx.productionOrderWorkflowSnapshotMaterialInput.deleteMany({
            where: { snapshotNodeId: node.id },
          });
        }
        if (distributed.length) {
          await tx.productionOrderWorkflowSnapshotMaterialInput.createMany({
            data: distributed.map((row) => ({
              snapshotNodeId: row.snapshotNodeId,
              stageCode: row.stageCode,
              inventoryItemId: row.inventoryItemId,
              sku: row.sku,
              qtyPerUnit: row.qtyPerUnit,
              quantityMode: row.quantityMode,
              unit: row.unit,
              required: row.required,
            })),
          });
        }
      });
    }
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
