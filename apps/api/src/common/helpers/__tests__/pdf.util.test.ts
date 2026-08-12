import { inflateSync } from 'node:zlib';
import {
  buildSimplePdf,
  shapePdfText,
  splitScriptRuns,
} from '../pdf.util';

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
});

describe('buildSimplePdf', () => {
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
      footerLines: ['Total: 3290.000 JOD', 'Outstanding: 0.000 JOD'],
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
      meta: ['حتى تاريخ: 2026-08-12', 'الرصيد الختامي: 53116.778 JOD'],
      columns: ['التاريخ', 'المرجع', 'الوصف', 'مدين', 'دائن', 'الرصيد'],
      rows: statementRows,
      footerLines: ['الرصيد الختامي: 53116.778 JOD'],
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(buf)).toBeLessThanOrEqual(2);
    expect(pdfHasOutlines(buf)).toBe(true);
    expect(pdfHasLatin(buf, 'JOD')).toBe(true);
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
        ['סכום', '5738.133 JOD'],
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
          footerLines: ['Total: 3290.000 JOD'],
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
            ['Amount', '5738.133 JOD'],
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
          footerLines: ['Closing: 53116.778 JOD'],
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
    30000,
  );
});
