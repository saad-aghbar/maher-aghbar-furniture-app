import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  /** Small uppercase type label — Invoice, Request, Order. */
  kind: string;
  /** Bold primary ID. */
  title: string;
  /** Raw status code for StatusBadge (PARTIALLY_PAID, CLOSED…). */
  status?: string;
  /** Extra meta after the status — amount, client name. */
  meta?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Search / list row language (images 6–7):
 * kind + bold ID + STATUS • meta on a cream rounded card.
 */
export function EntityRow({
  kind,
  title,
  status,
  meta,
  onPress,
  accessibilityLabel,
}: Props) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const line = [status, meta].filter(Boolean).join(' • ');

  return (
    <SurfaceCard
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? `${kind}. ${title}. ${line}`}
      style={{ minHeight: theme.sizes.touch.min }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <AppText
          variant="caption"
          color="muted"
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {kind}
        </AppText>
        <AppText
          variant="heading"
          weight="semibold"
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </AppText>
        {status || meta ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
            }}
          >
            {status ? <StatusBadge status={status} /> : null}
            {meta ? (
              <AppText variant="caption" style={{ color: colors.textSecondary }}>
                {status ? `• ${meta}` : meta}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </SurfaceCard>
  );
}
