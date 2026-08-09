import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { PurchaseRequestCardModel } from '../selectPurchase';

type Props = {
  request: PurchaseRequestCardModel;
  onPress: () => void;
};

export function PurchaseRequestBoardCard({ request, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const hasPo = Boolean(request.linkedPoNumber);
  const warehouse = request.warehouseLabel?.trim() || '—';
  const reason = request.reason?.trim() || '—';

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={request.number}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
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
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <StatusBadge status={request.status} dot />
        <AppText variant="caption" color="brand" weight="semibold">
          {t('common.details')}
        </AppText>
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              dir="ltr"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
            >
              {request.number}
            </AppText>
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {request.supplierName}
            </AppText>
          </View>
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            padding: theme.spacing.md,
            gap: theme.spacing.xs,
          }}
        >
          <AppText
            variant="caption"
            color="muted"
            style={{
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              letterSpacing: locale === 'ar' ? 0 : 0.55,
              fontSize: 10,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('catalog.reasonShort')}
          </AppText>
          <AppText
            weight="medium"
            numberOfLines={3}
            style={{
              textAlign: isRTL ? 'right' : 'left',
              lineHeight: 20,
              color: colors.textPrimary,
              fontSize: 14,
            }}
          >
            {reason}
          </AppText>
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <MetaRow
            icon="pricetags-outline"
            label={t('catalog.offersShort')}
            value={String(request.offerCount)}
            valueLtr
            isRTL={isRTL}
          />
          <Divider compact />
          <MetaRow
            icon="cube-outline"
            label={t('catalog.poShort')}
            value={hasPo ? request.linkedPoNumber! : '—'}
            valueLtr={hasPo}
            emphasize={hasPo}
            isRTL={isRTL}
          />
          <Divider compact />
          <MetaRow
            icon="business-outline"
            label={t('catalog.warehouseShort')}
            value={warehouse}
            isRTL={isRTL}
            multiline
          />
        </View>
      </View>
    </AnimatedPressable>
  );
}

function MetaRow({
  icon,
  label,
  value,
  isRTL,
  valueLtr,
  emphasize,
  multiline,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
  emphasize?: boolean;
  multiline?: boolean;
}) {
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
        backgroundColor: emphasize ? colors.brandSoft : 'transparent',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: emphasize ? colors.surface : colors.brandSoft,
          borderWidth: 1,
          borderColor: emphasize ? colors.brand : colors.border,
          marginTop: multiline ? 1 : 0,
        }}
      >
        <Ionicons
          name={icon}
          size={14}
          color={emphasize ? colors.brand : colors.textSecondary}
        />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: 10,
          flexShrink: 0,
          textAlign: isRTL ? 'right' : 'left',
          paddingTop: multiline ? 2 : 0,
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize ? 'semibold' : 'medium'}
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={multiline ? 3 : 1}
        style={{
          flex: 1,
          minWidth: 0,
          color: emphasize ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'left' : 'right',
          lineHeight: multiline ? 20 : undefined,
          fontSize: 13,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
