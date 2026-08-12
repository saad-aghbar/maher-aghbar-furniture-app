import { calculateDurationMinutes } from '../duration-calculator';

describe('calculateDurationMinutes', () => {
  it('LINEAR = minutesPerUnit * qty', () => {
    expect(
      calculateDurationMinutes({
        quantityScalingMode: 'LINEAR',
        quantity: 3,
        minutesPerUnit: 40,
      }),
    ).toBe(120);
  });

  it('FIXED ignores quantity', () => {
    expect(
      calculateDurationMinutes({
        quantityScalingMode: 'FIXED',
        quantity: 10,
        fixedMinutes: 45,
        minutesPerUnit: 99,
      }),
    ).toBe(45);
  });

  it('SETUP_PLUS_LINEAR = setup + minutesPerUnit * qty', () => {
    expect(
      calculateDurationMinutes({
        quantityScalingMode: 'SETUP_PLUS_LINEAR',
        quantity: 4,
        setupMinutes: 30,
        minutesPerUnit: 15,
      }),
    ).toBe(90);
  });

  it('BATCH = ceil(qty/batchSize) * batchMinutes', () => {
    expect(
      calculateDurationMinutes({
        quantityScalingMode: 'BATCH',
        quantity: 10,
        batchSize: 3,
        batchMinutes: 20,
      }),
    ).toBe(80); // ceil(10/3)=4 → 80
  });

  it('PARALLEL_CAPACITY = setup + ceil(qty/maxParallel) * minutesPerUnit', () => {
    expect(
      calculateDurationMinutes({
        quantityScalingMode: 'PARALLEL_CAPACITY',
        quantity: 10,
        maxParallelUnits: 4,
        minutesPerUnit: 30,
        setupMinutes: 15,
      }),
    ).toBe(105); // ceil(10/4)=3 → 15 + 90
  });

  it('treats non-positive quantity as zero duration for LINEAR', () => {
    expect(
      calculateDurationMinutes({
        quantityScalingMode: 'LINEAR',
        quantity: 0,
        minutesPerUnit: 50,
      }),
    ).toBe(0);
  });
});
