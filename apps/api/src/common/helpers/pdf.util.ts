import path from 'node:path';
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import fontkit from 'fontkit';

export type PdfLocale = 'en' | 'ar' | 'he';
export type PdfTheme = 'white' | 'brown';

export type PdfTableRow = (string | number)[];

export interface SimplePdfDoc {
  title: string;
  subtitle?: string;
  meta?: string[];
  columns: string[];
  rows: PdfTableRow[];
  footerLines?: string[];
  locale?: PdfLocale;
  theme?: PdfTheme;
}

export type PdfRenderOptions = {
  locale?: PdfLocale;
  theme?: PdfTheme;
};

type GlyphCommand = { command: string; args: number[] };
type FkFont = {
  unitsPerEm: number;
  ascent: number;
  layout: (
    text: string,
    features?: string[],
  ) => {
    glyphs: { path: { commands: GlyphCommand[] } }[];
    positions: {
      xAdvance: number;
      yAdvance: number;
      xOffset: number;
      yOffset: number;
    }[];
    advanceWidth: number;
  };
};

const ASSETS = (() => {
  const candidates = [
    path.join(process.cwd(), 'assets'),
    path.join(process.cwd(), 'apps/api/assets'),
    path.join(__dirname, '..', '..', '..', 'assets'),
    path.join(__dirname, '..', '..', '..', '..', 'assets'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'fonts'))) return c;
  }
  return candidates[0]!;
})();
const FONT_DIR = path.join(ASSETS, 'fonts');
const BRAND_DIR = path.join(ASSETS, 'brand');

const PAGE_MARGIN = 44;
const HEADER_BOTTOM = 124;
const FOOTER_TOP_OFFSET = 64;
const LOCKUP_WIDTH = 158;
const LOCKUP_Y = 18;
const TILE = 78;
const TILE_GAP = 36;
/** Helvetica em-ascent — shared baseline so mixed EN/AR/HE sit on one line. */
const LATIN_ASCENT = 0.718;

const ARABIC_FEATURES = [
  'ccmp',
  'locl',
  'rlig',
  'calt',
  'init',
  'medi',
  'fina',
  'isol',
];

const THEME = {
  white: {
    page: '#FFFFFF',
    text: '#1E1A1B',
    muted: '#5C574F',
    accent: '#1E1A1B',
    rule: '#D8D4CE',
    lockup: path.join(BRAND_DIR, 'lockup-on-light.png'),
    field: path.join(BRAND_DIR, 'watermark-field-on-light.png'),
    mark: path.join(BRAND_DIR, 'watermark-mark.png'),
    watermarkOpacity: 0.12,
    markOpacity: 0.06,
  },
  brown: {
    page: '#2A1E17',
    text: '#F5F1EA',
    muted: '#C8C0B4',
    accent: '#F5F1EA',
    rule: '#5A4A3E',
    lockup: path.join(BRAND_DIR, 'lockup-on-dark.png'),
    field: path.join(BRAND_DIR, 'watermark-field-on-dark.png'),
    mark: path.join(BRAND_DIR, 'watermark-mark-dark.png'),
    watermarkOpacity: 0.16,
    markOpacity: 0.08,
  },
} as const;

type Palette = (typeof THEME)[PdfTheme];
type Fonts = {
  latin: 'Helvetica';
  latinBold: 'Helvetica-Bold';
  arabic: FkFont | null;
  arabicBold: FkFont | null;
  hebrew: FkFont | null;
  hebrewBold: FkFont | null;
};
type ScriptKind = 'latin' | 'arabic' | 'hebrew';
type ScriptRun = { script: ScriptKind; text: string };

function resolveLocale(raw?: string | null): PdfLocale {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  if (v === 'ar' || v === 'he') return v;
  return 'en';
}

function resolveTheme(raw?: string | null): PdfTheme {
  return String(raw ?? '')
    .trim()
    .toLowerCase() === 'brown'
    ? 'brown'
    : 'white';
}

/** Parse `?lang=` / `?theme=` with Accept-Language fallback. */
export function parsePdfQuery(query: {
  lang?: string;
  theme?: string;
  acceptLanguage?: string | string[];
}): { locale: PdfLocale; theme: PdfTheme; rtl: boolean } {
  const fromAccept = Array.isArray(query.acceptLanguage)
    ? query.acceptLanguage[0]
    : query.acceptLanguage;
  const locale = resolveLocale(query.lang || fromAccept);
  const theme = resolveTheme(query.theme);
  return { locale, theme, rtl: locale === 'ar' || locale === 'he' };
}

