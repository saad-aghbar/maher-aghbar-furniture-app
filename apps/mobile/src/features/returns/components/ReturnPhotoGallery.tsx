import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  title: string;
  uris: string[];
  emptyLabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Horizontal multi-photo gallery for reason / damage evidence.
 */
export function ReturnPhotoGallery({
  title,
  uris,
  emptyLabel,
  icon = 'images-outline',
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { width } = useWindowDimensions();
  const [viewer, setViewer] = useState<string | null>(null);
  const thumb = Math.min(112, Math.round((width - theme.spacing.lg * 2 - theme.spacing.sm * 2) / 2.6));
  const resolved = uris
    .map((u) => resolveOrderMediaUri(u))
    .filter((u): u is string => Boolean(u));

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={14} color={colors.brand} />
          </View>
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              flex: 1,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.55,
              fontSize: 11,
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </AppText>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="caption" color="muted" dir="ltr" style={{ fontSize: 11 }}>
            {String(resolved.length)}
          </AppText>
        </View>
      </View>

      {resolved.length === 0 ? (
        <View
          style={{
            paddingVertical: theme.spacing.xl,
            paddingHorizontal: theme.spacing.lg,
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={20} color={colors.textMuted} />
          </View>
          <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            {emptyLabel}
          </AppText>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          {resolved.map((uri, index) => (
            <Pressable
              key={`${uri}-${index}`}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${title} ${index + 1}`}
              onPress={() => {
                void haptics.selection();
                setViewer(uri);
              }}
              style={{
                width: thumb,
                height: thumb,
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View
                style={{
                  position: 'absolute',
                  bottom: 6,
                  ...(isRTL ? { left: 6 } : { right: 6 }),
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: theme.radius.sm,
                  backgroundColor: 'rgba(20,16,12,0.55)',
                }}
              >
                <AppText variant="caption" dir="ltr" style={{ color: '#fff', fontSize: 10 }}>
                  {`${index + 1}/${resolved.length}`}
                </AppText>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(viewer)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.88)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing.lg,
          }}
          onPress={() => setViewer(null)}
        >
          {viewer ? (
            <Image
              source={{ uri: viewer }}
              style={{ width: '100%', height: '70%' }}
              resizeMode="contain"
            />
          ) : null}
          <AppText variant="caption" style={{ color: '#fff', marginTop: theme.spacing.md }}>
            {t('common.close')}
          </AppText>
        </Pressable>
      </Modal>
    </View>
  );
}
