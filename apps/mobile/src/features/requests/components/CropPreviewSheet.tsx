import { Image, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  uri: string | null;
  onClose: () => void;
};

/** Full-sheet crop preview. Bounding boxes are not modeled — show the original photo. */
export function CropPreviewSheet({ open, uri, onClose }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.newOrder.cropPreview')}
      fitContent
      overlay={false}
    >
      <View testID="crop-preview-sheet" style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        {uri ? (
          <Image
            source={{ uri }}
            accessibilityLabel={t('mobile.newOrder.handwritten')}
            style={{ width: '100%', height: 280, borderRadius: theme.radius.lg, backgroundColor: colors.surfaceSecondary }}
            resizeMode="contain"
          />
        ) : (
          <AppText color="muted">{t('mobile.newOrder.scanNoPhoto')}</AppText>
        )}
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          testID="crop-preview-close"
          onPress={() => {
            void haptics.selection();
            onClose();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText weight={titleWeight}>{t('common.close')}</AppText>
        </AnimatedPressable>
      </View>
    </BottomSheet>
  );
}