function companyContact(locale: PdfLocale) {
  const nameEn = process.env.COMPANY_NAME_EN ?? 'Maher Al-Aghbar & Sons Furniture';
  const nameAr = process.env.COMPANY_NAME_AR ?? 'مفروشات ماهر الأغبر وأولاده';
  return {
    name: locale === 'ar' ? nameAr : nameEn,
    address: process.env.COMPANY_ADDRESS ?? '0000 Nablus, Palestine',
    phone: process.env.COMPANY_PHONE ?? '+970 000 000 000',
    email: process.env.COMPANY_EMAIL ?? 'contact@maher-f.co',
    website: process.env.COMPANY_WEBSITE ?? 'www.mfurniture.com',
  };
}

/**
 * Identity helper — do not reshape or reverse. Presentation forms and
 * visual reversal caused NO GLYPH / backwards Hebrew on iOS.
 */
export function shapePdfText(input: string, _locale?: PdfLocale): string {
  return String(input ?? '');
}

function scriptOf(ch: string): ScriptKind {
  const c = ch.codePointAt(0) ?? 0;
  if (c >= 0x0590 && c <= 0x05ff) return 'hebrew';
  if (
    (c >= 0x0600 && c <= 0x06ff) ||
    (c >= 0x0750 && c <= 0x077f) ||
    (c >= 0x08a0 && c <= 0x08ff) ||
    (c >= 0xfb50 && c <= 0xfdff) ||
    (c >= 0xfe70 && c <= 0xfeff)
  ) {
    return 'arabic';
  }
  return 'latin';
}

export function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  for (const ch of String(text ?? '')) {
    const inherit = /\s/.test(ch);
    const script = inherit && runs.length ? runs[runs.length - 1]!.script : scriptOf(ch);
    const last = runs[runs.length - 1];
    if (last && last.script === script) last.text += ch;
    else runs.push({ script, text: ch });
  }
  return runs.filter((r) => r.text.length > 0);
}

function openOutlineFont(fileName: string, label: string): FkFont | null {
  const filePath = path.join(FONT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.error(`[pdf] Missing ${label} font: ${filePath}`);
    return null;
  }
  try {
    return fontkit.openSync(filePath) as unknown as FkFont;
  } catch (err) {
    console.error(`[pdf] Failed to open ${label} font: ${filePath}`, err);
    return null;
  }
}

let cachedFonts: Fonts | null = null;

function loadFonts(): Fonts {
  if (cachedFonts) return cachedFonts;
  cachedFonts = {
    latin: 'Helvetica',
    latinBold: 'Helvetica-Bold',
    arabic: openOutlineFont('NotoNaskhArabic-Regular.ttf', 'Noto Naskh Arabic Regular'),
    arabicBold: openOutlineFont('NotoNaskhArabic-Bold.ttf', 'Noto Naskh Arabic Bold'),
    hebrew: openOutlineFont('NotoSansHebrew-Regular.ttf', 'Noto Sans Hebrew Regular'),
    hebrewBold: openOutlineFont('NotoSansHebrew-Bold.ttf', 'Noto Sans Hebrew Bold'),
  };
  return cachedFonts;
}

function outlineFontFor(fonts: Fonts, script: ScriptKind, bold: boolean): FkFont | null {
  if (script === 'arabic') return bold ? fonts.arabicBold ?? fonts.arabic : fonts.arabic;
  if (script === 'hebrew') return bold ? fonts.hebrewBold ?? fonts.hebrew : fonts.hebrew;
  return null;
}

function featuresFor(script: ScriptKind): string[] | undefined {
  return script === 'arabic' ? ARABIC_FEATURES : undefined;
}

function measureLatin(
  doc: PDFKit.PDFDocument,
  text: string,
  size: number,
  bold: boolean,
  fonts: Fonts,
): number {
  doc.font(bold ? fonts.latinBold : fonts.latin).fontSize(size);
  return doc.widthOfString(text);
}

function measureOutline(font: FkFont, text: string, script: ScriptKind, size: number): number {
  const run = font.layout(text, featuresFor(script));
  return (run.advanceWidth / font.unitsPerEm) * size;
}

