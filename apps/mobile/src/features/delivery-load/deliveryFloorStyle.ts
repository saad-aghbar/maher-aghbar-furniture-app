/** Shared charcoal/cream constants for delivery floor photo overlays (match production heroes). */
export const DELIVERY_FLOOR_CREAM = '#F7F4EF';
export const DELIVERY_FLOOR_CHARCOAL = '#141210';

export function deliverySectionLabelStyle(locale: string, brandColor: string) {
  return {
    color: brandColor,
    letterSpacing: locale === 'ar' ? 0 : 1.5,
    textTransform: (locale === 'ar' ? 'none' : 'uppercase') as 'none' | 'uppercase',
  };
}
