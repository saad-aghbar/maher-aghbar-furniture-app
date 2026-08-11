import {
  dealerHeroParallaxAmplitude,
  dealerStageRailDuration,
  DEALER_FAB_PRESS_SCALE,
  DEALER_WIZARD_DOCK_PRESS_SCALE,
} from '../dealerMotion';

describe('dealerMotion', () => {
  it('zeros hero parallax when reduce-motion', () => {
    expect(dealerHeroParallaxAmplitude(true)).toBe(0);
    expect(dealerHeroParallaxAmplitude(false)).toBeGreaterThan(0);
  });

  it('exports a soft FAB press scale under 1', () => {
    expect(DEALER_FAB_PRESS_SCALE).toBeLessThan(1);
    expect(DEALER_FAB_PRESS_SCALE).toBeGreaterThan(0.8);
  });

  it('snaps stage-rail timing when reduce-motion', () => {
    expect(dealerStageRailDuration(true)).toBe(0);
    expect(dealerStageRailDuration(false)).toBeGreaterThan(0);
  });

  it('exports wizard dock press scale under 1', () => {
    expect(DEALER_WIZARD_DOCK_PRESS_SCALE).toBeLessThan(1);
    expect(DEALER_WIZARD_DOCK_PRESS_SCALE).toBeGreaterThan(0.9);
  });
});
