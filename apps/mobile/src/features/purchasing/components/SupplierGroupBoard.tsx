import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { Divider } from '@/components/layout/Divider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { builderLineTotal, destinationLabel, type BuilderLine } from '../orderBuilder';
import { PurchasingFloorBoard } from './PurchasingFloorBoard';

type Props = {
  supplierName: string;
  lines: BuilderLine[];
  subtotal: number;
  onLinePress?: (line: BuilderLine) => void;
};

export function SupplierGroupBoard({ supplierName, lines, subtotal, onLinePress }: Props) {
  const { t, isRTL, locale, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <PurchasingFloorBoard
      title={supplierName || t('catalog.supplier')}
      trailing={
        <View
          style={{
            minWidth: 28,
            minHeight: 24,
            paddingHorizontal: theme.spacing.sm,
            borderRadius: theme.radius.full,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="caption" dir="ltr" style={{ color: colors.textSecondary }}>
            {String(lines.length)}
          </AppText>
        </View>
      }
      contentStyle={{ gap: theme.spacing.sm }}
    >
      {lines.map((line) => {
        const dest = destinationLabel(line);
        const amount = builderLineTotal(line);
        const body = (
          <>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                paddingTop: theme.spacing.md,
                paddingBottom: theme.spacing.sm,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <AppText
                  weight={titleWeight}
                  numberOfLines={2}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {line.description}
                </AppText>
                <AppText variant="caption" color="muted" dir="ltr">
                  {line.sku}
                </AppText>
              </View>
              <View
                style={{
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: theme.spacing.sm,
                  minHeight: 24,
                  justifyContent: 'center',
                }}
              >
                <AppText variant="caption" dir="ltr">
                  {`${line.quantity} ${line.unit}`}
                </AppText>
              </View>
              {onLinePress ? (
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color={colors.textMuted}
                />
              ) : null}
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            {dest ? (
              <>
                <MetaRow label={t('mobile.purchasing.destination')} value={dest} isRTL={isRTL} />
                <Divider compact plain />
              </>
            ) : null}
            <MetaRow
              label={t('mobile.purchasing.lineTotal')}
              value={formatCurrency(amount)}
              isRTL={isRTL}
              valueLtr
            />
          </>
        );

        const inset = {
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden' as const,
        };

        return onLinePress ? (
          <AnimatedPressable
            key={line.inventoryItemId}
            variant="card"
            accessibilityRole="button"
            accessibilityLabel={line.description}
            onPress={() => {
              void haptics.selection();
              onLinePress(line);
            }}
            style={inset}
          >
            {body}
          </AnimatedPressable>
        ) : (
          <View key={line.inventoryItemId} style={inset}>
            {body}
          </View>
        );
      })}

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
          label={t('mobile.purchasing.supplierSubtotal')}
          value={formatCurrency(subtotal)}
          isRTL={isRTL}
          valueLtr
          emphasize
        />
      </View>
    </PurchasingFloorBoard>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
  valueLtr,
  emphasize,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  valueLtr?: boolean;
  emphasize?: boolean;
}) {
  const { locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          flexShrink: 0,
          fontSize: 10,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          letterSpacing: locale === 'ar' ? 0 : 0.45,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        weight={emphasize ? titleWeight : 'medium'}
        dir={valueLtr ? 'ltr' : undefined}
        numberOfLines={2}
        style={{
          flex: 1,
          minWidth: 0,
          color: colors.textPrimary,
          fontSize: emphasize ? 15 : 13,
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
