import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { formatMapCoord, normalizeMapCoords, type MapCoords } from '@/components/maps/mapCoords';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  coords: MapCoords | null;
  onPress: () => void;
  onClear?: () => void;
  label?: string;
  hint?: string;
};

/**
 * Floor board that opens the map pin picker — used on address forms.
 */
export function LocationPinField({ coords, onPress, onClear, label, hint }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pin = normalizeMapCoords(coords);
  const pinned = pin != null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText
        variant="caption"
        color="secondary"
        weight={titleWeight}
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {label ?? t('mobile.newOrder.openMap')}
      </AppText>

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={label ?? t('mobile.newOrder.openMap')}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: pinned ? colors.brand : colors.borderStrong,
          backgroundColor: pinned ? colors.brandSoft : colors.surface,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: pinned ? colors.brand : colors.border,
          }}
        >
          <Ionicons
            name={pinned ? 'location' : 'location-outline'}
            size={22}
            color={colors.brand}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <AppText
            variant="body"
            weight={titleWeight}
            color={pinned ? 'brand' : 'primary'}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {pinned && pin
              ? t('mobile.newOrder.coordsLabel', {
                  lat: formatMapCoord(pin.latitude),
                  lng: formatMapCoord(pin.longitude),
                })
              : t('mobile.newOrder.mapPinShort')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {hint ?? t('mobile.newOrder.mapOptionalHint')}
          </AppText>
        </View>

        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </AnimatedPressable>

      {pinned && onClear ? (
        <AnimatedPressable
          variant="button"
          onPress={() => {
            void haptics.selection();
            onClear();
          }}
          style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', paddingVertical: 4 }}
        >
          <AppText variant="caption" color="brand" weight="semibold">
            {t('mobile.newOrder.clearLocation')}
          </AppText>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
