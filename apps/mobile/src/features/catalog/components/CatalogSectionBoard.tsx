import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { MoreBoard } from '@/features/more/components/MoreBoard';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  title?: string;
  titleWeight: 'medium' | 'semibold';
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
};

/** Titled parchment board with optional + Add — same pattern as the product screen. */
export function CatalogSectionBoard({
  title,
  titleWeight,
  actionLabel,
  onAction,
  children,
}: Props) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  const showHeader = Boolean(title) || Boolean(actionLabel && onAction);

  return (
    <MoreBoard
      style={{
        padding: theme.spacing.lg,
        paddingLeft: isRTL ? theme.spacing.lg : theme.spacing.lg + 4,
        paddingRight: isRTL ? theme.spacing.lg + 4 : theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      {showHeader ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingBottom: theme.spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}
        >
          {title ? (
            <AppText variant="label" weight={titleWeight} style={{ flex: 1 }}>
              {title}
            </AppText>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {actionLabel && onAction ? (
            <SecondaryButton
              label={`+ ${actionLabel}`}
              onPress={() => {
                void haptics.selection();
                onAction();
              }}
              style={{
                borderRadius: theme.radius.xl,
                paddingHorizontal: theme.spacing.md,
                minHeight: 36,
              }}
            />
          ) : null}
        </View>
      ) : null}
      {children}
    </MoreBoard>
  );
}
