import PDFDocument from 'pdfkit';

export type PdfTableRow = (string | number)[];

export interface SimplePdfDoc {
  title: string;
  subtitle?: string;
  meta?: string[];
  columns: string[];
  rows: PdfTableRow[];
  footerLines?: string[];
}

/** Build a real application/pdf Buffer (Arabic text may render as Latin fallback glyphs). */
export async function buildSimplePdf(docSpec: SimplePdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#e03c31').fontSize(18).text(docSpec.title, { align: 'left' });
    doc.moveDown(0.3);
    if (docSpec.subtitle) {
      doc.fillColor('#1a1a1a').fontSize(12).text(docSpec.subtitle);
    }
    doc.moveDown(0.5);
    doc.fillColor('#5c5c5c').fontSize(10);
    for (const line of docSpec.meta ?? []) {
      doc.text(line);
    }
    doc.moveDown(1);

    const startX = doc.x;
    const colCount = Math.max(docSpec.columns.length, 1);
    const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colW = usable / colCount;

    doc.fillColor('#1a1a1a').fontSize(10).font('Helvetica-Bold');
    docSpec.columns.forEach((h, i) => {
      doc.text(String(h), startX + i * colW, doc.y, { width: colW - 4, continued: i < colCount - 1 });
    });
    doc.text('');
    doc.moveDown(0.3);
    doc
      .strokeColor('#e5e2de')
      .moveTo(startX, doc.y)
      .lineTo(startX + usable, doc.y)
      .stroke();
    doc.moveDown(0.4);

    doc.font('Helvetica').fillColor('#1a1a1a');
    for (const row of docSpec.rows) {
      const y = doc.y;
      row.forEach((cell, i) => {
        doc.text(String(cell), startX + i * colW, y, { width: colW - 4, continued: false });
      });
      doc.moveDown(0.35);
      if (doc.y > doc.page.height - 72) {
        doc.addPage();
      }
    }

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(11);
    for (const line of docSpec.footerLines ?? []) {
      doc.text(line);
    }

    doc.end();
  });
}

export function sendPdf(res: {
  setHeader: (k: string, v: string) => void;
  send: (b: Buffer) => void;
}, filename: string, buffer: Buffer) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
}
