import { toastChrome } from '../toastChrome';
import type { ThemeColors } from '@/theme';

const colors = {
  success: 'success',
  successSoft: 'successSoft',
  warning: 'warning',
  warningSoft: 'warningSoft',
  error: 'error',
  errorSoft: 'errorSoft',
  info: 'info',
  infoSoft: 'infoSoft',
} as unknown as ThemeColors;

describe('toastChrome', () => {
  it('maps each variant to a distinct icon and label', () => {
    expect(toastChrome('success', colors).icon).toBe('checkmark-circle');
    expect(toastChrome('warning', colors).icon).toBe('alert-circle');
    expect(toastChrome('error', colors).icon).toBe('close-circle');
    expect(toastChrome('info', colors).icon).toBe('information-circle');
    expect(toastChrome('success', colors).labelKey).toBe('mobile.toast.success');
  });

  it('uses the matching semantic fill, not a shared wash', () => {
    expect(toastChrome('error', colors).soft).toBe('errorSoft');
    expect(toastChrome('error', colors).accent).toBe('error');
    expect(toastChrome('success', colors).soft).not.toBe(toastChrome('error', colors).soft);
  });
});
