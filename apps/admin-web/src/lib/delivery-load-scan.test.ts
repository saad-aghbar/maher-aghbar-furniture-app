import { describe, expect, it } from 'vitest';

function nextUnloadPieceForLotQr(
  sheet: {
    products: Array<{
      lotQrCode?: string | null;
      pieces: Array<{ id: string; pieceIndex: number; loadedAt: string | null }>;
    }>;
  },
  rawCode: string,
) {
  const code = rawCode.trim().toUpperCase();
  if (!code) return 'unknown' as const;
  const product = sheet.products.find((p) => (p.lotQrCode ?? '').trim().toUpperCase() === code);
  if (!product) return 'unknown' as const;
  const next = [...product.pieces].sort((a, b) => a.pieceIndex - b.pieceIndex).find((p) => !p.loadedAt);
  if (!next) return 'already_loaded' as const;
  return { pieceId: next.id };
}

describe('delivery FIN scan match', () => {
  it('checks the next unloaded piece for a lot QR', () => {
    const result = nextUnloadPieceForLotQr(
      {
        products: [
          {
            lotQrCode: 'FIN-1',
            pieces: [
              { id: 'a', pieceIndex: 1, loadedAt: '2026-01-01' },
              { id: 'b', pieceIndex: 2, loadedAt: null },
            ],
          },
        ],
      },
      'fin-1',
    );
    expect(result).toEqual({ pieceId: 'b' });
  });
});
