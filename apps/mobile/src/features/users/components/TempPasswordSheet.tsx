import * as Clipboard from 'expo-clipboard';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  username?: string | null;
  temporaryPassword: string;
};

/**
 * Shows a temporary password after create / reset — copy-friendly board.
 */
export function TempPasswordSheet({
  open,
  onClose,
  title,
  message,
  username,
  temporaryPassword,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const copyPassword = async () => {
    try {
      await Clipboard.setStringAsync(temporaryPassword);
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('mobile.copied') });
    } catch {
      void haptics.error();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title} fitContent>
      <View style={{ gap: theme.spacing.lg }}>
        <AppText
          variant="body"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {message}
        </AppText>

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
          {username ? (
            <View
              style={{
                padding: theme.spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                gap: 4,
              }}
            >
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  letterSpacing: locale === 'ar' ? 0 : 0.4,
                  fontSize: 10,
                }}
              >
                {t('users.username')}
              </AppText>
              <AppText
                weight={titleWeight}
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
              >
                {username}
              </AppText>
            </View>
          ) : null}

          <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
            <AppText
              variant="caption"
              color="muted"
              style={{
                textAlign: isRTL ? 'right' : 'left',
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                letterSpacing: locale === 'ar' ? 0 : 0.4,
                fontSize: 10,
              }}
            >
              {t('users.tempPassword')}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <AppText
                weight="semibold"
                dir="ltr"
                style={{
                  flex: 1,
                  fontSize: 20,
                  textAlign: isRTL ? 'right' : 'left',
                  color: colors.brand,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {temporaryPassword}
              </AppText>
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.copyNotes')}
                onPress={() => void copyPassword()}
                style={{
                  width: theme.sizes.touch.min,
                  height: theme.sizes.touch.min,
                  borderRadius: theme.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="copy-outline" size={18} color={colors.brand} />
              </AnimatedPressable>
            </View>
          </View>
        </View>

        <PrimaryButton
          label={t('common.close')}
          onPress={onClose}
          style={{
            borderRadius: theme.radius.full,
            minHeight: theme.sizes.touch.min,
            paddingVertical: 0,
          }}
        />
      </View>
    </BottomSheet>
  );
}
