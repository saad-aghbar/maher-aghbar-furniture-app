import type { Locale } from '@maher/types';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import type { QuotationLine } from '@/api/modules/quotations';
import { useLocale } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { useTheme } from '@/theme';
import { quotationComplexity, quotationLineNet } from '../presentAdminQuotation';

type Props = {
  line: QuotationLine;
};

function lineSpecs(line: QuotationLine): string {
  const parts = [line.material, line.fabric, line.color].filter(Boolean);
  return parts.length ? parts.join(' / ') : '';
}

function lineDims(line: QuotationLine): string {
  const parts = [line.width, line.height, line.depth].filter((v) => v != null && v !== '');
  return parts.length ? parts.map(String).join('×') : '';
}

function money(locale: Locale, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatNumber(locale, value, { maximumFractionDigits: 2 })} ₪`;
}

/** Sibling quote-line folio — dual inset (unit | line total), not a nested table row. */
export function QuotationLineBoard({ line }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const complexity = quotationComplexity(line.manufacturingComplexity);
  const net = quotationLineNet(line.unitPrice, line.quantity);
  const photo = line.product?.imageUrl;
  const sku = line.product?.sku;
  const specs = lineSpecs(line);
  const dims = lineDims(line);

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
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <StatusBadge
          status={complexity}
          label={t(`mobile.adminQuotation.complexity.${complexity}`)}
          dot
        />
        <AppText variant="caption" color="muted" dir="ltr">
          {t('mobile.adminQuotation.qty')} {String(line.quantity)}
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
            gap: theme.spacing.md,
            alignItems: 'flex-start',
          }}
        >
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
              }}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="cube-outline" size={20} color={colors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <AppText
              variant="body"
              weight={titleWeight}
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {line.description}
            </AppText>
            {sku ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {t('mobile.adminQuotation.sku')} {sku}
              </AppText>
            ) : null}
            {specs ? (
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {specs}
              </AppText>
            ) : null}
            {dims ? (
              <AppText variant="caption" color="muted" dir="ltr">
                {dims}
              </AppText>
            ) : null}
          </View>
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <InsetCell
            label={t('mobile.adminQuotation.price')}
            value={money(locale, Number(line.unitPrice))}
            isRTL={isRTL}
            locale={locale}
          />
          <InsetCell
            label={t('mobile.adminQuotation.lineTotal')}
            value={money(locale, net)}
            isRTL={isRTL}
            locale={locale}
            emphasize
          />
        </View>
      </View>
    </View>
  );
}

function InsetCell({
  label,
  value,
  isRTL,
  locale,
  emphasize,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  locale: Locale;
  emphasize?: boolean;
}) {
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        gap: 4,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          fontSize: 10,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={titleWeight}
        dir="ltr"
        numberOfLines={1}
        style={{
          textAlign: isRTL ? 'right' : 'left',
          fontVariant: ['tabular-nums'],
          color: emphasize ? colors.textPrimary : colors.textSecondary,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
