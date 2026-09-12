import PDFDocument from 'pdfkit';

/** A4 document of record for a handwritten sheet photo. The original image still goes to the model. */
export async function buildHandwrittenSheetPdf(image: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(12).text('Handwritten order sheet', { align: 'left' });
    doc.moveDown(0.5);
    const maxWidth = doc.page.width - 72;
    const maxHeight = doc.page.height - 120;
    try {
      doc.image(image, 36, doc.y, { fit: [maxWidth, maxHeight], align: 'center' });
    } catch {
      doc.text('Could not embed the original photo.');
    }
    doc.end();
  });
}
