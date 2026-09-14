import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const MOBILE_SRC = join(__dirname, '../..');

const EXCLUDE_DIR_BITS = [
  '/__tests__/',
  '/node_modules/',
  '/.expo/',
  '/coverage/',
  '/src/test/',
  '/src/dev/',
  '/app/dev',
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const child = statSync(full);
    if (child.isDirectory()) {
      const rel = full.replace(/\\/g, '/');
      if (EXCLUDE_DIR_BITS.some((b) => rel.includes(b))) continue;
      walk(full, out);
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

export type EnglishLiteralHit = {
  rel: string;
  line: number;
  snippet: string;
};

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  {
    name: 'echo-label-helper',
    re: /const label = \(key: string, fallback: string\) =>/,
  },
  {
    name: 'echo-key-english',
    re: /(?:v|value|translated|fromCatalog|ok|msg|updatedMsg|deletedMsg)\s*===\s*(?:key|'[^']+'|"[^"]+")\s*\?\s*'[A-Za-z]/,
  },
  {
    name: 'a11y-loading',
    re: /accessibilityLabel=["']Loading["']/,
  },
  {
    name: 'a11y-dismiss',
    re: /accessibilityLabel=["']Dismiss["']/,
  },
  {
    name: 'a11y-hold',
    re: /accessibilityHint=\{[^}]*Hold to confirm/,
  },
  {
    name: 'a11y-remove-workflow',
    re: /accessibilityLabel=["']Remove from workflow["']/,
  },
  {
    name: 'a11y-product-image',
    re: /accessibilityLabel=["']Product image unavailable["']/,
  },
];

export function findEnglishLiteralLeaks(root: string = MOBILE_SRC): EnglishLiteralHit[] {
  const files = walk(root);
  const found: EnglishLiteralHit[] = [];
  for (const full of files) {
    const source = readFileSync(full, 'utf8');
    const rel = relative(MOBILE_SRC, full).replace(/\\/g, '/');
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      for (const { re } of PATTERNS) {
        if (re.test(line)) {
          found.push({
            rel,
            line: i + 1,
            snippet: line.trim().slice(0, 160),
          });
          break;
        }
      }
    }
  }
  return found;
}