function measureRun(
  doc: PDFKit.PDFDocument,
  fonts: Fonts,
  run: ScriptRun,
  size: number,
  bold: boolean,
): number {
  if (run.script === 'latin') return measureLatin(doc, run.text, size, bold, fonts);
  const font = outlineFontFor(fonts, run.script, bold);
  if (!font) return measureLatin(doc, run.text, size, bold, fonts);
  return measureOutline(font, run.text, run.script, size);
}

function measureRuns(
  doc: PDFKit.PDFDocument,
  fonts: Fonts,
  runs: ScriptRun[],
  size: number,
  bold: boolean,
): number {
  return runs.reduce((sum, run) => sum + measureRun(doc, fonts, run, size, bold), 0);
}

function paintGlyphPath(doc: PDFKit.PDFDocument, commands: GlyphCommand[]) {
  if (!commands.length) return;
  for (const cmd of commands) {
    const a = cmd.args;
    if (cmd.command === 'moveTo') doc.moveTo(a[0]!, a[1]!);
    else if (cmd.command === 'lineTo') doc.lineTo(a[0]!, a[1]!);
    else if (cmd.command === 'quadraticCurveTo') {
      doc.quadraticCurveTo(a[0]!, a[1]!, a[2]!, a[3]!);
    } else if (cmd.command === 'bezierCurveTo') {
      doc.bezierCurveTo(a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!);
    } else if (cmd.command === 'closePath') doc.closePath();
  }
  doc.fill();
}

function drawOutlined(
  doc: PDFKit.PDFDocument,
  font: FkFont,
  text: string,
  script: ScriptKind,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const run = font.layout(text, featuresFor(script));
  const scale = size / font.unitsPerEm;
  const baseline = y + size * LATIN_ASCENT;
  doc.save();
  doc.fillColor(color);
  doc.translate(x, baseline);
  doc.scale(scale, -scale);
  let gx = 0;
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i]!;
    const pos = run.positions[i]!;
    doc.save();
    doc.translate(gx + (pos.xOffset || 0), pos.yOffset || 0);
    paintGlyphPath(doc, glyph.path.commands);
    doc.restore();
    gx += pos.xAdvance;
  }
  doc.restore();
}

function drawLatin(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  size: number,
  bold: boolean,
  color: string,
  fonts: Fonts,
) {
  const savedX = doc.x;
  const savedY = doc.y;
  doc
    .font(bold ? fonts.latinBold : fonts.latin)
    .fontSize(size)
    .fillColor(color)
    .text(text, x, y, { lineBreak: false, height: size + 6 });
  doc.x = savedX;
  doc.y = savedY;
}

function paintLine(
  doc: PDFKit.PDFDocument,
  runs: ScriptRun[],
  opts: {
    x: number;
    y: number;
    width: number;
    align: 'left' | 'right' | 'center';
    size: number;
    bold: boolean;
    color: string;
    fonts: Fonts;
  },
) {
  if (!runs.length) return;
  const widths = runs.map((run) =>
    measureRun(doc, opts.fonts, run, opts.size, opts.bold),
  );
  const total = widths.reduce((a, b) => a + b, 0);
  let cursor =
    opts.align === 'right'
      ? opts.x + opts.width - Math.min(total, opts.width)
      : opts.align === 'center'
        ? opts.x + Math.max(0, (opts.width - total) / 2)
        : opts.x;

  runs.forEach((run, i) => {
    if (run.script === 'latin') {
      drawLatin(
        doc,
        run.text,
        cursor,
        opts.y,
        opts.size,
        opts.bold,
        opts.color,
        opts.fonts,
      );
    } else {
      const font = outlineFontFor(opts.fonts, run.script, opts.bold);
      if (font) {
        drawOutlined(
          doc,
          font,
          run.text,
          run.script,
          cursor,
          opts.y,
          opts.size,
          opts.color,
        );
      } else {
        drawLatin(
          doc,
          run.text,
          cursor,
          opts.y,
          opts.size,
          opts.bold,
          opts.color,
          opts.fonts,
        );
      }
    }
    cursor += widths[i] ?? 0;
  });
}

