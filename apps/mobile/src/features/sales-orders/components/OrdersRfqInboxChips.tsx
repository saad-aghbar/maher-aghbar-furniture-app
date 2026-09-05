import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import type { RequestInboxCounts } from '@/api/modules/requests';
import { honestJourneyCount } from '../honestJourneyCount';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type RfqInboxSubchip = 'all' | 'waiting' | 'needs_info' | 'quoted' | 'drafts';

export const RFQ_INBOX_CHIPS: RfqInboxSubchip[] = [
  'all',
  'waiting',
  'needs_info',
  'quoted',
  'drafts',
];

const RFQ_INBOX_ROWS: RfqInboxSubchip[][] = [
  ['all', 'waiting', 'needs_info'],
  ['quoted', 'drafts'],
];

export const RFQ_SUBCHIP_STATUSES: Record<RfqInboxSubchip, string[] | null> = {
  all: null,
  waiting: ['SUBMITTED', 'UNDER_REVIEW'],
  needs_info: ['NEEDS_INFORMATION'],
  quoted: ['READY_FOR_QUOTATION', 'QUOTED'],
  drafts: ['DRAFT'],
};

/** Server statusGroup for each Factory Review chip (COUNT=DATASET). */
export const RFQ_SUBCHIP_STATUS_GROUP: Record<RfqInboxSubchip, string> = {
  all: 'open_inbox',
  waiting: 'waiting_review',
  needs_info: 'needs_information',
  quoted: 'quoted',
  drafts: 'drafts',
};

const CHIP_ICON: Record<RfqInboxSubchip, keyof typeof Ionicons.glyphMap> = {
  all: 'layers-outline',
  waiting: 'hourglass-outline',
  needs_info: 'alert-circle-outline',
  quoted: 'document-text-outline',
  drafts: 'document-outline',
};

type Props = {
  value: RfqInboxSubchip;
  onChange: (next: RfqInboxSubchip) => void;
  counts?: RequestInboxCounts | null;
};

/**
 * Customer-request inbox — two-row period cells on a parchment board.
 * All five statuses stay on screen. Active = brandSoft + 3px bottom bar.
 */
export function OrdersRfqInboxChips({ value, onChange, counts }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
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
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="file-tray-outline" size={14} color={colors.brand} />
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            flex: 1,
            fontSize: 11,
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.orders.requestsInboxEyebrow')}
        </AppText>
      </View>

      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 6 }
            : { paddingLeft: theme.spacing.sm + 6 }),
        }}
      >
        {RFQ_INBOX_ROWS.map((row) => (
          <View
            key={row.join('-')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {row.map((key) => {
              const selected = value === key;
              const label = t(`mobile.orders.rfqInbox.${key}`);
              const count = counts?.[key] ?? 0;
              return (
                <InboxCell
                  key={key}
                  icon={CHIP_ICON[key]}
                  label={label}
                  count={count}
                  selected={selected}
                  titleWeight={titleWeight}
                  onPress={() => {
                    if (key === value) return;
                    void haptics.selection();
                    onChange(key);
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function InboxCell({
  icon,
  label,
  count,
  selected,
  titleWeight,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  selected: boolean;
  titleWeight: 'medium' | 'semibold';
  onPress: () => void;
}) {
  const { locale } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${count}`}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 64,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.borderStrong,
        backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            backgroundColor: colors.brand,
          }}
        />
      ) : null}
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.brand : colors.border,
        }}
      >
        <Ionicons
          name={icon}
          size={13}
          color={selected ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="title"
        weight={titleWeight}
        align="center"
        dir="ltr"
        style={{
          color: selected ? colors.brand : colors.textPrimary,
          fontSize: 16,
          lineHeight: 20,
          letterSpacing: -0.3,
          fontVariant: ['tabular-nums'],
        }}
      >
        {honestJourneyCount(count)}
      </AppText>
      <AppText
        variant="caption"
        weight={selected ? titleWeight : 'medium'}
        numberOfLines={2}
        align="center"
        style={{
          fontSize: 11,
          lineHeight: 13,
          letterSpacing: locale === 'ar' ? 0 : 0.3,
          color: selected ? colors.brand : colors.textSecondary,
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
