import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { OrderBoardCard, OrderSectionHeader } from './OrderBoardCard';

export type LinkedTableRow = {
  id: string;
  number: string;
  status?: string | null;
  /** Optional display label (e.g. dealer return lifecycle). */
  statusLabel?: string | null;
  details?: string | null;
  onPress?: () => void;
};

type Props = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  empty?: string;
  rows: LinkedTableRow[];
};

/**
 * Admin-web LinkedSection style: NUMBER / STATUS / DETAILS table inside a floor board.
 */
export function LinkedTablePanel({
  title,
  icon = 'link-outline',
  empty,
  rows,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const numberLabel = t('common.number');
  const statusLabel = t('common.status');
  const detailsLabel = t('common.details');

  return (
    <OrderBoardCard>
      <OrderSectionHeader icon={icon} label={title} />
      {rows.length === 0 ? (
        <AppText variant="caption" color="muted">
          {empty ?? '—'}
        </AppText>
      ) : (
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: colors.surface,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }}
          >
            <HeaderCell
              label={numberLabel === 'common.number' ? 'Number' : numberLabel}
              flex={1.1}
              isRTL={isRTL}
            />
            <HeaderCell
              label={statusLabel}
              flex={1.2}
              isRTL={isRTL}
            />
            <HeaderCell
              label={detailsLabel}
              flex={1}
              isRTL={isRTL}
              alignEnd
            />
          </View>
          {rows.map((row, index) => {
            const pressable = Boolean(row.onPress);
            return (
              <Pressable
                key={row.id}
                disabled={!pressable}
                onPress={() => {
                  if (!row.onPress) return;
                  void haptics.selection();
                  row.onPress();
                }}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm + 2,
                  minHeight: theme.sizes.touch.min,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                  backgroundColor: pressable ? colors.surfaceSecondary : 'transparent',
                }}
              >
                <AppText
                  weight={titleWeight}
                  dir="ltr"
                  numberOfLines={1}
                  style={{
                    flex: 1.1,
                    minWidth: 0,
                    color: pressable ? colors.brand : colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                    fontSize: 13,
                  }}
                >
                  {row.number}
                </AppText>
                <View style={{ flex: 1.2, minWidth: 0, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                  {row.status ? (
                    <StatusBadge
                      status={row.status}
                      label={row.statusLabel ?? undefined}
                      dot
                    />
                  ) : (
                    <AppText variant="caption" color="muted">—</AppText>
                  )}
                </View>
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={2}
                  dir="ltr"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: isRTL ? 'left' : 'right',
                    fontSize: 12,
                  }}
                >
                  {row.details?.trim() || '—'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
    </OrderBoardCard>
  );
}

function HeaderCell({
  label,
  flex,
  isRTL,
  alignEnd,
}: {
  label: string;
  flex: number;
  isRTL: boolean;
  alignEnd?: boolean;
}) {
  return (
    <AppText
      variant="caption"
      color="muted"
      weight="semibold"
      style={{
        flex,
        minWidth: 0,
        textTransform: 'uppercase',
        letterSpacing: 0.55,
        fontSize: 10,
        textAlign: alignEnd
          ? isRTL
            ? 'left'
            : 'right'
          : isRTL
            ? 'right'
            : 'left',
      }}
    >
      {label}
    </AppText>
  );
}