function ellipsizeRuns(
  doc: PDFKit.PDFDocument,
  fonts: Fonts,
  raw: string,
  maxWidth: number,
  size: number,
  bold: boolean,
): ScriptRun[] {
  const full = splitScriptRuns(raw);
  if (measureRuns(doc, fonts, full, size, bold) <= maxWidth) return full;
  const dots = '...';
  const dotsW = measureLatin(doc, dots, size, bold, fonts);
  const chars = [...raw];
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const w =
      measureRuns(doc, fonts, splitScriptRuns(chars.slice(0, mid).join('')), size, bold) +
      dotsW;
    if (w <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return splitScriptRuns(chars.slice(0, lo).join('') + dots);
}

function wrapToLines(
  doc: PDFKit.PDFDocument,
  fonts: Fonts,
  raw: string,
  maxWidth: number,
  size: number,
  bold: boolean,
): ScriptRun[][] {
  const tokens = String(raw ?? '').split(/(\s+)/).filter((t) => t.length > 0);
  const lines: ScriptRun[][] = [];
  let current: ScriptRun[] = [];
  let currentW = 0;

  const flush = () => {
    if (!current.length) return;
    lines.push(current);
    current = [];
    currentW = 0;
  };

  for (const token of tokens) {
    const runs = splitScriptRuns(token);
    const w = measureRuns(doc, fonts, runs, size, bold);
    if (current.length && currentW + w > maxWidth && !/^\s+$/.test(token)) {
      flush();
    }
    if (!current.length && /^\s+$/.test(token)) continue;
    current = current.concat(runs);
    currentW += w;
  }
  flush();
  return lines.length ? lines : [[]];
}

type DrawTextOpts = {
  x: number;
  y: number;
  width: number;
  align: 'left' | 'right' | 'center';
  height?: number;
  size: number;
  bold?: boolean;
  color: string;
  fonts: Fonts;
  lineBreak?: boolean;
  ellipsis?: boolean;
};

function drawMixedText(
  doc: PDFKit.PDFDocument,
  raw: string,
  opts: DrawTextOpts,
): void {
  const text = String(raw ?? '');
  const bold = !!opts.bold;
  const linePitch = opts.size + 3;

  if (!opts.lineBreak) {
    const runs = opts.ellipsis
      ? ellipsizeRuns(doc, opts.fonts, text, opts.width, opts.size, bold)
      : splitScriptRuns(text);
    paintLine(doc, runs, {
      x: opts.x,
      y: opts.y,
      width: opts.width,
      align: opts.align,
      size: opts.size,
      bold,
      color: opts.color,
      fonts: opts.fonts,
    });
    doc.y = opts.y + (opts.height ?? linePitch);
    return;
  }

  let lines = wrapToLines(doc, opts.fonts, text, opts.width, opts.size, bold);
  const maxLines = opts.height
    ? Math.max(1, Math.floor(opts.height / linePitch))
    : lines.length;
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    if (opts.ellipsis) {
      const last = lines[lines.length - 1] ?? [];
      const lastText = last.map((r) => r.text).join('');
      lines[lines.length - 1] = ellipsizeRuns(
        doc,
        opts.fonts,
        lastText,
        opts.width,
        opts.size,
        bold,
      );
    }
  }
  lines.forEach((runs, i) => {
    paintLine(doc, runs, {
      x: opts.x,
      y: opts.y + i * linePitch,
      width: opts.width,
      align: opts.align,
      size: opts.size,
      bold,
      color: opts.color,
      fonts: opts.fonts,
    });
  });
  doc.y = opts.y + Math.max(lines.length, 1) * linePitch;
}

function measureMixedHeight(
  doc: PDFKit.PDFDocument,
  raw: string,
  width: number,
  fonts: Fonts,
  size: number,
): number {
  const lines = wrapToLines(doc, fonts, raw, width, size, false);
  return Math.max(size + 3, lines.length * (size + 3));
}

type ColKind = 'text' | 'nowrap' | 'money';

function columnKinds(count: number): ColKind[] {
  if (count <= 2) return Array.from({ length: count }, () => 'text');
  if (count === 4) return ['text', 'nowrap', 'money', 'money'];
  if (count === 6) return ['nowrap', 'nowrap', 'text', 'money', 'money', 'money'];
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? 'text' : 'nowrap',
  );
}

function columnWidths(count: number, usable: number): number[] {
  const weights =
    count === 2
      ? [0.38, 0.62]
      : count === 4
        ? [0.44, 0.10, 0.23, 0.23]
        : count === 6
          ? [0.13, 0.22, 0.26, 0.13, 0.13, 0.13]
          : Array.from({ length: count }, () => 1 / count);
  return weights.map((w) => w * usable);
}

