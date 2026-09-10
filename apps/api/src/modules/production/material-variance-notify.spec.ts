import { classifyOrderMaterialUsageStatus } from './material-usage.service';
import { materialVarianceNotifyCode } from './material-variance-notify';

describe('materialVarianceNotifyCode', () => {
  it('notifies OVER / UNDER / EXTRA and stays silent on target', () => {
    expect(materialVarianceNotifyCode('OVER')).toBe('MATERIAL_OVER_ISSUE');
    expect(materialVarianceNotifyCode('UNDER')).toBe('MATERIAL_UNDER_ISSUE');
    expect(materialVarianceNotifyCode('EXTRA')).toBe('MATERIAL_EXTRA_ISSUE');
    expect(materialVarianceNotifyCode('ON_TARGET')).toBeNull();
    expect(materialVarianceNotifyCode('UNUSED')).toBeNull();
  });

  it('classifies a 5% over as on-target so recordLines will not notify', () => {
    expect(classifyOrderMaterialUsageStatus(100, 104)).toBe('ON_TARGET');
    expect(materialVarianceNotifyCode(classifyOrderMaterialUsageStatus(100, 104))).toBeNull();
    expect(classifyOrderMaterialUsageStatus(100, 110)).toBe('OVER');
    expect(materialVarianceNotifyCode(classifyOrderMaterialUsageStatus(100, 110))).toBe('MATERIAL_OVER_ISSUE');
  });
});
