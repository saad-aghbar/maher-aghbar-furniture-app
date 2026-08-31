import { mapMgmtHref } from '../mapMgmtHref';

describe('mapMgmtHref', () => {
  it('maps inventory web path to admin inventory tab', () => {
    expect(mapMgmtHref('/inventory?lifecycle=finished')).toBe(
      '/(app)/(admin)/(tabs)/inventory?lifecycle=finished',
    );
  });

  it('maps sales-order detail', () => {
    expect(mapMgmtHref('/sales-orders/abc')).toBe('/(app)/(admin)/orders/abc');
  });

  it('maps return detail', () => {
    expect(mapMgmtHref('/returns/ret-1')).toBe('/(app)/(admin)/returns/ret-1');
  });

  it('maps RFQ inbox to orders desk=requests (not needs_attention)', () => {
    expect(mapMgmtHref('/requests')).toBe(
      '/(app)/(admin)/(tabs)/orders?desk=requests',
    );
  });

  it('maps quality waiting onto production inspection bucket with quality key', () => {
    expect(mapMgmtHref('/quality?filter=waiting')).toBe(
      '/(app)/(admin)/(tabs)/production?bucket=inspection_packaging&quality=waiting',
    );
  });

  it('maps quality fail / reinspection / passedToday distinctly', () => {
    expect(mapMgmtHref('/quality', 'fail')).toBe(
      '/(app)/(admin)/(tabs)/production?bucket=inspection_packaging&quality=fail',
    );
    expect(mapMgmtHref('/quality', 'reinspection')).toBe(
      '/(app)/(admin)/(tabs)/production?bucket=inspection_packaging&quality=reinspection',
    );
    expect(mapMgmtHref('/quality', 'passedToday')).toBe(
      '/(app)/(admin)/(tabs)/production?bucket=inspection_packaging&quality=passedToday',
    );
  });

  it('applies simple filter when query is empty', () => {
    expect(mapMgmtHref('/returns', 'WAITING_RETURN')).toBe(
      '/(app)/(admin)/returns?chip=WAITING_RETURN',
    );
  });

  it('parses compound inventory filters into real keys', () => {
    expect(mapMgmtHref('/inventory', 'lifecycle=finished&scope=inWarehouse')).toBe(
      '/(app)/(admin)/(tabs)/inventory?lifecycle=finished&scope=inWarehouse',
    );
    expect(mapMgmtHref('/inventory', 'lifecycle=materials&filter=lowStock')).toBe(
      '/(app)/(admin)/(tabs)/inventory?lifecycle=materials&lowStock=true',
    );
    expect(mapMgmtHref('/inventory', 'lifecycle=semiFinished&filter=handoff')).toBe(
      '/(app)/(admin)/(tabs)/inventory?lifecycle=semiFinished&handoff=true',
    );
    expect(mapMgmtHref('/inventory', 'tab=corrections')).toBe(
      '/(app)/(admin)/(tabs)/inventory?tab=corrections',
    );
  });

  describe('factory flow', () => {
    it('maps prepare → orders preparing', () => {
      expect(mapMgmtHref('/sales-orders', 'journey=preparing')).toBe(
        '/(app)/(admin)/(tabs)/orders?journey=preparing&chip=preparing&focus=preparing',
      );
    });

    it('maps ready for factory → ready_to_start', () => {
      expect(mapMgmtHref('/production', 'lifecycle=ready')).toBe(
        '/(app)/(admin)/(tabs)/production?bucket=ready_to_start',
      );
    });

    it('maps in production → on_floor', () => {
      expect(mapMgmtHref('/production', 'lifecycle=active')).toBe(
        '/(app)/(admin)/(tabs)/production?bucket=on_floor',
      );
    });

    it('maps quality/rework → inspection_packaging', () => {
      expect(mapMgmtHref('/production', 'lifecycle=inspection')).toBe(
        '/(app)/(admin)/(tabs)/production?bucket=inspection_packaging',
      );
    });

    it('maps packaging → inspection_packaging', () => {
      expect(mapMgmtHref('/production', 'lifecycle=packaging')).toBe(
        '/(app)/(admin)/(tabs)/production?bucket=inspection_packaging',
      );
    });

    it('maps finished flow → inventory finished in warehouse', () => {
      expect(mapMgmtHref('/inventory', 'lifecycle=finished&scope=inWarehouse')).toBe(
        '/(app)/(admin)/(tabs)/inventory?lifecycle=finished&scope=inWarehouse',
      );
    });
  });

  describe('production / materials tiles', () => {
    it('maps section=blocked', () => {
      expect(mapMgmtHref('/production', 'section=blocked')).toBe(
        '/(app)/(admin)/(tabs)/production?bucket=blocked',
      );
    });

    it('maps section=late', () => {
      expect(mapMgmtHref('/production', 'section=late')).toBe(
        '/(app)/(admin)/(tabs)/production?bucket=late',
      );
    });

    it('maps section=inQueue → ready_to_start', () => {
      expect(mapMgmtHref('/production', 'section=inQueue')).toBe(
        '/(app)/(admin)/(tabs)/production?bucket=ready_to_start',
      );
    });

    it('maps WAITING_FOR_MATERIALS → blocked', () => {
      expect(mapMgmtHref('/production', 'status=WAITING_FOR_MATERIALS')).toBe(
        '/(app)/(admin)/(tabs)/production?bucket=blocked',
      );
    });
  });

  describe('outbound / money / exceptions', () => {
    it('maps deliveries section + when', () => {
      expect(mapMgmtHref('/deliveries', 'section=ready&when=today')).toBe(
        '/(app)/(admin)/scheduling?section=ready&when=today',
      );
      expect(mapMgmtHref('/deliveries', 'section=shipped')).toBe(
        '/(app)/(admin)/scheduling?section=shipped',
      );
    });

    it('maps overdue / open invoices to chips', () => {
      expect(mapMgmtHref('/invoices', 'overdue=true')).toBe(
        '/(app)/(admin)/invoices?chip=OVERDUE',
      );
      expect(mapMgmtHref('/invoices', 'open=true')).toBe(
        '/(app)/(admin)/invoices?chip=OPEN',
      );
    });

    it('maps returns physical / approval', () => {
      expect(mapMgmtHref('/returns', 'physical=WAITING_RETURN')).toBe(
        '/(app)/(admin)/returns?physical=WAITING_RETURN&chip=WAITING_RETURN',
      );
      expect(mapMgmtHref('/returns', 'approval=PENDING')).toBe(
        '/(app)/(admin)/returns?chip=PENDING',
      );
      expect(mapMgmtHref('/returns', 'physical=RETURNED')).toBe(
        '/(app)/(admin)/returns?physical=RETURNED&chip=RETURNED',
      );
    });

    it('maps overdue orders late flag', () => {
      expect(mapMgmtHref('/sales-orders', 'late=true')).toBe(
        '/(app)/(admin)/(tabs)/orders?late=true',
      );
    });

    it('maps cancel disposition / setup required', () => {
      expect(mapMgmtHref('/sales-orders', 'disposition=pending')).toContain('disposition=pending');
      expect(mapMgmtHref('/sales-orders', 'setup=SETUP_REQUIRED')).toContain('setup=SETUP_REQUIRED');
    });
  });

  describe('purchasing', () => {
    it('maps needs / arriving / late', () => {
      expect(mapMgmtHref('/purchasing', 'needs=purchasing')).toBe(
        '/(app)/(admin)/purchasing?needs=purchasing&tab=orders&focus=needs',
      );
      expect(mapMgmtHref('/purchasing', 'arriving=today')).toBe(
        '/(app)/(admin)/purchasing?arriving=today&tab=orders',
      );
      expect(mapMgmtHref('/purchasing', 'late=true')).toBe(
        '/(app)/(admin)/purchasing?late=true&tab=orders',
      );
    });
  });

  it('maps /reports and /dashboard to mobile reports', () => {
    expect(mapMgmtHref('/reports')).toBe('/(app)/(admin)/reports');
    expect(mapMgmtHref('/dashboard')).toBe('/(app)/(admin)/reports');
  });
});
