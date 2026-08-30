import { useRef } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type ActionSheetItem = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Wait until the sheet Modal fully unmounts before running.
   * Required for camera / image library / nested Modals (avoids iOS crash races).
   */
  deferUntilClosed?: boolean;
};

type ActionSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionSheetItem[];
  cancelLabel?: string;
};

/**
 * Content-fit action sheet — soft elevated rows matching the floor aesthetic.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
  cancelLabel,
}: ActionSheetProps) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, t } = useLocale();
  const resolvedCancel = cancelLabel ?? t('common.cancel');
  const pendingActionRef = useRef<(() => void) | null>(null);

  const shadow =
    colorScheme === 'dark'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 4,
        }
      : {
          shadowColor: '#1E1A1B',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
        };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      }}
      title={title}
      fitContent
    >
      <View style={{ gap: theme.spacing.sm }}>
        {actions.map((action) => {
          const ink = action.destructive ? colors.error : colors.textPrimary;
          const iconColor = action.destructive ? colors.error : colors.brand;
          const softBg = action.destructive ? colors.errorSoft : colors.surfaceSecondary;
          return (
            <AnimatedPressable
              key={action.label}
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              onPress={() => {
                void haptics.selection();
                if (action.deferUntilClosed) {
                  pendingActionRef.current = action.onPress;
                  onClose();
                  return;
                }
                onClose();
                // Non-modal actions can run after a short settle.
                setTimeout(() => action.onPress(), 0);
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: action.destructive ? colors.error : colors.borderStrong,
                backgroundColor: colors.surface,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                overflow: 'hidden',
                ...shadow,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                  width: 3,
                  backgroundColor: iconColor,
                  opacity: action.destructive ? 0.85 : 0.5,
                }}
              />
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: softBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginLeft: isRTL ? 0 : 4,
                  marginRight: isRTL ? 4 : 0,
                }}
              >
                <Ionicons
                  name={
                    action.icon ??
                    (action.destructive ? 'warning-outline' : 'open-outline')
                  }
                  size={18}
                  color={iconColor}
                />
              </View>
              <AppText
                variant="label"
                weight="semibold"
                style={{ color: ink, flex: 1 }}
                align={isRTL ? 'end' : 'start'}
              >
                {action.label}
              </AppText>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color={colors.textMuted}
              />
            </AnimatedPressable>
          );
        })}

        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={resolvedCancel}
          onPress={() => {
            void haptics.selection();
            pendingActionRef.current = null;
            onClose();
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: theme.spacing.xs,
          }}
        >
          <AppText variant="label" weight="semibold" style={{ color: colors.brand }}>
            {resolvedCancel}
          </AppText>
        </AnimatedPressable>
      </View>
    </BottomSheet>
  );
}
