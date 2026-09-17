import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const MOBILE_ROOT = join(__dirname, '../..');
const SRC = join(MOBILE_ROOT, 'src');

const EXCLUDE_DIR_BITS = ['/__tests__/', '/node_modules/', '/.expo/', '/coverage/'];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      const rel = full.replace(/\\/g, '/');
      if (EXCLUDE_DIR_BITS.some((b) => rel.includes(b))) continue;
      walk(full, out);
    } else if (name.endsWith('Sheet.tsx')) {
      out.push(full);
    }
  }
  return out;
}

export type SheetKind = 'host' | 'wrapper' | 'body';

export type SheetContractRow = {
  rel: string;
  kind: SheetKind;
  source: string;
};

export function listSheetFiles(): string[] {
  return [
    ...walk(join(SRC, 'components')),
    ...walk(join(SRC, 'features')),
  ]
    .filter((full) => !full.endsWith('/BottomSheet.tsx'))
    .filter((full) => !full.endsWith('/SheetOverlayYield.tsx'))
    .sort();
}

export function classifySheet(source: string): SheetKind {
  if (
    /<BottomSheet[\s>]/.test(source) ||
    /<ConfirmationSheet[\s>]/.test(source) ||
    /<ActionSheet[\s>]/.test(source) ||
    /<AdaptiveOverlay[\s>]/.test(source)
  ) {
    return 'host';
  }
  if (/Sheet[\s>]/.test(source) && /open=\{/.test(source)) {
    return 'wrapper';
  }
  return 'body';
}

export function loadSheetContracts(): SheetContractRow[] {
  return listSheetFiles()
    .map((full) => {
      const source = readFileSync(full, 'utf8');
      return {
        rel: relative(MOBILE_ROOT, full).replace(/\\/g, '/'),
        kind: classifySheet(source),
        source,
      };
    })
    .filter((row) => !/^\s*export\s+\{/.test(row.source) || row.source.includes('function '));
}

export function hasHeightConstraint(source: string): boolean {
  return (
    /<BottomSheet[\s>]/.test(source) ||
    /<AdaptiveOverlay[\s>]/.test(source) ||
    /fitContent/.test(source) ||
    /sheetHeight/.test(source) ||
    /maxHeight/.test(source) ||
    /expandedHeight/.test(source) ||
    /expandable/.test(source) ||
    /intent=/.test(source)
  );
}

export function hasFooterAction(source: string): boolean {
  return (
    /PrimaryButton/.test(source) ||
    /SecondaryButton/.test(source) ||
    /DestructiveButton/.test(source) ||
    /DealerFormFooter/.test(source) ||
    /InventorySheetFooter/.test(source) ||
    /accessibilityRole="button"/.test(source) ||
    /accessibilityRole=\{['"]button['"]\}/.test(source) ||
    /AnimatedPressable/.test(source) ||
    /onSelect/.test(source) ||
    /onPress/.test(source) ||
    /onClose/.test(source)
  );
}

export function usesScrollView(source: string): boolean {
  return /<ScrollView[\s>]/.test(source) || /KeyboardAware/.test(source);
}

export function looksLikeOverflowContent(source: string): boolean {
  return (
    /TextField/.test(source) ||
    /TextInput/.test(source) ||
    /map\(/.test(source) ||
    /flatList/i.test(source) ||
    /FlatList/.test(source)
  );
}
