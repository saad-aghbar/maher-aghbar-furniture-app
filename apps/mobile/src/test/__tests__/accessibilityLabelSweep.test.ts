import { ACCESSIBILITY_SWEEP_DIRS } from '../harnessScopes';
import { findUnlabeledPressables } from '../accessibilitySweep';

describe('accessibility-label sweep', () => {
  it(`fails unlabeled Pressable/Touchable in ${ACCESSIBILITY_SWEEP_DIRS.join(', ')}`, () => {
    const unlabeled = findUnlabeledPressables();
    expect(unlabeled).toEqual([]);
  });
});
