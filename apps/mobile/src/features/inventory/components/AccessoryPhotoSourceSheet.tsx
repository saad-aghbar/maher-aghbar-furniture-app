import { useRef } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { InventorySheetFooter } from './InventorySheetFooter';

type Props = {
  open: boolean;
  onClose: () => void;
  hasPhoto?: boolean;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onRemovePhoto?: () => void;
};

/**
 * Floor photo source picker — elevated option boards + pill cancel.
 * Defers camera/library until the sheet Modal fully unmounts (avoids iOS picker flash-dismiss).
 */
export function AccessoryPhotoSourceSheet({
  open,
  onClose,
  hasPhoto = false,
  onTakePhoto,
  onChoosePhoto,
  onRemovePhoto,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pendingActionRef = useRef<(() => void) | null>(null);

  const options: Array<{
    key: string;
    label: string;
    onPress: () => void;
    destructive?: boolean;
    brand?: boolean;
    deferUntilClosed?: boolean;
  }> = [
    {
      key: 'camera',
      label: t('mobile.inventory.takePhoto'),
      onPress: onTakePhoto,
      brand: true,
      deferUntilClosed: true,
    },
    {
      key: 'library',
      label: t('mobile.inventory.choosePhoto'),
      onPress: onChoosePhoto,
      deferUntilClosed: true,
    },
  ];

  if (hasPhoto && onRemovePhoto) {
    options.push({
      key: 'remove',
      label: t('mobile.inventory.removePhoto'),
      onPress: onRemovePhoto,
      destructive: true,
    });
  }

  const sheetHeight = 200 + options.length * 72;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      }}
      title={t('mobile.inventory.accessoryPhoto')}
      sheetHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <AppText variant="caption" color="muted">
          {t('mobile.inventory.accessoryPhotoHint')}
        </AppText>

        <View style={{ gap: theme.spacing.sm, flex: 1 }}>
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
                backgroundColor: opt.brand ? colors.brandSoft : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                ...theme.elevation.card,
              }}
            >
              <AppText
                variant="body"
                weight={titleWeight}
                color={opt.destructive ? 'error' : opt.brand ? 'brand' : 'primary'}
                align="center"
              >
                {opt.label}
              </AppText>
            </AnimatedPressable>
          ))}
        </View>

        <InventorySheetFooter onSecondary={onClose} />
      </View>
    </BottomSheet>
  );
}
