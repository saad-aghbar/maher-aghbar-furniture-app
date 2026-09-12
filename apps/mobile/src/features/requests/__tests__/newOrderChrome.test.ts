import {
  nextStageIndex,
  stageNodeState,
  stageProgress,
  isFinalWizardStep,
  NEW_ORDER_STAGE_COUNT,
} from '../newOrderStageMath';
import {
  newOrderDockMode,
  newOrderDockPrimaryKey,
  newOrderDockScrollPad,
  newOrderDockShowsSaveDraft,
  NEW_ORDER_DOCK_BODY_HEIGHT,
  NEW_ORDER_DOCK_SCROLL_EXTRA,
} from '../newOrderDockMode';

describe('stageProgress', () => {
  it('maps steps to rising fractions', () => {
    expect(stageProgress(1)).toBeCloseTo(1 / 3);
    expect(stageProgress(2)).toBeCloseTo(2 / 3);
    expect(stageProgress(3)).toBe(1);
  });

  it('clamps out-of-range steps', () => {
    expect(stageProgress(0)).toBeCloseTo(1 / 3);
    expect(stageProgress(99)).toBe(1);
  });
});

describe('nextStageIndex', () => {
  it('cues the next incomplete stage', () => {
    expect(nextStageIndex(1)).toBe(1);
    expect(nextStageIndex(2)).toBe(2);
    expect(nextStageIndex(3)).toBeNull();
  });
});

describe('stageNodeState', () => {
  it('marks done / active / upcoming', () => {
    expect(stageNodeState(2, 0)).toBe('done');
    expect(stageNodeState(2, 1)).toBe('active');
    expect(stageNodeState(2, 2)).toBe('upcoming');
  });
});

describe('isFinalWizardStep', () => {
  it('detects step 3', () => {
    expect(isFinalWizardStep(3)).toBe(true);
    expect(isFinalWizardStep(2)).toBe(false);
    expect(NEW_ORDER_STAGE_COUNT).toBe(3);
  });
});

describe('newOrderDockMode', () => {
  it('hides after submit', () => {
    expect(newOrderDockMode({ step: 3, submitted: true })).toBe('hidden');
  });

  it('uses continue then submit', () => {
    expect(newOrderDockMode({ step: 1, submitted: false })).toBe('continue');
    expect(newOrderDockMode({ step: 3, submitted: false })).toBe('submit');
  });

  it('maps primary label keys', () => {
    expect(newOrderDockPrimaryKey('continue')).toBe('mobile.newOrder.continue');
    expect(newOrderDockPrimaryKey('submit')).toBe('mobile.newOrder.submit');
    expect(newOrderDockPrimaryKey('hidden')).toBeNull();
  });

  it('shows save draft only on submit mode', () => {
    expect(newOrderDockShowsSaveDraft('submit')).toBe(true);
    expect(newOrderDockShowsSaveDraft('continue')).toBe(false);
  });
});

describe('newOrderDockScrollPad', () => {
  it('clears dock body, top pad, sticky tab inset, and extra air', () => {
    expect(NEW_ORDER_DOCK_BODY_HEIGHT).toBe(76);
    expect(NEW_ORDER_DOCK_SCROLL_EXTRA).toBe(48);
    // stickyCtaBottomInset(0, 16) = 16 + 108; + top 8 + body 76 + extra 48
    expect(newOrderDockScrollPad(16)).toBe(16 + 108 + 8 + 76 + 48);
  });

  it('folds home-indicator inset into the sticky dock stack', () => {
    expect(newOrderDockScrollPad(16, 34)).toBe(34 + 108 + 8 + 76 + 48);
  });

  it('is tall enough that step content cannot sit under the dock body', () => {
    expect(newOrderDockScrollPad(12)).toBeGreaterThanOrEqual(
      108 + NEW_ORDER_DOCK_BODY_HEIGHT,
    );
  });
});
