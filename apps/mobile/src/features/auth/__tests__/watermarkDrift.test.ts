import { watermarkDriftX } from '../components/watermarkDrift';

describe('watermarkDriftX', () => {
  const stripW = 800;

  it('starts at 0', () => {
    expect(watermarkDriftX(0, stripW)).toBe(0);
  });

  it('treats 1.0 as the same phase as 0 (seamless loop)', () => {
    expect(watermarkDriftX(1, stripW)).toBe(0);
    expect(watermarkDriftX(2, stripW)).toBe(0);
  });

  it('is halfway across at 0.5', () => {
    expect(watermarkDriftX(0.5, stripW)).toBe(-400);
  });

  it('does not jump past one strip', () => {
    expect(watermarkDriftX(0.999, stripW)).toBeCloseTo(-799.2);
    expect(Math.abs(watermarkDriftX(0.999, stripW))).toBeLessThan(stripW);
  });
});
