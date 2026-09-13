import {
  classifyIncomingWipScan,
  matchedEligibleKit,
} from '../classifyIncomingWipScan';

const eligible = [
  { kitId: 'kit-g', qrCode: 'WIP-P8-G-CARPENTRY' },
  { kitId: 'kit-null', qrCode: null },
];

describe('classifyIncomingWipScan', () => {
  it('matches the eligible kit QR', () => {
    expect(classifyIncomingWipScan('wip-p8-g-carpentry', eligible)).toBe('match');
    expect(matchedEligibleKit('WIP-P8-G-CARPENTRY', eligible)?.kitId).toBe('kit-g');
  });

  it('flags raw SKUs and bins before confirm', () => {
    expect(classifyIncomingWipScan('MAT-OAK', eligible)).toBe('raw');
    expect(classifyIncomingWipScan('BIN-RAW-RAW-MAIN', eligible)).toBe('raw');
  });

  it('flags another order’s WIP kit', () => {
    expect(classifyIncomingWipScan('WIP-P8-B-CARPENTRY', eligible)).toBe('wrong_kit');
  });

  it('does not treat unknown captions as a match', () => {
    expect(classifyIncomingWipScan('FIN-P10-A', eligible)).toBe('unknown');
    expect(classifyIncomingWipScan('NO-SUCH-QR-XYZ', eligible)).toBe('unknown');
    expect(matchedEligibleKit('WIP-P8-B-CARPENTRY', eligible)).toBeUndefined();
  });
});
