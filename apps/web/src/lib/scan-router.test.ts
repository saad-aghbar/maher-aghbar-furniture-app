import { describe, expect, it } from 'vitest';
import { filenameFromDisposition, pdfQuery, withPdfQuery } from '../../../../packages/ui/src/documents/pdf-query';
import { orderCodeTarget, targetFromResolve } from './scan-router';

describe('scan-router', () => {
  it('routes order-shaped codes straight to search', () => {
    expect(orderCodeTarget('SO-2026-00005', 'admin')).toEqual({ kind: 'route', href: '/admin/search?q=SO-2026-00005', label: 'SO-2026-00005' });
    expect(orderCodeTarget('SO-2026-00005.A', 'worker')).toMatchObject({ href: '/worker/search?q=SO-2026-00005.A' });
    expect(orderCodeTarget('MAT-FOAM-01', 'admin')).toBeNull();
  });

  it('maps resolved inventory scans to their pages (bin → kit → lot → item)', () => {
    expect(targetFromResolve('BIN-WH-A1', { status: 'FOUND_BIN', bin: { location: { id: 'l1', warehouseId: 'w1' } } }, 'admin')).toMatchObject({ href: '/admin/inventory/warehouses/w1' });
    expect(targetFromResolve('WIP-1', { status: 'FOUND_KIT', kit: { id: 'k1', productionOrderId: 'p1' } }, 'admin')).toMatchObject({ href: '/admin/production/p1' });
    expect(targetFromResolve('FB-1', { status: 'ORDER_FABRIC', lot: { id: 'l1', qrCode: 'FB-1' } }, 'admin')).toMatchObject({ href: '/admin/inventory/fabric-bundle/FB-1' });
    expect(targetFromResolve('FIN-1', { status: 'FOUND_LOT', lot: { id: 'l1', salesOrderId: 'so1' } }, 'admin')).toMatchObject({ href: '/admin/inventory/finished/so1' });
    expect(targetFromResolve('MAT-1', { status: 'FOUND', item: { id: 'i1', sku: 'MAT-1' } }, 'worker')).toMatchObject({ href: '/admin/inventory/items/i1' });
    expect(targetFromResolve('??', { status: 'NOT_FOUND' }, 'admin')).toEqual({ kind: 'unknown', code: '??' });
    expect(targetFromResolve('??', { status: 'ERROR' }, 'admin')).toEqual({ kind: 'error', code: '??' });
  });
});

describe('pdf-query (mobile parity)', () => {
  it('serialises lang/theme and optional range like the mobile client', () => {
    expect(pdfQuery({ lang: 'ar', theme: 'brown' })).toBe('?lang=ar&theme=brown');
    expect(pdfQuery({ lang: 'en', theme: 'white', from: '2026-01-01', to: '2026-01-31' })).toBe('?lang=en&theme=white&from=2026-01-01&to=2026-01-31');
    expect(withPdfQuery('/api/v1/invoices/1/pdf', { lang: 'he', theme: 'white' })).toBe('/api/v1/invoices/1/pdf?lang=he&theme=white');
    expect(withPdfQuery('/x?period=month', { lang: 'en', theme: 'white', extra: { sections: ['a', 'b'] } })).toBe('/x?period=month&lang=en&theme=white&sections=a&sections=b');
  });

  it('reads filenames from Content-Disposition', () => {
    expect(filenameFromDisposition('attachment; filename="INV-1.pdf"', 'x.pdf')).toBe('INV-1.pdf');
    expect(filenameFromDisposition("attachment; filename*=UTF-8''SOA-%D9%85.pdf", 'x.pdf')).toBe('SOA-م.pdf');
    expect(filenameFromDisposition(null, 'x.pdf')).toBe('x.pdf');
  });
});