/** Logical column keeps its own width; RTL only mirrors the visual order. */
function columnBox(
  logicalIndex: number,
  widths: number[],
  rtl: boolean,
  startX: number,
): { x: number; width: number } {
  const width = widths[logicalIndex] ?? 40;
  if (!rtl) {
    return {
      x: startX + widths.slice(0, logicalIndex).reduce((a, b) => a + b, 0),
      width,
    };
  }
  return {
    x: startX + widths.slice(logicalIndex + 1).reduce((a, b) => a + b, 0),
    width,
  };
}

function drawWatermark(doc: PDFKit.PDFDocument, palette: Palette) {
  const { width, height } = doc.page;
  doc.save();
  try {
    if (fs.existsSync(palette.field)) {
      const fieldW = 976;
      const fieldH = 1248;
      const scale = Math.max(width / fieldW, height / fieldH);
      const dw = fieldW * scale;
      const dh = fieldH * scale;
      doc.opacity(palette.watermarkOpacity);
      doc.image(palette.field, (width - dw) / 2, (height - dh) / 2, {
        width: dw,
        height: dh,
      });
    } else if (fs.existsSync(palette.mark)) {
      doc.opacity(palette.markOpacity);
      const step = TILE + TILE_GAP;
      for (let y = -TILE / 3; y < height; y += step) {
        for (let x = -TILE / 3; x < width; x += step) {
          doc.image(palette.mark, x, y, { width: TILE });
        }
      }
    }
  } catch {
    /* ignore decode errors */
  }
  doc.restore();
}

function drawPageChrome(
  doc: PDFKit.PDFDocument,
  opts: {
    theme: PdfTheme;
    contact: ReturnType<typeof companyContact>;
    fonts: Fonts;
  },
) {
  const palette = THEME[opts.theme];
  const { width, height } = doc.page;

  doc.save();
  doc.rect(0, 0, width, height).fill(palette.page);
  doc.restore();

  drawWatermark(doc, palette);

  if (fs.existsSync(palette.lockup)) {
    try {
      doc.image(palette.lockup, PAGE_MARGIN, LOCKUP_Y, { width: LOCKUP_WIDTH });
    } catch {
      /* ignore */
    }
  }

  const footerY = height - FOOTER_TOP_OFFSET;
  doc.save();
  doc
    .strokeColor(palette.rule)
    .lineWidth(0.6)
    .moveTo(PAGE_MARGIN, footerY)
    .lineTo(width - PAGE_MARGIN, footerY)
    .stroke();

  const lines = [
    opts.contact.address,
    opts.contact.phone,
    opts.contact.email,
    opts.contact.website,
  ];
  let fy = footerY + 8;
  for (const line of lines) {
    drawLatin(doc, line, PAGE_MARGIN, fy, 8, false, palette.muted, opts.fonts);
    fy += 11;
  }
  doc.restore();

  doc.x = PAGE_MARGIN;
  doc.y = HEADER_BOTTOM;
}

function contentBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - FOOTER_TOP_OFFSET - 8;
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  columns: string[],
  widths: number[],
  kinds: ColKind[],
  startX: number,
  palette: Palette,
  fonts: Fonts,
  rtl: boolean,
) {
  const y = doc.y;
  columns.forEach((h, i) => {
    const box = columnBox(i, widths, rtl, startX);
    const kind = kinds[i] ?? 'text';
    const align: 'left' | 'right' =
      kind === 'money' ? 'right' : rtl ? 'right' : 'left';
    drawMixedText(doc, String(h), {
      x: box.x + 2,
      y,
      width: box.width - 4,
      align,
      height: 14,
      size: 8,
      bold: true,
      color: palette.muted,
      fonts,
      lineBreak: false,
      ellipsis: true,
    });
  });
  doc.y = y + 14;
  doc
    .strokeColor(palette.rule)
    .lineWidth(0.7)
    .moveTo(startX, doc.y)
    .lineTo(startX + widths.reduce((a, b) => a + b, 0), doc.y)
    .stroke();
  doc.y += 8;
}

/**
 * Build a branded application/pdf Buffer (white or brown letterhead + watermark).
 */
