import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CustomerAddress } from '@/api/modules/customers';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { formatAddressLine } from '../newOrderValidation';

type Props = {
  deliveryAddress: string | null | undefined;
  savedAddresses: CustomerAddress[];
  /** Optional muted caption under the address (e.g. map pinned). */
  footer?: string | null;
};

/**
 * Read-only delivery summary that surfaces the favorite/saved location label
 * when the address line matches a saved CustomerAddress.
 */
export function DeliveryFavoriteSummary({
  deliveryAddress,
  savedAddresses,
  footer,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const line = deliveryAddress?.trim() || '';
  const matched = savedAddresses.find((a) => formatAddressLine(a) === line);
  const label = matched?.label?.trim() || null;

  if (!line && !label) {
    return (
      <AppText variant="caption" color="muted">
        —
      </AppText>
    );
  }

  const softWash = dark ? 'rgba(255,255,255,0.06)' : colors.brandSoft;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {label ? (
        <View
          style={{
            borderRadius: theme.radius.xl,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.12)',
            backgroundColor: softWash,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="bookmark" size={16} color={colors.brand} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText
              variant="caption"
              color="muted"
              style={{
                textAlign: isRTL ? 'right' : 'left',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: 10,
              }}
            >
              {t('mobile.newOrder.savedAddresses')}
            </AppText>
            <AppText
              variant="label"
              weight="semibold"
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {label}
            </AppText>
          </View>
        </View>
      ) : null}

      {line ? (
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(63,52,44,0.14)',
            backgroundColor: dark ? colors.surface : 'rgba(255,255,255,0.88)',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: softWash,
              marginTop: 2,
            }}
          >
            <Ionicons name="home-outline" size={15} color={colors.brand} />
          </View>
          <AppText
            variant="body"
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {line}
          </AppText>
        </View>
      ) : null}

      {footer ? (
        <AppText variant="caption" color="muted">
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}
