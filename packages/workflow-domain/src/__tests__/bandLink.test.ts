import {
  applyParallelBandLink,
  detectParallelBandLinks,
  fromRawGraph,
  isParallelToParallelJoin,
  type CanonicalWorkflowGraph,
} from '../index';

function N(id: string, code: string, sortOrder: number) {
  return { id, code, sortOrder };
}
function E(from: string, to: string) {
  return { from, to };
}

const terminal = [
  N('insp', 'INSPECTION', 90),
  N('pack', 'PACKAGING', 91),
  N('del', 'DELIVERY', 92),
];

describe('parallel band link (together vs lanes)', () => {
  function twoBandsTogether(): CanonicalWorkflowGraph {
    return fromRawGraph(
      [
        N('prep', 'MATERIAL_PREP', 0),
        N('paint', 'PAINTING', 1),
        N('foam', 'FOAM', 2),
        N('carp', 'CARPENTRY', 3),
        N('uph', 'UPHOLSTERY', 4),
        ...terminal,
      ],
      [
        E('prep', 'paint'),
        E('prep', 'foam'),
        E('paint', 'carp'),
        E('foam', 'carp'),
        E('paint', 'uph'),
        E('foam', 'uph'),
        E('carp', 'insp'),
        E('uph', 'insp'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
  }

  it('detects together link', () => {
    const g = twoBandsTogether();
    const links = detectParallelBandLinks(g);
    expect(links.length).toBeGreaterThanOrEqual(1);
    const link = links.find((l) => l.toBand.nodeIds.includes('carp'))!;
    expect(link.mode).toBe('together');
    expect(isParallelToParallelJoin(link.fromBand, link.toBand)).toBe(true);
  });

  it('together → lanes rewires 1:1 by sort order', () => {
    const before = twoBandsTogether();
    const after = applyParallelBandLink(before, {
      fromBandNodeIds: ['paint', 'foam'],
      toBandNodeIds: ['carp', 'uph'],
      mode: 'lanes',
    });
    // paint sort 1, foam sort 2; carp 3, uph 4 → carp←paint, uph←foam
    expect(after.predecessorsByNode.carp).toEqual(['paint']);
    expect(after.predecessorsByNode.uph).toEqual(['foam']);
    expect(after.predecessorsByNode.insp?.sort()).toEqual(['carp', 'uph']);
    const links = detectParallelBandLinks(after);
    expect(links.find((l) => l.toBand.nodeIds.includes('carp'))?.mode).toBe('lanes');
  });

  it('lanes → together joins full band', () => {
    const lanes = fromRawGraph(
      [
        N('prep', 'MATERIAL_PREP', 0),
        N('paint', 'PAINTING', 1),
        N('foam', 'FOAM', 2),
        N('carp', 'CARPENTRY', 3),
        N('uph', 'UPHOLSTERY', 4),
        ...terminal,
      ],
      [
        E('prep', 'paint'),
        E('prep', 'foam'),
        E('paint', 'carp'),
        E('foam', 'uph'),
        E('carp', 'insp'),
        E('uph', 'insp'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
    const after = applyParallelBandLink(lanes, {
      fromBandNodeIds: ['paint', 'foam'],
      toBandNodeIds: ['carp', 'uph'],
      mode: 'together',
    });
    expect(after.predecessorsByNode.carp?.sort()).toEqual(['foam', 'paint']);
    expect(after.predecessorsByNode.uph?.sort()).toEqual(['foam', 'paint']);
  });

  it('detects mixed spaghetti and can fix to together', () => {
    const mixed = fromRawGraph(
      [
        N('prep', 'MATERIAL_PREP', 0),
        N('paint', 'PAINTING', 1),
        N('foam', 'FOAM', 2),
        N('carp', 'CARPENTRY', 3),
        N('uph', 'UPHOLSTERY', 4),
        ...terminal,
      ],
      [
        E('prep', 'paint'),
        E('prep', 'foam'),
        E('paint', 'carp'),
        E('foam', 'carp'),
        E('foam', 'uph'),
        E('paint', 'insp'),
        E('carp', 'insp'),
        E('uph', 'insp'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
    const links = detectParallelBandLinks(mixed);
    const link = links.find((l) => l.toBand.nodeIds.includes('carp'));
    expect(link).toBeTruthy();
    expect(link!.mode).toBe('mixed');
    const fixed = applyParallelBandLink(mixed, {
      fromBandNodeIds: link!.fromBand.nodeIds,
      toBandNodeIds: link!.toBand.nodeIds,
      mode: 'together',
    });
    expect(fixed.predecessorsByNode.carp?.sort()).toEqual(['foam', 'paint']);
    expect(fixed.predecessorsByNode.uph?.sort()).toEqual(['foam', 'paint']);
  });
});
