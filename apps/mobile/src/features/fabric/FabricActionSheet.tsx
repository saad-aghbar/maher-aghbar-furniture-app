import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useSheetListViewport } from '@/components/sheets/sheetListViewport';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  overlay?: boolean;
  maxHeight?: number;
};

/**
 * Shared fabric sheet — board body, optional icon header band, pinned pill footer.
 * Sizes to content so short sheets (override, wait, redirect) do not leave empty space.
 */
export function FabricActionSheet({
  open,
  onClose,
  title,
  eyebrow,
  icon = 'cube-outline',
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  overlay = false,
  maxHeight,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { sheetHeight, listHeight } = useSheetListViewport();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const cancel = secondaryLabel ?? t('mobile.purchasing.cancel');
  const heightCap = Math.min(sheetHeight, maxHeight ?? sheetHeight);
  const scrollCap = listHeight;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      fitContent
      maxHeight={heightCap}
      overlay={overlay}
    >
      <View style={{ gap: theme.spacing.md }}>
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
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: colors.brand,
              opacity: 0.55,
              ...(isRTL ? { right: 0 } : { left: 0 }),
            }}
          />
          {eyebrow ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                ...(isRTL
                  ? { paddingRight: theme.spacing.lg + 4 }
                  : { paddingLeft: theme.spacing.lg + 4 }),
                backgroundColor: colors.surfaceSecondary,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Ionicons name={icon} size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  style={{
                    color: colors.brand,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    letterSpacing: locale === 'ar' ? 0 : 0.5,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {eyebrow}
                </AppText>
              </View>
            </View>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={{ maxHeight: scrollCap }}
            contentContainerStyle={{
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
              paddingBottom: theme.spacing.lg,
              ...(isRTL
                ? { paddingRight: theme.spacing.lg + 4 }
                : { paddingLeft: theme.spacing.lg + 4 }),
            }}
          >
            {children}
          </ScrollView>
        </View>

        <View
          style={{
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <SecondaryButton
            label={cancel}
            onPress={onSecondary ?? onClose}
            disabled={primaryLoading}
            style={{
              flex: 1,
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
          <PrimaryButton
            label={primaryLabel}
            haptic="light"
            loading={primaryLoading}
            disabled={primaryDisabled || primaryLoading}
            onPress={onPrimary}
            style={{
              flex: 1.35,
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
              ...orderBoardShadow(colorScheme),
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

export function FabricInset({ children }: { children: ReactNode }) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      {children}
    </View>
  );
}
