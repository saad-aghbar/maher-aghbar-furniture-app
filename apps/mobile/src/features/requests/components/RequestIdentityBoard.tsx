import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

const HERO = 72;

type Props = {
  number: string;
  dealerName: string;
  status: string;
  statusLabel: string;
  phaseLabel: string;
  phaseHint?: string | null;
  imageUrl?: string | null;
  accent: string;
};

/**
 * Customer-request identity — header band (status + RFQ number), media, dealer, phase.
 */
export function RequestIdentityBoard({
  number,
  dealerName,
  status,
  statusLabel,
  phaseLabel,
  phaseHint,
  imageUrl,
  accent,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const urgent = accent === colors.warning || accent === colors.error;
  const railOpacity = urgent ? 0.9 : 0.55;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: urgent ? accent : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accent,
          opacity: railOpacity,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <StatusBadge status={status} label={statusLabel} dot />
        <AppText
          variant="caption"
          color="brand"
          weight={titleWeight}
          dir="ltr"
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {number}
        </AppText>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: HERO,
              height: HERO,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: HERO, height: HERO }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Ionicons name="file-tray-outline" size={28} color={accent} />
            )}
          </View>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              gap: 6,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <AppText
              variant="title"
              weight={titleWeight}
              numberOfLines={2}
              style={{
                fontSize: 20,
                lineHeight: 26,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {dealerName}
            </AppText>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{
                color: urgent ? accent : colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {phaseLabel}
            </AppText>
            {phaseHint ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={3}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {phaseHint}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
