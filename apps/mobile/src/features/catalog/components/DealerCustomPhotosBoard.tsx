import { useState } from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppText } from '@/components/AppText';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { CatalogFloorEmpty } from '@/features/catalog/components/CatalogFloorList';
import { CatalogSectionBoard } from '@/features/catalog/components/CatalogSectionBoard';
import { ProductPhotoSourceSheet } from '@/features/catalog/components/ProductPhotoSourceSheet';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { presentAfterUiSettle } from '@/features/requests/presentAfterUiSettle';
import type { NewOrderLine } from '@/features/requests/newOrderLine';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  line: NewOrderLine;
  onChange: (next: NewOrderLine) => void;
  titleWeight: 'medium' | 'semibold';
};

function withPhotos(line: NewOrderLine, photoUris: string[]): NewOrderLine {
  return {
    ...line,
    photoUris,
    imageUrl: photoUris[0] ?? '',
  };
}

/**
 * Custom-piece photos on parchment — gallery / camera, thumbs with a trash well.
 */
export function DealerCustomPhotosBoard({ line, onChange, titleWeight }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const { openAccessoryCamera } = useAccessoryCamera();
  const [pickerOpen, setPickerOpen] = useState(false);

  const addUri = (uri: string) => {
    const next = [...line.photoUris, uri];
    void haptics.selection();
    onChange(withPhotos(line, next));
  };

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast({
        variant: 'warning',
        message: toastCopy(
          t('mobile.newOrder.permissionTitle'),
          t('mobile.newOrder.permissionBody'),
        ),
      });
      return;
    }
    const result = await presentAfterUiSettle(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
        exif: false,
      }),
    );
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;
    addUri(uri);
  };

  const pickCamera = async () => {
    const uri = await presentAfterUiSettle(() =>
      openAccessoryCamera({
        title: t('mobile.newOrder.customItemTitle'),
        hint: t('mobile.newOrder.customPhotosHint'),
        aspectRatio: 1.2,
      }),
    );
    if (!uri) return;
    addUri(uri);
  };

  return (
    <>
      <CatalogSectionBoard
        title={t('mobile.newOrder.customPhotos')}
        titleWeight={titleWeight}
        actionLabel={t('mobile.newOrder.addLinePhoto')}
        onAction={() => setPickerOpen(true)}
      >
        <AppText variant="caption" color="muted">
          {t('mobile.newOrder.customPhotosHint')}
        </AppText>
        {line.photoUris.length ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {line.photoUris.map((uri) => (
              <View
                key={uri}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <Image source={{ uri }} style={{ width: 88, height: 88 }} />
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  testID={`custom-photo-remove-${uri.slice(-12)}`}
                  onPress={() => {
                    void haptics.selection();
                    onChange(withPhotos(line, line.photoUris.filter((row) => row !== uri)));
                  }}
                  style={{
                    position: 'absolute',
                    top: 6,
                    ...(isRTL ? { left: 6 } : { right: 6 }),
                    width: 36,
                    height: 36,
                    borderRadius: theme.radius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.errorSoft,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </AnimatedPressable>
              </View>
            ))}
          </View>
        ) : (
          <CatalogFloorEmpty
            title={t('mobile.newOrder.customPhotosEmpty')}
            body={t('mobile.newOrder.customPhotosHint')}
          />
        )}
      </CatalogSectionBoard>

      <ProductPhotoSourceSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onTakePhoto={() => void pickCamera()}
        onChoosePhoto={() => void pickGallery()}
      />
    </>
  );
}
