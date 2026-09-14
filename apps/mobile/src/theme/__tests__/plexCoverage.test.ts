import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const FONT_DIR = join(__dirname, '../../../assets/fonts');

const FILES = [
  'IBMPlexSans-Regular.ttf',
  'IBMPlexSans-Medium.ttf',
  'IBMPlexSans-SemiBold.ttf',
  'IBMPlexSansArabic-Regular.ttf',
  'IBMPlexSansArabic-Medium.ttf',
  'IBMPlexSansArabic-SemiBold.ttf',
  'IBMPlexSansHebrew-Regular.ttf',
  'IBMPlexSansHebrew-Medium.ttf',
  'IBMPlexSansHebrew-SemiBold.ttf',
] as const;

const ARABIC_LETTERS = 'ءآأؤإئابةتثجحخدذرزسشصضطظعغـفقكلمنهوىي';
const HARAKAT = '\u064b\u064c\u064d\u064e\u064f\u0650\u0651\u0652\u0640';
const HEBREW_LETTERS = 'אבגדהוזחטיךכלםמןנסעףפץצקרשת\u05f3\u05f4';
const ASCII_PRINTABLE = [...Array(95)].map((_, i) => String.fromCharCode(0x20 + i)).join('');

function cmapCoverage(path: string): Set<number> {
  const buf = readFileSync(path);
  const tableCount = buf.readUInt16BE(4);
  let cmapOff = 0;
  for (let i = 0; i < tableCount; i++) {
    const o = 12 + i * 16;
    const tag = buf.toString('ascii', o, o + 4);
    if (tag === 'cmap') cmapOff = buf.readUInt32BE(o + 8);
  }
  if (!cmapOff) throw new Error(`no cmap in ${path}`);
  const n = buf.readUInt16BE(cmapOff + 2);
  let best = 0;
  let bestFmt = -1;
  for (let i = 0; i < n; i++) {
    const o = cmapOff + 4 + i * 8;
    const off = buf.readUInt32BE(o + 4);
    const sub = cmapOff + off;
    const fmt = buf.readUInt16BE(sub);
    if (fmt === 12) {
      best = sub;
      bestFmt = 12;
      break;
    }
    if (fmt === 4 && bestFmt !== 12) {
      best = sub;
      bestFmt = 4;
    }
  }
  const set = new Set<number>();
  if (bestFmt === 4) {
    const segX2 = buf.readUInt16BE(best + 6);
    const seg = segX2 / 2;
    const endO = best + 14;
    const startO = endO + segX2 + 2;
    for (let s = 0; s < seg; s++) {
      const end = buf.readUInt16BE(endO + s * 2);
      const start = buf.readUInt16BE(startO + s * 2);
      if (start === 0xffff) continue;
      for (let c = start; c <= end && c < 0xffff; c++) set.add(c);
    }
  } else if (bestFmt === 12) {
    const groups = buf.readUInt32BE(best + 12);
    for (let g = 0; g < groups; g++) {
      const o = best + 16 + g * 12;
      const start = buf.readUInt32BE(o);
      const end = buf.readUInt32BE(o + 4);
      for (let c = start; c <= end; c++) set.add(c);
    }
  }
  return set;
}

function missing(set: Set<number>, chars: string): string[] {
  return [...chars].filter((ch) => !set.has(ch.codePointAt(0)!));
}

describe('IBM Plex glyph coverage', () => {
  it('ships all nine Regular/Medium/SemiBold files', () => {
    for (const file of FILES) {
      expect(existsSync(join(FONT_DIR, file))).toBe(true);
    }
  });

  it('covers Latin, shekel, percent, and the locale script on every file', () => {
    const leaks: string[] = [];
    for (const file of FILES) {
      const set = cmapCoverage(join(FONT_DIR, file));
      const ascii = missing(set, ASCII_PRINTABLE);
      if (ascii.length) leaks.push(`${file} ASCII ${ascii.join(' ')}`);
      if (!set.has(0x20aa)) leaks.push(`${file} missing shekel`);
      if (!set.has(0x25)) leaks.push(`${file} missing percent`);
      if (file.includes('Arabic')) {
        const ar = missing(set, ARABIC_LETTERS);
        const har = missing(set, HARAKAT);
        if (ar.length) leaks.push(`${file} Arabic ${ar.join('')}`);
        if (har.length) leaks.push(`${file} harakat ${har.join('')}`);
      }
      if (file.includes('Hebrew')) {
        const he = missing(set, HEBREW_LETTERS);
        if (he.length) leaks.push(`${file} Hebrew ${he.join('')}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});
