import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export type DealerUploadItem = {
  id: string;
  uri?: string;
  name: string;
  kind: 'image' | 'pdf' | 'handwritten';
  status: 'ready' | 'uploading' | 'failed';
  progress?: number;
};

type Props = {
  items: DealerUploadItem[];
  onAddCamera?: () => void;
  onAddGallery?: () => void;
  onAddPdf?: () => void;
  onAddHandwritten?: () => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  addLabels?: {
    camera: string;
    gallery: string;
    pdf: string;
    handwritten?: string;
  };
};

export function DealerUploadGrid({
  items,
  onAddCamera,
  onAddGallery,
  onAddPdf,
  onAddHandwritten,
  onRetry,
  onRemove,
  addLabels,
}: Props) {
  const { isRTL, t } = useLocale();
  const { colors, theme } = useTheme();

  const actions = [
    onAddCamera
      ? {
          key: 'camera',
          icon: 'camera-outline' as const,
          label: addLabels?.camera ?? t('mobile.dealerUi.camera'),
          onPress: onAddCamera,
        }
      : null,
    onAddGallery
      ? {
          key: 'gallery',
          icon: 'images-outline' as const,
          label: addLabels?.gallery ?? t('mobile.dealerUi.gallery'),
          onPress: onAddGallery,
        }
      : null,
    onAddPdf
      ? {
          key: 'pdf',
          icon: 'document-outline' as const,
          label: addLabels?.pdf ?? t('mobile.dealerUi.pdf'),
          onPress: onAddPdf,
        }
      : null,
    onAddHandwritten
      ? {
          key: 'handwritten',
          icon: 'create-outline' as const,
          label: addLabels?.handwritten ?? t('mobile.dealerUi.handwritten'),
          onPress: onAddHandwritten,
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  }[];

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {actions.map((action) => (
          <AnimatedPressable
            key={action.key}
            onPress={() => {
              void haptics.selection();
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={{
              minHeight: 44,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
            }}
          >
            <Ionicons name={action.icon} size={18} color={colors.textPrimary} />
            <AppText variant="caption" weight="medium">
              {action.label}
            </AppText>
          </AnimatedPressable>
        ))}
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {items.map((item) => (
          <View
            key={item.id}
            style={{
              width: 104,
              borderRadius: theme.radius.md,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: item.status === 'failed' ? colors.error : colors.border,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            {item.kind !== 'pdf' && item.uri ? (
              <Image source={{ uri: item.uri }} style={{ width: '100%', height: 88 }} resizeMode="cover" />
            ) : (
              <View style={{ height: 88, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons
                  name={item.kind === 'pdf' ? 'document-text-outline' : 'create-outline'}
                  size={28}
                  color={colors.textMuted}
                />
              </View>
            )}
            <View style={{ padding: 6, gap: 4 }}>
              <AppText variant="caption" numberOfLines={1}>
                {item.name}
              </AppText>
              {item.status === 'uploading' ? (
                <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2 }}>
                  <View
                    style={{
                      width: `${Math.round((item.progress ?? 0) * 100)}%`,
                      height: '100%',
                      backgroundColor: colors.brand,
                      borderRadius: 2,
                    }}
                  />
                </View>
              ) : null}
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                {item.status === 'failed' && onRetry ? (
                  <Pressable
                    onPress={() => onRetry(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.retry')}
                    hitSlop={6}
                  >
                    <AppText variant="caption" color="brand">
                      {t('common.retry')}
                    </AppText>
                  </Pressable>
                ) : null}
                {onRemove ? (
                  <Pressable
                    onPress={() => onRemove(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.delete')}
                    hitSlop={6}
                  >
                    <AppText variant="caption" color="error">
                      {t('common.delete')}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
