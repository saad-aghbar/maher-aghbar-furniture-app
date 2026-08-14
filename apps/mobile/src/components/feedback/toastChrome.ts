import type { ThemeColors } from '@/theme';
import type { ToastVariant } from './toastQueue';

export type ToastChrome = {
  accent: string;
  fg: string;
  soft: string;
  icon: 'checkmark-circle' | 'alert-circle' | 'close-circle' | 'information-circle';
  labelKey: 'mobile.toast.success' | 'mobile.toast.warning' | 'mobile.toast.error' | 'mobile.toast.info';
};

/** Variant chrome for the shared toast card — coffee/camo family, never traffic colors. */
export function toastChrome(variant: ToastVariant, colors: ThemeColors): ToastChrome {
  switch (variant) {
    case 'success':
      return {
        accent: colors.success,
        fg: colors.success,
        soft: colors.successSoft,
        icon: 'checkmark-circle',
        labelKey: 'mobile.toast.success',
      };
    case 'warning':
      return {
        accent: colors.warning,
        fg: colors.warning,
        soft: colors.warningSoft,
        icon: 'alert-circle',
        labelKey: 'mobile.toast.warning',
      };
    case 'error':
      return {
        accent: colors.error,
        fg: colors.error,
        soft: colors.errorSoft,
        icon: 'close-circle',
        labelKey: 'mobile.toast.error',
      };
    default:
      return {
        accent: colors.info,
        fg: colors.info,
        soft: colors.infoSoft,
        icon: 'information-circle',
        labelKey: 'mobile.toast.info',
      };
  }
}
