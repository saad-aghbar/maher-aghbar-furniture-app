import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { ACCESSIBILITY_SWEEP_DIRS } from './harnessScopes';

const MOBILE_ROOT = join(__dirname, '../..');

const EXCLUDE_DIR_BITS = ['/__tests__/', '/node_modules/', '/.expo/', '/coverage/', '/src/test/'];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  const st = statSync(dir);
  if (st.isFile()) {
    if (dir.endsWith('.tsx')) out.push(dir);
    return out;
  }
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const child = statSync(full);
    if (child.isDirectory()) {
      const rel = full.replace(/\\/g, '/');
      if (EXCLUDE_DIR_BITS.some((b) => rel.includes(b))) continue;
      walk(full, out);
    } else if (name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const PRESSABLE_RE =
  /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|AnimatedPressable)\b([^>]*?)(\/>|>)/g;

function hasLabel(attrs: string): boolean {
  return (
    /accessibilityLabel=/.test(attrs) ||
    /testID=/.test(attrs) ||
    /accessibilityLabel\s*:/.test(attrs)
  );
}

function isSpreadOnly(attrs: string): boolean {
  return /^\s*\{\s*\.\.\.[A-Za-z0-9_]+\s*\}\s*$/.test(attrs.trim());
}

export type UnlabeledPressable = {
  rel: string;
  snippet: string;
};

export function findUnlabeledPressables(
  dirs: readonly string[] = ACCESSIBILITY_SWEEP_DIRS,
): UnlabeledPressable[] {
  const files = dirs.flatMap((dir) => walk(join(MOBILE_ROOT, dir)));
  const found: UnlabeledPressable[] = [];
  for (const full of files) {
    const source = readFileSync(full, 'utf8');
    const rel = relative(MOBILE_ROOT, full).replace(/\\/g, '/');
    PRESSABLE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PRESSABLE_RE.exec(source))) {
      const attrs = m[2] ?? '';
      if (isSpreadOnly(attrs)) continue;
      if (hasLabel(attrs)) continue;
      found.push({
        rel,
        snippet: m[0].slice(0, 180),
      });
    }
  }
  return found;
}
