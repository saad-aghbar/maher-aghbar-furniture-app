import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { productionFloorStatusLabel } from '../selectProduction';

const HERO = 96;

function priorityText(priority: string, t: (key: string) => string): string {
  const key = `mobile.production.priority.${priority}`;
  const label = t(key);
  return label === key ? priority : label;
}

type Props = {
  number: string;
  title: string;
  status: string;
  priority: string;
  isLate: boolean;
  imageUrl?: string | null;
  onPressImage: () => void;
};

/**
 * Production order identity — header band, media, number, title.
 */
export function ProductionIdentityBoard({
  number,
  title,
  status,
  priority,
  isLate,
  imageUrl,
  onPressImage,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const urgent = priority === 'URGENT' || priority === 'HIGH';
  const accent = isLate ? colors.error : urgent ? colors.warning : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: isLate ? colors.error : urgent ? colors.warning : colors.borderStrong,
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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: isLate || urgent ? 0.9 : 0.55,
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
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}
        >
          <StatusBadge
            status={status}
            dot
            label={productionFloorStatusLabel(status, t('mobile.production.inProduction'))}
          />
          {urgent ? (
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{ color: colors.warning, fontSize: 11 }}
              numberOfLines={1}
            >
              {priorityText(priority, t)}
            </AppText>
          ) : null}
          {isLate ? (
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{ color: colors.error, fontSize: 11 }}
              numberOfLines={1}
            >
              {t('mobile.production.late')}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" color="brand" weight={titleWeight} dir="ltr">
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
          <AnimatedPressable
            variant="card"
            disabled={!imageUrl}
            accessibilityRole={imageUrl ? 'button' : 'image'}
            accessibilityLabel={title}
            onPress={() => {
              if (!imageUrl) return;
              void haptics.selection();
              onPressImage();
            }}
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
              <>
                <Image
                  source={{ uri: imageUrl }}
                  style={{ width: HERO, height: HERO }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(30,26,27,0.55)',
                  }}
                >
                  <Ionicons name="expand-outline" size={14} color="#F5F2EA" />
                </View>
              </>
            ) : (
              <Ionicons name="cube-outline" size={32} color={colors.brand} />
            )}
          </AnimatedPressable>
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
              numberOfLines={1}
              dir="ltr"
              style={{ fontSize: 22, lineHeight: 28, textAlign: isRTL ? 'right' : 'left' }}
            >
              {number}
            </AppText>
            <AppText
              variant="body"
              color="secondary"
              numberOfLines={3}
              style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 20 }}
            >
              {title}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}
