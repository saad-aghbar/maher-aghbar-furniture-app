import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../../..');

/** Same root the API uses. Relative LOCAL_UPLOAD_DIR is resolved from apps/api. */
export function demoUploadRoot(): string {
  const configured = process.env.LOCAL_UPLOAD_DIR?.trim();
  if (!configured) return resolve(join(REPO_ROOT, 'apps/api'), '../../uploads');
  if (isAbsolute(configured)) return configured;
  return resolve(join(REPO_ROOT, 'apps/api'), configured);
}

/** Remove only this demo's uploaded prefix. Other files in the upload root stay. */
export function clearDemoUploads(): void {
  rmSync(join(demoUploadRoot(), 'demo'), { recursive: true, force: true });
}

export function writeDemoObject(storageKey: string, bytes: Buffer): number {
  const full = join(demoUploadRoot(), storageKey);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, bytes);
  return statSync(full).size;
}

export function demoObjectStat(storageKey: string): { exists: boolean; size: number } {
  const full = join(demoUploadRoot(), storageKey);
  if (!existsSync(full)) return { exists: false, size: 0 };
  return { exists: true, size: statSync(full).size };
}

export function demoObjectHead(storageKey: string, bytes: number): Buffer | null {
  const full = join(demoUploadRoot(), storageKey);
  if (!existsSync(full)) return null;
  const data = readFileSync(full);
  return data.subarray(0, bytes);
}

/** A small valid PDF. Offsets are computed so a reader can open it. */
export function demoPdf(label: string): Buffer {
  const safe = label.replace(/[()\\]/g, ' ').slice(0, 60);
  const content = `BT /F1 12 Tf 36 90 Td (${safe}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 300 144] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefAt = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer);
}

/** 1×1 JPEG so the synthetic intake photo is a real image file. */
export const DEMO_INTAKE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);
