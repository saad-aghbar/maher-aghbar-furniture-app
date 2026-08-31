import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Supplier } from '@/api/modules/purchasing';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { localizedNamed } from '../selectPurchase';

type Props = {
  supplier: Supplier;
  onEdit?: () => void;
  onDelete?: () => void;
};

/**
 * Supplier floor card — name, contact, certified chip, Edit + trash footer.
 */
export function SupplierBoardCard({ supplier, onEdit, onDelete }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedNamed(locale, supplier);
  const phone = supplier.phone?.trim() || null;
  const whatsapp = supplier.whatsappPhone?.trim() || null;
  const company = supplier.companyName?.trim() || null;
  const certified = supplier.isCertified !== false;

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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />

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
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
            >
              {name}
            </AppText>
            {company ? (
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {company}
              </AppText>
            ) : null}
            {supplier.code ? (
              <AppText
                variant="caption"
                color="muted"
                dir="ltr"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {supplier.code}
              </AppText>
            ) : null}
          </View>
          {certified ? (
            <StatusBadge status="ACTIVE" label={t('catalog.isCertified')} branded />
          ) : null}
        </View>

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
          <MetaRow label={t('catalog.phone')} value={phone ?? '—'} ltr />
          <MetaRow
            label={t('catalog.whatsappPhone')}
            value={whatsapp ?? phone ?? '—'}
            ltr
          />
        </View>
      </View>

      {onEdit || onDelete ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            {onEdit ? (
              <FooterChip
                label={t('common.edit')}
                icon="create-outline"
                onPress={onEdit}
                emphasis
              />
            ) : null}
          </View>
          {onDelete ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.purchasing.deleteSupplier')}
              onPress={() => {
                void haptics.selection();
                onDelete();
              }}
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
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
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MetaRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors } = useTheme();

  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 10,
          letterSpacing: locale === 'ar' ? 0 : 0.4,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="bodySecondary"
        weight="medium"
        dir={ltr ? 'ltr' : 'auto'}
        style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }}
      >
        {value}
      </AppText>
    </View>
  );
}

function FooterChip({
  label,
  icon,
  onPress,
  emphasis,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  emphasis?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flexShrink: 0,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: theme.sizes.touch.min - 8,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: emphasis ? colors.brand : colors.borderStrong,
        backgroundColor: emphasis ? colors.surface : 'transparent',
      }}
    >
      <Ionicons name={icon} size={14} color={emphasis ? colors.brand : colors.textSecondary} />
      <AppText
        variant="caption"
        weight="semibold"
        style={{ color: emphasis ? colors.brand : colors.textPrimary, fontSize: 13 }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