export async function buildSimplePdf(docSpec: SimplePdfDoc): Promise<Buffer> {
  const locale = resolveLocale(docSpec.locale);
  const theme = resolveTheme(docSpec.theme);
  const rtl = locale === 'ar' || locale === 'he';
  const palette = THEME[theme];
  const contact = companyContact(locale);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: false,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fonts = loadFonts();
    const align: 'left' | 'right' = rtl ? 'right' : 'left';

    doc.on('pageAdded', () => {
      drawPageChrome(doc, { theme, contact, fonts });
    });
    doc.addPage();

    const usable = doc.page.width - PAGE_MARGIN * 2;
    const startX = PAGE_MARGIN;

    drawMixedText(doc, docSpec.title, {
      x: PAGE_MARGIN,
      y: doc.y,
      width: usable,
      align,
      height: 22,
      size: 16,
      bold: true,
      color: palette.accent,
      fonts,
      lineBreak: false,
    });
    doc.y += 6;

    if (docSpec.subtitle) {
      drawMixedText(doc, docSpec.subtitle, {
        x: PAGE_MARGIN,
        y: doc.y,
        width: usable,
        align,
        height: 16,
        size: 11,
        bold: true,
        color: palette.text,
        fonts,
        ellipsis: true,
      });
      doc.y += 4;
    }

    for (const line of docSpec.meta ?? []) {
      if (!line) continue;
      drawMixedText(doc, String(line), {
        x: PAGE_MARGIN,
        y: doc.y,
        width: usable,
        align,
        height: 13,
        size: 9,
        color: palette.muted,
        fonts,
        ellipsis: true,
      });
      doc.y += 2;
    }
    doc.y += 10;

    const colCount = Math.max(docSpec.columns.length, 1);
    const widths = columnWidths(colCount, usable);
    const kinds = columnKinds(colCount);

    const paintHeader = () =>
      drawTableHeader(
        doc,
        docSpec.columns,
        widths,
        kinds,
        startX,
        palette,
        fonts,
        rtl,
      );

    paintHeader();

    const cellAlign = (kind: ColKind): 'left' | 'right' => {
      if (kind === 'money') return 'right';
      return rtl ? 'right' : 'left';
    };

    for (const row of docSpec.rows) {
      const maxH = 28;
      let rowHeight = 14;
      row.forEach((cell, i) => {
        const kind = kinds[i] ?? 'text';
        const colW = (columnBox(i, widths, rtl, startX).width) - 4;
        const raw = String(cell ?? '');
        const h =
          kind === 'text'
            ? Math.min(
                maxH,
                Math.max(12, measureMixedHeight(doc, raw, colW, fonts, 9)),
              )
            : 12;
        rowHeight = Math.max(rowHeight, h);
      });
      rowHeight = Math.min(maxH, rowHeight);

      if (doc.y + rowHeight > contentBottom(doc)) {
        doc.addPage();
        paintHeader();
      }

      const y = doc.y;
      row.forEach((cell, i) => {
        const kind = kinds[i] ?? 'text';
        const box = columnBox(i, widths, rtl, startX);
        drawMixedText(doc, String(cell ?? ''), {
          x: box.x + 2,
          y,
          width: box.width - 4,
          align: cellAlign(kind),
          height: rowHeight,
          size: 9,
          color: palette.text,
          fonts,
          ellipsis: kind === 'text',
          lineBreak: kind === 'text',
        });
      });
      doc.y = y + rowHeight + 5;
    }

    if (docSpec.footerLines?.length) {
      const need = 10 + docSpec.footerLines.length * 16;
      if (doc.y + need > contentBottom(doc)) {
        doc.addPage();
      } else {
        doc.y += 8;
      }
      for (const line of docSpec.footerLines) {
        if (doc.y + 16 > contentBottom(doc)) {
          doc.addPage();
        }
        drawMixedText(doc, String(line), {
          x: PAGE_MARGIN,
          y: doc.y,
          width: usable,
          align,
          height: 14,
          size: 10,
          bold: true,
          color: palette.text,
          fonts,
          ellipsis: true,
        });
        doc.y += 2;
      }
    }

    doc.end();
  });
}

export function sendPdf(
  res: {
    setHeader: (k: string, v: string) => void;
    send: (b: Buffer) => void;
  },
  filename: string,
  buffer: Buffer,
) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
}

export { resolveLocale, resolveTheme, companyContact };
