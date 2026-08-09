import { useRef } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  hasPhoto?: boolean;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onRemovePhoto?: () => void;
  /**
   * Required when this sheet opens on top of another BottomSheet
   * (e.g. Add product) so the host Modal can yield.
   */
  overlay?: boolean;
};

/**
 * Floor product-photo source picker — take / library / remove boards.
 * Defers camera/library until the sheet Modal fully unmounts (avoids iOS picker flash-dismiss).
 */
export function ProductPhotoSourceSheet({
  open,
  onClose,
  hasPhoto = false,
  onTakePhoto,
  onChoosePhoto,
  onRemovePhoto,
  overlay = false,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pendingActionRef = useRef<(() => void) | null>(null);

  const options: Array<{
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    destructive?: boolean;
    brand?: boolean;
    /** Needs another Modal — wait for this sheet to fully close first. */
    deferUntilClosed?: boolean;
  }> = [
    {
      key: 'camera',
      label: t('catalog.takeProductPhoto'),
      icon: 'camera-outline',
      onPress: onTakePhoto,
      brand: true,
      deferUntilClosed: true,
    },
    {
      key: 'library',
      label: t('catalog.chooseProductPhoto'),
      icon: 'images-outline',
      onPress: onChoosePhoto,
      brand: true,
      deferUntilClosed: true,
    },
  ];

  if (hasPhoto && onRemovePhoto) {
    options.push({
      key: 'remove',
      label: t('catalog.removeProductPhoto'),
      icon: 'trash-outline',
      onPress: onRemovePhoto,
      destructive: true,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      }}
      title={t('catalog.changeProductPhoto')}
      fitContent
      maxHeight={420}
      overlay={overlay}
    >
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="caption" color="muted">
          {t('catalog.productPhotoTapHint')}
        </AppText>

        <View style={{ gap: theme.spacing.sm }}>
          {options.map((opt) => (
            <AnimatedPressable
              key={opt.key}
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              onPress={() => {
                void haptics.selection();
                if (opt.deferUntilClosed) {
                  pendingActionRef.current = opt.onPress;
                  onClose();
                  return;
                }
                onClose();
                opt.onPress();
              }}
              style={{
                minHeight: 56,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: opt.destructive
                  ? colors.error
                  : opt.brand
                    ? colors.brand
                    : colors.borderStrong,
                backgroundColor: opt.brand
                  ? colors.brandSoft
                  : opt.destructive
                    ? colors.errorSoft
                    : colors.surface,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={
                    opt.destructive ? colors.error : opt.brand ? colors.brand : colors.textPrimary
                  }
                />
              </View>
              <AppText
                variant="body"
                weight={titleWeight}
                color={opt.destructive ? 'error' : opt.brand ? 'brand' : 'primary'}
                style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
              >
                {opt.label}
              </AppText>
            </AnimatedPressable>
          ))}
        </View>

        <SecondaryButton
          label={t('common.cancel')}
          onPress={onClose}
          style={{ borderRadius: theme.radius.xl }}
        />
      </View>
    </BottomSheet>
  );
}
