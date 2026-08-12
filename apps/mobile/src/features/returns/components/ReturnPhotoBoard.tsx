import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type ReturnPhotoSlot = {
  key: string;
  previewUri: string;
};

type Props = {
  photos: ReturnPhotoSlot[];
  loading?: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onRemove: (key: string) => void;
  /** Max photos (for add affordance). */
  max?: number;
};

/**
 * Return photo album — empty state fills with Camera + Gallery tiles;
 * filled state shows thumbnails plus compact add actions.
 */
export function ReturnPhotoBoard({
  photos,
  loading = false,
  onCamera,
  onGallery,
  onRemove,
  max = 8,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canAdd = photos.length < max && !loading;

  if (photos.length === 0) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.brand,
            backgroundColor: colors.brandSoft,
            padding: theme.spacing.md,
            gap: theme.spacing.md,
            opacity: loading ? 0.75 : 1,
          }}
        >
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: theme.spacing.sm }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons
                name={loading ? 'cloud-upload-outline' : 'images-outline'}
                size={22}
                color={colors.brand}
              />
            </View>
            <AppText
              variant="caption"
              color="muted"
              align="center"
              style={{ lineHeight: 18 }}
            >
              {loading
                ? t('mobile.returns.uploadingPhotos')
                : t('mobile.returns.photoDropHint')}
            </AppText>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            <SourceTile
              icon="camera-outline"
              label={t('mobile.dealerUi.camera')}
              disabled={loading}
              onPress={onCamera}
              flex
            />
            <SourceTile
              icon="images-outline"
              label={t('mobile.dealerUi.gallery')}
              disabled={loading}
              onPress={onGallery}
              flex
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {photos.map((p) => (
          <View key={p.key} style={{ width: 96, height: 96 }}>
            <Image
              source={{ uri: p.previewUri }}
              style={{
                width: 96,
                height: 96,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surfaceSecondary,
              }}
              resizeMode="cover"
            />
            <AnimatedPressable
              variant="button"
              onPress={() => {
                void haptics.selection();
                onRemove(p.key);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete')}
              style={{
                position: 'absolute',
                top: -6,
                ...(isRTL ? { left: -6 } : { right: -6 }),
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                ...theme.elevation.rest,
              }}
            >
              <Ionicons name="close" size={14} color={colors.textPrimary} />
            </AnimatedPressable>
          </View>
        ))}

        {canAdd ? (
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: theme.radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.brand,
              backgroundColor: colors.brandSoft,
              overflow: 'hidden',
            }}
          >
            <AnimatedPressable
              variant="button"
              onPress={onCamera}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderBottomWidth: 1,
                borderBottomColor: `${colors.brand}33`,
                gap: 2,
              }}
            >
              <Ionicons name="camera-outline" size={18} color={colors.brand} />
              <AppText variant="caption" color="brand" style={{ fontSize: 10 }}>
                {t('mobile.dealerUi.camera')}
              </AppText>
            </AnimatedPressable>
            <AnimatedPressable
              variant="button"
              onPress={onGallery}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <Ionicons name="images-outline" size={18} color={colors.brand} />
              <AppText variant="caption" color="brand" style={{ fontSize: 10 }}>
                {t('mobile.dealerUi.gallery')}
              </AppText>
            </AnimatedPressable>
          </View>
        ) : null}
      </View>

      {loading ? (
        <AppText variant="caption" color="muted" weight={titleWeight}>
          {t('mobile.returns.uploadingPhotos')}
        </AppText>
      ) : null}
    </View>
  );
}

function SourceTile({
  icon,
  label,
  onPress,
  disabled,
  flex,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  flex?: boolean;
}) {
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flex: flex ? 1 : undefined,
        minHeight: 52,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.brand} />
      <AppText weight="semibold" style={{ color: colors.textPrimary }}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
