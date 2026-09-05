import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { inventoryScanPayload, wipKitScanPayload, wipPieceScanPayload } from '@maher/types';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import {
  buildInventoryItemReportPdf,
  buildInventoryLabelPdf,
  buildSimplePdf,
  fetchPdfImageBuffer,
  parsePdfQuery,
  printableScanCode,
  sendPdf,
} from '../../common/helpers/pdf.util';
import { localizedName, localizedQuotationStatus, pdfMessages } from '../../common/helpers/pdf-i18n';
import { roundMoney } from '../../common/helpers/money.util';
import { isDealerVisibleQuotationStatus } from '../quotations/quotation-visibility';
import { canonicalInventoryImageUrl } from '../inventory/inventory-image';
import { InventoryItemReportService } from '../inventory/inventory-item-report.service';
import { mapInventoryItemReportToPdfSpec } from '../inventory/inventory-item-report-pdf';
import { RawMaterialsReportService } from '../inventory/raw-materials-report.service';
import { buildRawMaterialsReportPdf } from '../inventory/raw-materials-report-pdf';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';

@ApiTags('pdf')
@Controller()
export class PdfController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryItemReport: InventoryItemReportService,
    private readonly storage: LocalStorageService,
    private readonly rawMaterialsReport: RawMaterialsReportService,
  ) {}

  private opts(
    query: { lang?: string; theme?: string },
    acceptLanguage?: string | string[],
  ) {
    return parsePdfQuery({ ...query, acceptLanguage });
  }

  @Get('quotations/:id/pdf')
  @RequirePermissions('quotation.read')
  async quotationPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const q = await this.prisma.quotation.findFirst({
      where: { id, archivedAt: null },
      include: { customer: true, lines: true, request: { select: { number: true } } },
    });
    if (!q) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Quotation not found.' });
    }
    if (user.customerId) {
      if (q.customerId !== user.customerId || !isDealerVisibleQuotationStatus(q.status)) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Quotation not found.' });
      }
    }

    const specOf = (l: (typeof q.lines)[number]) => {
      const parts: string[] = [];
      if (l.material) parts.push(String(l.material));
      if (l.fabric) parts.push(String(l.fabric));
      if (l.color) parts.push(String(l.color));
      const w = l.width != null ? Number(l.width) : null;
      const h = l.height != null ? Number(l.height) : null;
      const d = l.depth != null ? Number(l.depth) : null;
      if (w || h || d) parts.push(`${w ?? '—'}×${h ?? '—'}×${d ?? '—'} cm`);
      return parts.join(' · ');
    };

    const meta = [
      `${m.customer}: ${localizedName(locale, q.customer)}`,
      `${m.status}: ${localizedQuotationStatus(locale, q.status)}`,
      `${m.currency}: ${q.currency}`,
    ];
    if (q.request?.number) meta.push(`${m.rfq}: ${q.request.number}`);
    if (q.expirationDate) {
      meta.push(`${m.validUntil}: ${q.expirationDate.toISOString().slice(0, 10)}`);
    }
    if (q.paymentTerms) meta.push(`${m.paymentTerms}: ${q.paymentTerms}`);
    if (q.offeredDeliveryDate) {
      meta.push(`${m.factoryDelivery}: ${q.offeredDeliveryDate.toISOString().slice(0, 10)}`);
    }
    if (q.deliveryTerms) meta.push(`${m.deliveryTerms}: ${q.deliveryTerms}`);
    if (q.customerNotes) meta.push(`${m.notes}: ${q.customerNotes}`);

    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.quotation,
      subtitle: `${q.number} · ${m.version} ${q.version}`,
      meta,
      columns: [m.description, m.qty, m.unitPrice, m.discount, m.lineTotal],
      rows: q.lines.map((l) => {
        const spec = specOf(l);
        return [
          spec ? `${l.description}\n${spec}` : l.description,
          String(l.quantity),
          String(l.unitPrice),
          String(l.discountValue ?? 0),
          String(l.lineTotal),
        ];
      }),
      footerLines: [
        `${m.subtotal}: ${q.subtotal} ${q.currency}`,
        `${m.tax}: ${q.taxTotal} ${q.currency}`,
        `${m.total}: ${q.total} ${q.currency}`,
      ],
    });
    sendPdf(res, `${q.number}-v${q.version}.pdf`, buffer);
  }

  @Get('invoices/:id/pdf')
  @RequirePermissions('invoice.read')
  async invoicePdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const inv = await this.prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: { customer: true, lines: true },
    });
    if (!assertCustomerOwns(user, inv.customerId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not your invoice.',
      });
    }
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.invoice,
      subtitle: inv.number,
      meta: [
        `${m.customer}: ${localizedName(locale, inv.customer)}`,
        `${m.status}: ${inv.status}`,
      ],
      columns: [m.description, m.qty, m.unitPrice, m.lineTotal],
      rows: inv.lines.map((l) => [
        l.description,
        String(l.quantity),
        String(l.unitPrice),
        String(l.lineTotal),
      ]),
      footerLines: [
        `${m.total}: ${inv.total} ${inv.currency}`,
        `${m.outstanding}: ${inv.outstandingAmount} ${inv.currency}`,
      ],
    });
    sendPdf(res, `${inv.number}.pdf`, buffer);
  }

  @Get('payments/:id/pdf')
  @RequirePermissions('payment.read')
  async paymentPdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        invoice: { select: { id: true, number: true, total: true } },
      },
    });
    if (!assertCustomerOwns(user, payment.customerId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not your payment.',
      });
    }
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.paymentReceipt,
      subtitle: payment.number,
      meta: [
        `${m.customer}: ${localizedName(locale, payment.customer)}`,
        `${m.date}: ${payment.paymentDate.toISOString().slice(0, 10)}`,
        `${m.method}: ${payment.method}`,
      ],
      columns: [m.field, m.value],
      rows: [
        [m.paymentNumber, payment.number],
        [m.amount, `${payment.amount} ${payment.currency}`],
        [m.method, payment.method],
        [m.invoiceRef, payment.invoice?.number ?? '—'],
        [m.reference, payment.referenceNumber ?? '—'],
        [m.bank, payment.bank ?? '—'],
        [m.notes, payment.notes ?? '—'],
      ],
      footerLines: [
        payment.invoice
          ? `${m.appliedToInvoice} ${payment.invoice.number}`
          : m.unallocatedPayment,
        `${m.generated} ${new Date().toISOString().slice(0, 10)}`,
      ],
    });
    sendPdf(res, `${payment.number}.pdf`, buffer);
  }

  @Get('contracts/:id/pdf')
  @RequirePermissions('contract.read')
  async contractPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const c = await this.prisma.contract.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        salesOrder: { select: { number: true, externalOrderNumber: true } },
      },
    });
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.contract,
      subtitle: c.number,
      meta: [
        `${m.customer}: ${localizedName(locale, c.customer)}`,
        `${m.status}: ${c.status}`,
        `${m.salesOrder}: ${c.salesOrder?.number ?? '—'}`,
        c.salesOrder?.externalOrderNumber
          ? `${m.externalRef}: ${c.salesOrder.externalOrderNumber}`
          : '',
        c.startDate
          ? `${m.start}: ${c.startDate.toISOString().slice(0, 10)}`
          : '',
        c.endDate ? `${m.end}: ${c.endDate.toISOString().slice(0, 10)}` : '',
      ].filter(Boolean),
      columns: [m.field, m.value],
      rows: [
        [m.contractValue, `${c.contractValue} ${c.currency}`],
        [m.paymentSchedule, c.paymentSchedule ?? '—'],
        [m.deliveryMilestones, c.deliveryMilestones ?? '—'],
        [m.warranty, c.warranty ?? '—'],
        [m.terms, c.terms ?? '—'],
      ],
      footerLines: [`${m.generated} ${new Date().toISOString().slice(0, 10)}`],
    });
    sendPdf(res, `${c.number}.pdf`, buffer);
  }

  /**
   * GRN PDF — not implemented as a dealer-facing document.
   * Internal receipt detail lives on PO API (`goodsReceipts` + unitCost).
   * Never expose purchase unit costs on dealer PDFs.
   */
  @Get('purchasing/goods-receipts/:id/pdf')
  @RequirePermissions('purchase-order.read')
  goodsReceiptPdf(@Param('id') id: string) {
    throw new BadRequestException({
      code: 'GRN_PDF_NOT_AVAILABLE',
      message:
        'Goods receipt PDF is not available. Use the purchase order PDF for expected costs, or PO detail goodsReceipts for internal actual unit costs. GRN PDFs are never dealer-facing.',
      goodsReceiptId: id,
    });
  }

  @Get('purchasing/orders/:id/pdf')
  @RequirePermissions('purchase-order.read')
  async purchaseOrderPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { supplier: true, lines: true, warehouse: true },
    });
    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.purchaseOrder,
      subtitle: po.number,
      meta: [
        `${m.supplier}: ${localizedName(locale, po.supplier)}`,
        `${m.status}: ${po.status}`,
        `${m.warehouse}: ${po.warehouse?.code ?? '—'}`,
        `${m.orderDate}: ${po.orderDate.toISOString().slice(0, 10)}`,
      ],
      columns: [m.description, m.qty, m.unitPrice, m.lineTotal],
      rows: po.lines.map((l) => [
        l.description,
        String(l.quantity),
        String(l.unitPrice),
        String(l.lineTotal),
      ]),
      footerLines: [
        `${m.subtotal}: ${po.subtotal} ${po.currency}`,
        `${m.tax}: ${po.taxAmount} ${po.currency}`,
        `${m.shipping}: ${po.shippingAmount} ${po.currency}`,
        `${m.total}: ${po.total} ${po.currency}`,
      ],
    });
    sendPdf(res, `${po.number}.pdf`, buffer);
  }

  @Get('suppliers/:id/statement/pdf')
  @RequirePermissions('supplier.read')
  async supplierStatementPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const supplier = await this.prisma.supplier.findUniqueOrThrow({
      where: { id },
    });
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: {
        supplierId: id,
        archivedAt: null,
        status: { notIn: ['CANCELLED', 'VOID'] },
      },
      orderBy: { invoiceDate: 'asc' },
    });
    const payments = await this.prisma.supplierPayment.findMany({
      where: { supplierId: id },
      orderBy: { paymentDate: 'asc' },
    });

    type Entry = {
      date: Date;
      reference: string;
      debit: number;
      credit: number;
      description: string;
    };
    const entries: Entry[] = [
      ...invoices.map((inv) => ({
        date: inv.invoiceDate,
        reference: inv.number,
        debit: Number(inv.total),
        credit: 0,
        description: `${m.invoice} ${inv.number}`,
      })),
      ...payments.map((pay) => ({
        date: pay.paymentDate,
        reference: pay.number,
        debit: 0,
        credit: Number(pay.amount),
        description: `${m.paymentReceipt} ${pay.number}`,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    const rows = entries.map((e) => {
      balance += e.debit - e.credit;
      return [
        e.date.toISOString().slice(0, 10),
        e.reference,
        e.description,
        roundMoney(e.debit),
        roundMoney(e.credit),
        roundMoney(balance),
      ];
    });

    const buffer = await buildSimplePdf({
      locale,
      theme: pdfTheme,
      title: m.supplierStatement,
      subtitle: `${localizedName(locale, supplier)} (${supplier.code})`,
      meta: [`${m.closingAp}: ${roundMoney(balance)} ILS`],
      columns: [m.date, m.ref, m.description, m.debit, m.credit, m.balance],
      rows,
      footerLines: [`${m.closing}: ${roundMoney(balance)} ILS`],
    });
    sendPdf(res, `SOA-SUP-${supplier.code}.pdf`, buffer);
  }

  @Get('inventory/items/:id/label')
  @RequirePermissions('inventory.read')
  async inventoryLabel(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const report = await this.inventoryItemReport.getReportData(
      id,
      user.permissions ?? [],
      locale,
    );
    const photo = await fetchPdfImageBuffer(report.identity.imageUrl);
    const buffer = await buildInventoryItemReportPdf(
      mapInventoryItemReportToPdfSpec({
        report,
        image: photo,
        theme: pdfTheme,
      }),
    );
    sendPdf(res, `item-report-${report.identity.sku}.pdf`, buffer);
  }

  @Get('inventory/reports/raw-materials/pdf')
  @RequirePermissions('report.inventory.read', 'inventory.cost.read')
  async rawMaterialsReportPdf(
    @CurrentUser() user: AuthUser,
    @Query('period') period: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    return this.sendRawMaterialsPdf(user, { period, from, to, lang, theme }, acceptLanguage, res);
  }

  /** Plan path — PdfController has no `/documents` prefix, so this is the literal URL. */
  @Get('documents/inventory/reports/raw-materials')
  @RequirePermissions('report.inventory.read', 'inventory.cost.read')
  async rawMaterialsReportPdfAlias(
    @CurrentUser() user: AuthUser,
    @Query('period') period: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    return this.sendRawMaterialsPdf(user, { period, from, to, lang, theme }, acceptLanguage, res);
  }

  private async sendRawMaterialsPdf(
    user: AuthUser,
    query: { period?: string; from?: string; to?: string; lang?: string; theme?: string },
    acceptLanguage: string | undefined,
    res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang: query.lang, theme: query.theme }, acceptLanguage);
    const payload = await this.rawMaterialsReport.build({
      period: query.period,
      from: query.from,
      to: query.to,
      locale,
      user,
    });
    const buffer = await buildRawMaterialsReportPdf(payload, pdfTheme);
    sendPdf(res, `raw-materials-${payload.period.fromYmd}-${payload.period.toYmd}.pdf`, buffer);
  }

  /** Warehouse print sheet — centered photo + large QR (not the item report). */
  @Get('inventory/items/:id/qr-label')
  @RequirePermissions('inventory.read')
  async inventoryQrLabel(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const item = await this.prisma.inventoryItem.findUniqueOrThrow({
      where: { id },
    });
    const primary =
      locale === 'ar'
        ? item.nameAr || item.nameEn
        : item.nameEn || item.nameAr;
    const secondary =
      locale === 'en' && item.nameAr
        ? item.nameAr
        : locale === 'ar' && item.nameEn
          ? item.nameEn
          : undefined;
    const supplierBarcode = printableScanCode(item.barcode, '');
    const qrPayload = inventoryScanPayload(item);
    const photo = await fetchPdfImageBuffer(canonicalInventoryImageUrl(item));
    const details: Array<{ label: string; value: string }> = [
      { label: m.unit, value: item.unit },
      { label: m.minStock, value: String(item.minStock) },
    ];
    if (item.materialType?.trim()) {
      details.push({ label: m.materialType, value: item.materialType.trim() });
    }
    if (item.color?.trim()) {
      details.push({ label: m.color, value: item.color.trim() });
    }
    if (item.size?.trim()) {
      details.push({ label: m.size, value: item.size.trim() });
    }
    if (supplierBarcode) {
      details.push({ label: m.supplierBarcode, value: supplierBarcode });
    }

    const buffer = await buildInventoryLabelPdf({
      locale,
      theme: pdfTheme,
      title: primary,
      subtitle: secondary,
      sku: item.sku,
      scanCode: qrPayload,
      details,
      hint: m.labelScanHint,
      image: photo ?? undefined,
    });
    sendPdf(res, `qr-label-${item.sku}.pdf`, buffer);
  }

  /** Floor print sheet for a WIP kit QR. */
  @Get('inventory/wip-kits/:id/qr-label')
  @RequirePermissions('inventory.read')
  async wipKitQrLabel(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const kit = await this.prisma.wipKit.findUnique({
      where: { id },
      include: {
        productionOrder: {
          select: {
            number: true,
            productDescription: true,
            product: {
              select: { nameEn: true, nameAr: true, nameHe: true, sku: true, imageUrl: true },
            },
          },
        },
        stageInstance: {
          include: {
            stageDefinition: {
              select: { code: true, nameEn: true, nameAr: true, nameHe: true },
            },
          },
        },
        location: { select: { code: true, name: true } },
        pieces: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          include: {
            photoDocument: { select: { storageKey: true } },
          },
        },
      },
    });
    if (!kit) {
      throw new NotFoundException({ code: 'WIP_KIT_NOT_FOUND', message: 'WIP kit not found.' });
    }

    const stage = kit.stageInstance.stageDefinition;
    const stageName =
      locale === 'ar'
        ? stage.nameAr || stage.nameEn
        : locale === 'he' && stage.nameHe
          ? stage.nameHe
          : stage.nameEn;
    const product = kit.productionOrder.product;
    const primary = product
      ? localizedName(locale, product)
      : kit.productionOrder.productDescription;
    const scanCode = wipKitScanPayload(kit);
    const photo =
      (await this.bufferFromStorageKey(kit.pieces[0]?.photoDocument?.storageKey)) ??
      (await fetchPdfImageBuffer(product?.imageUrl));

    const details: Array<{ label: string; value: string }> = [
      { label: 'PO', value: kit.productionOrder.number },
      { label: 'Stage', value: stageName },
      { label: 'Pieces', value: String(kit.expectedPieceCount) },
    ];
    if (kit.location) {
      details.push({
        label: m.warehouse,
        value: kit.location.name?.trim() || kit.location.code,
      });
    }

    const buffer = await buildInventoryLabelPdf({
      locale,
      theme: pdfTheme,
      title: primary,
      subtitle: `${kit.productionOrder.number} · ${stageName}`,
      sku: kit.qrCode,
      scanCode,
      details,
      hint: m.labelScanHint,
      image: photo ?? undefined,
    });
    sendPdf(res, `wip-kit-${kit.qrCode}.pdf`, buffer);
  }

  /** Floor print sheet for a single WIP piece QR. */
  @Get('inventory/wip-pieces/:id/qr-label')
  @RequirePermissions('inventory.read')
  async wipPieceQrLabel(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const piece = await this.prisma.wipPiece.findUnique({
      where: { id },
      include: {
        photoDocument: { select: { storageKey: true } },
        kit: {
          include: {
            productionOrder: {
              select: {
                number: true,
                productDescription: true,
                product: {
                  select: { nameEn: true, nameAr: true, nameHe: true, sku: true, imageUrl: true },
                },
              },
            },
            stageInstance: {
              include: {
                stageDefinition: {
                  select: { code: true, nameEn: true, nameAr: true, nameHe: true },
                },
              },
            },
            location: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!piece) {
      throw new NotFoundException({
        code: 'WIP_PIECE_NOT_FOUND',
        message: 'WIP piece not found.',
      });
    }

    const kit = piece.kit;
    const stage = kit.stageInstance.stageDefinition;
    const stageName =
      locale === 'ar'
        ? stage.nameAr || stage.nameEn
        : locale === 'he' && stage.nameHe
          ? stage.nameHe
          : stage.nameEn;
    const product = kit.productionOrder.product;
    const primary = product
      ? localizedName(locale, product)
      : kit.productionOrder.productDescription;
    const scanCode = wipPieceScanPayload(piece);
    const photo =
      (await this.bufferFromStorageKey(piece.photoDocument?.storageKey)) ??
      (await fetchPdfImageBuffer(product?.imageUrl));
    const pieceLabel = piece.label?.trim() || `Piece ${piece.sortOrder + 1}`;

    const details: Array<{ label: string; value: string }> = [
      { label: 'PO', value: kit.productionOrder.number },
      { label: 'Stage', value: stageName },
      { label: 'Piece', value: pieceLabel },
      { label: 'Kit', value: kit.qrCode },
    ];
    if (kit.location) {
      details.push({
        label: m.warehouse,
        value: kit.location.name?.trim() || kit.location.code,
      });
    }

    const buffer = await buildInventoryLabelPdf({
      locale,
      theme: pdfTheme,
      title: primary,
      subtitle: `${kit.productionOrder.number} · ${pieceLabel}`,
      sku: piece.qrCode || kit.qrCode,
      scanCode,
      details,
      hint: m.labelScanHint,
      image: photo ?? undefined,
    });
    sendPdf(res, `wip-piece-${piece.qrCode || piece.id}.pdf`, buffer);
  }

  @Get('inventory/lots/:id/qr-label')
  @RequirePermissions('inventory.read')
  async fabricLotQrLabel(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('theme') theme: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res() res: Response,
  ) {
    const { locale, theme: pdfTheme } = this.opts({ lang, theme }, acceptLanguage);
    const m = pdfMessages(locale);
    const lot = await this.prisma.inventoryLot.findUnique({
      where: { id },
      include: {
        inventoryItem: true,
        warehouse: true,
        location: true,
        salesOrder: { select: { number: true } },
        fabricProcurement: {
          include: {
            requirement: {
              select: { requestedFabricLabel: true, fabricRole: true, stageCode: true },
            },
          },
        },
      },
    });
    if (!lot) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lot not found.' });
    }
    const label =
      lot.fabricProcurement?.requirement.requestedFabricLabel ||
      lot.inventoryItem.nameEn ||
      lot.inventoryItem.sku;
    const scanCode = printableScanCode(lot.qrCode, '');
    const details: Array<{ label: string; value: string }> = [
      { label: m.unit, value: `${Number(lot.remainingQty ?? lot.quantity)} ${lot.inventoryItem.unit}` },
    ];
    if (lot.salesOrder?.number) details.push({ label: 'Order', value: lot.salesOrder.number });
    if (lot.fabricProcurement?.requirement.fabricRole) {
      details.push({ label: 'Placement', value: lot.fabricProcurement.requirement.fabricRole });
    }
    if (lot.location?.code) details.push({ label: 'Location', value: lot.location.code });
    const buffer = await buildInventoryLabelPdf({
      locale,
      theme: pdfTheme,
      title: label,
      subtitle: lot.qrCode ?? lot.inventoryItem.sku,
      sku: lot.qrCode ?? lot.inventoryItem.sku,
      scanCode,
      details,
      hint: m.labelScanHint,
    });
    sendPdf(res, `fabric-lot-${lot.qrCode || lot.id}.pdf`, buffer);
  }

  private async bufferFromStorageKey(key: string | null | undefined): Promise<Buffer | null> {
    const trimmed = key?.trim();
    if (!trimmed) return null;
    try {
      const stream = await this.storage.getObjectStream(trimmed);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buf = Buffer.concat(chunks);
      if (buf.byteLength < 32 || buf.byteLength > 8_000_000) return null;
      return buf;
    } catch {
      return null;
    }
  }
}
