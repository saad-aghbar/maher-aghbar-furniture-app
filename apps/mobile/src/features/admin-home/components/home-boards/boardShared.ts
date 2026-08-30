import { useRouter } from 'expo-router';
import { haptics } from '@/motion';
import { mapMgmtHref } from '../../mapMgmtHref';
import type { MgmtTile } from '../../api';

export type LabeledTile = { tile: MgmtTile; label: string };

export function useMgmtNav() {
  const router = useRouter();
  return (href: string, filter?: string) => {
    void haptics.selection();
    router.push(mapMgmtHref(href, filter));
  };
}

export function tileTotal(tiles: LabeledTile[]): number {
  return tiles.reduce((sum, row) => sum + (row.tile.count || 0), 0);
}

export function barFill(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0.08, Math.min(1, count / max));
}
