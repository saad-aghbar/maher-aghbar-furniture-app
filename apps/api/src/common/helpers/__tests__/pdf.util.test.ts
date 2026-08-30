import { inflateSync } from 'node:zlib';
import {
  buildInventoryItemReportPdf,
  buildInventoryLabelPdf,
  buildSimplePdf,
  printableScanCode,
  shapePdfText,
  splitScriptRuns,
  visualRuns,
} from '../pdf.util';

jest.retryTimes(1);
jest.setTimeout(120_000);

function pageCount(buf: Buffer): number {
  const text = buf.toString('latin1');
  return text.match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0;
}

function inflatePdfStrings(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const chunks: string[] = [raw];
  const re =
    /<<\r?\n\/Length (\d+)\r?\n\/Filter \/FlateDecode\r?\n>>\r?\nstream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const len = Number(m[1]);
    const start = m.index + m[0].length;
    try {
      const bytes = Buffer.from(raw.slice(start, start + len), 'latin1');
      chunks.push(inflateSync(bytes).toString('utf16le'));
      chunks.push(inflateSync(bytes).toString('utf8'));
      chunks.push(inflateSync(bytes).toString('latin1'));
    } catch {
      /* not flate */
    }
  }
  return chunks.join('\n');
}

/** Helvetica WinAnsi hex fragments concatenated, e.g. <496e><76><6f696365> → Invoice. */
function decodeWinAnsi(buf: Buffer): string {
  const inflated = inflatePdfStrings(buf);
  return [...inflated.matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((m) => {
      try {
        return Buffer.from(m[1]!, 'hex').toString('latin1');
      } catch {
        return '';
      }
    })
    .join('');
}

function pdfHasLatin(buf: Buffer, needle: string): boolean {
  return decodeWinAnsi(buf).includes(needle);
}

function pdfHasOutlines(buf: Buffer): boolean {
  const inflated = inflatePdfStrings(buf);
  return /\s[mv]\s/.test(inflated) && inflated.includes(' cm\n');
}

function pdfRaw(buf: Buffer): string {
  return buf.toString('latin1');
}

function imageXObjectCount(buf: Buffer): number {
  return (pdfRaw(buf).match(/\/Subtype\s*\/Image/g) ?? []).length;
}

describe('shapePdfText', () => {
  it('leaves English unchanged', () => {
    expect(shapePdfText('Payment receipt', 'en')).toBe('Payment receipt');
  });

  it('does not reshape Arabic into presentation forms or reverse it', () => {
    expect(shapePdfText('إيصال دفع', 'ar')).toBe('إيصال دفع');
  });

  it('keeps invoice numbers LTR inside Arabic strings', () => {
    expect(shapePdfText('فاتورة INV-2026-00003', 'ar')).toContain(
      'INV-2026-00003',
    );
  });

  it('does not reverse Hebrew titles', () => {
    expect(shapePdfText('חשבונית', 'he')).toBe('חשבונית');
    expect(shapePdfText('חשבונית', 'he')).not.toBe('תינובשח');
  });
});

describe('splitScriptRuns', () => {
  it('keeps Latin invoice numbers on a latin run next to Arabic', () => {
    const runs = splitScriptRuns('فاتورة INV-2026-00003');
    expect(runs.some((r) => r.script === 'latin' && r.text.includes('INV-2026-00003'))).toBe(
      true,
    );
    expect(runs.some((r) => r.script === 'arabic')).toBe(true);
  });

  it('keeps Hebrew gershayim inside the Hebrew run', () => {
    const runs = splitScriptRuns('סה״כ שורה');
    expect(runs.every((r) => r.script === 'hebrew')).toBe(true);
    expect(runs.map((r) => r.text).join('')).toContain('\u05F4');
  });

  it('isolates colon and slash so RTL paint can keep them between label and value', () => {
    const sku = splitScriptRuns('رمز الصنف: MAT-FAB-ROLL');
    expect(sku.some((r) => r.text === ':')).toBe(true);
    expect(sku.some((r) => r.script === 'arabic' && r.text.includes('رمز'))).toBe(true);
    expect(sku.some((r) => r.script === 'latin' && r.text.includes('MAT-FAB-ROLL'))).toBe(
      true,
    );

    const hint = splitScriptRuns('فاتورة INV-2026-00003 / PAY-2026');
    expect(hint.some((r) => r.text === '/')).toBe(true);
  });
});

describe('visualRuns', () => {
  it('reverses run order for RTL without reversing characters inside a run', () => {
    const runs = splitScriptRuns('رمز الصنف: MAT-FAB-ROLL');
    const visual = visualRuns(runs, true);
    expect(visual[0]?.text).toContain('MAT-FAB-ROLL');
    expect(visual.some((r) => r.text === ':')).toBe(true);
    expect(visual[visual.length - 1]?.script).toBe('arabic');
    expect(visual[visual.length - 1]?.text).toBe('رمز الصنف');
    expect(visualRuns(runs, false)).toEqual(runs);
  });
});

describe('printableScanCode', () => {
  it('drops Expo and http(s) mock URLs', () => {
    expect(printableScanCode('exp://192.168.1.16:8082')).toBe('—');
    expect(printableScanCode('https://example.com', 'MAT-FAB-ROLL')).toBe(
      'MAT-FAB-ROLL',
    );
    expect(printableScanCode('MAT-FAB-ROLL')).toBe('MAT-FAB-ROLL');
  });
});

describe('buildSimplePdf', () => {
  jest.setTimeout(60_000);

  const invoiceRows = [
    ['Walnut dining table 220cm', '1', '1850.000', '1850.000'],
    ['Upholstered side chair', '6', '240.000', '1440.000'],
  ];

  const statementRows = Array.from({ length: 16 }, (_, i) => [
    `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
    `INV-2026-${String(i + 1).padStart(5, '0')}`,
    i % 3 === 0
      ? `Payment PAY-2026-${String(i + 1).padStart(5, '0')}`
      : `Invoice INV-2026-${String(i + 1).padStart(5, '0')}`,
    i % 3 === 0 ? '0.000' : '1200.000',
    i % 3 === 0 ? '400.000' : '0.000',
    String(1000 + i * 100),
  ]);

  it('embeds English Invoice / INV-2026 as Helvetica (no CID fonts)', async () => {
    const buf = await buildSimplePdf({
      locale: 'en',
      theme: 'white',
      title: 'Invoice',
      subtitle: 'INV-2026-00003',
      meta: ['Customer: Nile Decor', 'Status: ISSUED'],
      columns: ['Description', 'Qty', 'Unit price', 'Line total'],
      rows: invoiceRows,
      footerLines: ['Total: 3290.000 ILS', 'Outstanding: 0.000 ILS'],
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(buf)).toBe(1);
    expect(pdfHasLatin(buf, 'Invoice')).toBe(true);
    expect(pdfHasLatin(buf, 'INV-2026')).toBe(true);
    expect(pdfRaw(buf)).toMatch(/\/BaseFont\s*\/Helvetica/);
    expect(pdfRaw(buf)).not.toMatch(/Identity-H/);
    expect(pdfRaw(buf)).not.toMatch(/NotoSans|NotoNaskh|KOSans/);
  });

  it('does not spill contact chrome onto extra pages for a 16-row statement', async () => {
    const buf = await buildSimplePdf({
      locale: 'ar',
      theme: 'white',
      title: 'كشف حساب',
      subtitle: 'ديكور النيل',
      meta: ['حتى تاريخ: 2026-08-12', 'الرصيد الختامي: 53116.778 ILS'],
      columns: ['التاريخ', 'المرجع', 'الوصف', 'مدين', 'دائن', 'الرصيد'],
      rows: statementRows,
      footerLines: ['الرصيد الختامي: 53116.778 ILS'],
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(buf)).toBeLessThanOrEqual(2);
    expect(pdfHasOutlines(buf)).toBe(true);
    expect(pdfHasLatin(buf, 'ILS')).toBe(true);
    expect(pdfHasLatin(buf, 'INV-2026-00003')).toBe(true);
    expect(pdfHasLatin(buf, 'INV-2026-00016')).toBe(true);
    expect(pdfHasLatin(buf, 'INV-2026-00...')).toBe(false);
    expect(pdfRaw(buf)).toMatch(/\/BaseFont\s*\/Helvetica/);
    expect(pdfRaw(buf)).not.toMatch(/Identity-H/);
    expect(pdfRaw(buf)).not.toMatch(/NotoNaskhArabic|KOSans/);
    const inflated = inflatePdfStrings(buf);
    expect(/<fe[7-9a-f][0-9a-f]>/i.test(inflated)).toBe(false);
  });

  it('keeps Hebrew titles as outlines and latin invoice numbers in Helvetica', async () => {
    const buf = await buildSimplePdf({
      locale: 'he',
      theme: 'brown',
      title: 'קבלת תשלום',
      subtitle: 'PAY-2026-00002',
      meta: ['לקוח: Nile Decor', 'תאריך: 2026-08-01'],
      columns: ['שדה', 'ערך'],
      rows: [
        ['מספר תשלום', 'PAY-2026-00002'],
        ['סכום', '5738.133 ILS'],
        ['חשבונית', 'INV-2026-00003'],
      ],
      footerLines: ['הוחל על חשבונית INV-2026-00003'],
    });
    expect(pageCount(buf)).toBe(1);
    expect(pdfHasOutlines(buf)).toBe(true);
    expect(pdfHasLatin(buf, 'INV-2026')).toBe(true);
    expect(pdfHasLatin(buf, 'PAY-2026')).toBe(true);
    expect(pdfHasLatin(buf, 'Nile Decor')).toBe(true);
    expect(pdfRaw(buf)).not.toMatch(/Identity-H/);
    expect(pdfRaw(buf)).not.toMatch(/NotoSansHebrew|KOSans/);
  });

  it(
    'renders invoice, payment, and statement in every language and theme',
    async () => {
      const langs = ['en', 'ar', 'he'] as const;
      const themes = ['white', 'brown'] as const;
      const docs = [
        {
          title: { en: 'Invoice', ar: 'فاتورة', he: 'חשבונית' },
          subtitle: 'INV-2026-00003',
          columns: {
            en: ['Description', 'Qty', 'Unit price', 'Line total'],
            ar: ['الوصف', 'الكمية', 'سعر الوحدة', 'الإجمالي'],
            he: ['תיאור', 'כמות', 'מחיר יחידה', 'סה״כ שורה'],
          },
          rows: invoiceRows,
          footerLines: ['Total: 3290.000 ILS'],
        },
        {
          title: { en: 'Payment receipt', ar: 'إيصال دفع', he: 'קבלת תשלום' },
          subtitle: 'PAY-2026-00002',
          columns: {
            en: ['Field', 'Value'],
            ar: ['الحقل', 'القيمة'],
            he: ['שדה', 'ערך'],
          },
          rows: [
            ['Payment number', 'PAY-2026-00002'],
            ['Amount', '5738.133 ILS'],
          ],
          footerLines: ['Applied to invoice INV-2026-00003'],
        },
        {
          title: {
            en: 'Statement of account',
            ar: 'كشف حساب',
            he: 'דף חשבון',
          },
          subtitle: 'Nile Decor',
          columns: {
            en: ['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance'],
            ar: ['التاريخ', 'المرجع', 'الوصف', 'مدين', 'دائن', 'الرصيد'],
            he: ['תאריך', 'אסמכתא', 'תיאור', 'חובה', 'זכות', 'יתרה'],
          },
          rows: statementRows,
          footerLines: ['Closing: 53116.778 ILS'],
        },
      ];

      for (const locale of langs) {
        for (const theme of themes) {
          for (const spec of docs) {
            const buf = await buildSimplePdf({
              locale,
              theme,
              title: spec.title[locale],
              subtitle: spec.subtitle,
              columns: spec.columns[locale],
              rows: spec.rows,
              footerLines: spec.footerLines,
            });
            expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
            expect(pageCount(buf)).toBeGreaterThanOrEqual(1);
            expect(pageCount(buf)).toBeLessThanOrEqual(2);
            expect(pdfRaw(buf)).not.toMatch(/Identity-H/);
            expect(
              pdfHasLatin(buf, 'INV-2026') ||
                pdfHasLatin(buf, 'PAY-2026') ||
                pdfHasLatin(buf, 'Nile') ||
                pdfHasLatin(buf, 'Closing') ||
                pdfHasLatin(buf, 'Total'),
            ).toBe(true);
            if (locale !== 'en') {
              expect(pdfHasOutlines(buf)).toBe(true);
            }
          }
        }
      }
    },
    120000,
  );

  it('embeds a scannable QR image and ignores exp:// payloads', async () => {
    const label = {
      locale: 'ar' as const,
      theme: 'white' as const,
      title: 'رول قماش تنجيد',
      subtitle: 'Upholstery fabric roll',
      meta: ['رمز الصنف: MAT-FAB-ROLL', 'الباركود: —', 'الوحدة: m'],
      columns: ['الحقل', 'القيمة'],
      rows: [
        ['رمز الصنف', 'MAT-FAB-ROLL'],
        ['الباركود', '—'],
        ['الحد الأدنى', '80'],
      ],
      footerLines: ['امسح الرمز في المستودع'],
    };
    const without = await buildSimplePdf(label);
    const withQr = await buildSimplePdf({
      ...label,
      qr: { payload: 'MAT-FAB-ROLL' },
    });
    const mockQr = await buildSimplePdf({
      ...label,
      qr: { payload: 'exp://192.168.1.16:8082' },
    });

    expect(imageXObjectCount(withQr)).toBeGreaterThan(imageXObjectCount(without));
    expect(imageXObjectCount(mockQr)).toBe(imageXObjectCount(without));
    expect(pdfRaw(withQr)).not.toContain('exp://');
    expect(pdfHasLatin(withQr, 'MAT-FAB-ROLL')).toBe(true);
    expect(pdfHasOutlines(withQr)).toBe(true);
  });

  it('embeds an optional material photo as an extra image XObject', async () => {
    // 1×1 PNG
    const photo = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const base = {
      locale: 'en' as const,
      theme: 'white' as const,
      title: 'Boucle cream roll',
      sku: 'MAT-BOU-CRM',
      scanCode: 'MAT-BOU-CRM',
      details: [
        { label: 'Unit', value: 'm' },
        { label: 'Min stock', value: '35' },
      ],
      hint: 'Scan barcode / QR at warehouse stations',
    };
    const withoutPhoto = await buildInventoryLabelPdf(base);
    const withPhoto = await buildInventoryLabelPdf({ ...base, image: photo });
    expect(imageXObjectCount(withPhoto)).toBeGreaterThan(imageXObjectCount(withoutPhoto));
    expect(pdfHasLatin(withPhoto, 'Boucle cream roll')).toBe(true);
    // SKU is encoded in the QR only — not printed as a separate text line.
    expect(pdfHasLatin(withPhoto, 'MAT-BOU-CRM')).toBe(false);
  });

  it('inventory label stays one centered page in Arabic', async () => {
    const buf = await buildInventoryLabelPdf({
      locale: 'ar',
      theme: 'white',
      title: 'رول قماش بوكل',
      subtitle: 'Boucle cream roll',
      sku: 'MAT-BOU-CRM',
      scanCode: 'MAT-BOU-CRM',
      details: [
        { label: 'الوحدة', value: 'm' },
        { label: 'الحد الأدنى', value: '35' },
      ],
      hint: 'امسح الرمز في المستودع',
    });
    expect(pageCount(buf)).toBe(1);
    expect(pdfHasLatin(buf, 'Boucle cream roll')).toBe(true);
    expect(imageXObjectCount(buf)).toBeGreaterThan(0);
  });
});

describe('buildInventoryItemReportPdf', () => {
  it('embeds QR and report title; soft-fails without image', async () => {
    const without = await buildInventoryItemReportPdf({
      locale: 'en',
      theme: 'white',
      reportTitle: 'Inventory Item Report',
      companyLine: 'Maher Furniture',
      generatedLabel: 'Generated',
      generatedAt: '24 Aug 2026, 13:15',
      itemName: 'Italian Velvet',
      itemSku: 'MAT-ITAL-VEL',
      identityRows: [
        ['SKU', 'MAT-ITAL-VEL'],
        ['Unit', 'm'],
      ],
      sections: [
        {
          title: 'Current stock',
          pairs: [
            ['On hand', '0 m'],
            ['Incoming', '24 m'],
          ],
        },
      ],
      scanTitle: 'Scan this item',
      scanHint: 'Scan this code in Inventory to open this item.',
      scanCode: 'MAT-ITAL-VEL',
      scanName: 'Italian Velvet',
      scanSku: 'MAT-ITAL-VEL',
    });
    expect(without.slice(0, 5).toString()).toBe('%PDF-');
    expect(pdfHasLatin(without, 'Inventory Item Report')).toBe(true);
    expect(pdfHasLatin(without, 'MAT-ITAL-VEL')).toBe(true);
    expect(imageXObjectCount(without)).toBeGreaterThan(0); // QR
  });
});
