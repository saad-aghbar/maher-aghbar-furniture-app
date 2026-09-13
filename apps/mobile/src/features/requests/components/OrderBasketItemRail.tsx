import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { lineVisualIdentity } from '@maher/types';
import { AppText } from '@/components/AppText';
import { EmptyProductImage } from '@/components/media/EmptyProductImage';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { basketLineKind } from '../newOrderBasket';
import type { NewOrderLine } from '../newOrderLine';

type Props = {
  lines: NewOrderLine[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpenBasket?: () => void;
  onRemove?: (id: string) => void;
};

type IndexedLine = { line: NewOrderLine; index: number };

function pairRows(items: IndexedLine[]): IndexedLine[][] {
  const rows: IndexedLine[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function lineTitle(line: NewOrderLine, untitled: string): string {
  return (
    line.customProductName.trim() ||
    line.variantLabel.trim() ||
    untitled
  );
}

function lineThumbUri(line: NewOrderLine): string | null {
  return lineVisualIdentity({
    productImageRef: line.imageUrl || line.photoUris[0],
    photoUrls: line.photoUris,
  });
}

/**
 * New Order packing slip — selected piece as a hero ticket, the rest as a two-column picker.
 * Active = brandSoft + 3px bottom bar. Custom = warning stamp, no dealer price.
 */
export function OrderBasketItemRail({
  lines,
  activeId,
  onSelect,
  onOpenBasket,
  onRemove,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (!lines.length) return null;

  const indexed = lines.map((line, index) => ({ line, index }));
  const activeIndex = Math.max(
    0,
    indexed.findIndex((row) => row.line.id === activeId),
  );
  const active = indexed[activeIndex] ?? indexed[0]!;
  const rest = indexed.filter((row) => row.line.id !== active.line.id);

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
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
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
          <Ionicons name="bag-handle-outline" size={14} color={colors.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{
              color: colors.brand,
              fontSize: 11,
              letterSpacing: locale === 'ar' ? 0 : 0.5,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.newOrder.basket')}
          </AppText>
          <AppText variant="caption" color="muted" dir="ltr">
            {t('mobile.newOrder.basketPieceCount', { n: lines.length })}
          </AppText>
        </View>
        {onOpenBasket ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.newOrder.openBasketDesk')}
            testID="order-item-rail-open-basket"
            onPress={() => {
              void haptics.selection();
              onOpenBasket();
            }}
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: theme.radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.brand,
            }}
          >
            <Ionicons name="create-outline" size={16} color={colors.brand} />
          </AnimatedPressable>
        ) : null}
      </View>

      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <HeroTicket
          row={active}
          titleWeight={titleWeight}
          onRemove={onRemove}
        />

        {pairRows(rest).map((row) => (
          <View
            key={row.map((item) => item.line.id).join('-')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {row.map((item) => (
              <PickerTicket
                key={item.line.id}
                row={item}
                titleWeight={titleWeight}
                onPress={() => {
                  void haptics.selection();
                  onSelect(item.line.id);
                }}
              />
            ))}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function HeroTicket({
  row,
  titleWeight,
  onRemove,
}: {
  row: IndexedLine;
  titleWeight: 'medium' | 'semibold';
  onRemove?: (id: string) => void;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { line, index } = row;
  const kind = basketLineKind(line);
  const custom = kind === 'custom';
  const title = lineTitle(line, t('mobile.newOrder.untitledModel'));
  const uri = lineThumbUri(line);
  const variant = line.variantLabel.trim();

  return (
    <View
      accessibilityState={{ selected: true }}
      accessibilityLabel={`${title}, ${t('mobile.newOrder.basketEditingPiece')}`}
      testID={`order-item-rail-${line.id}`}
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: custom ? colors.warning : colors.brand,
        backgroundColor: custom ? colors.warningSoft : colors.brandSoft,
        padding: theme.spacing.md,
        overflow: 'hidden',
        gap: theme.spacing.sm,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          backgroundColor: custom ? colors.warning : colors.brand,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        <Thumb uri={uri} size={56} index={index + 1} custom={custom} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <AppText
            variant="caption"
            weight="medium"
            color={custom ? 'warning' : 'brand'}
            style={{
              fontSize: 11,
              letterSpacing: locale === 'ar' ? 0 : 0.45,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
            }}
          >
            {t('mobile.newOrder.basketEditingPiece')}
          </AppText>
          <AppText weight={titleWeight} numberOfLines={2}>
            {title}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.xs,
            }}
          >
            <KindStamp kind={kind} />
            <QtyChip qty={line.quantity} />
          </View>
          {variant && variant !== title ? (
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {variant}
            </AppText>
          ) : null}
          {custom ? (
            <AppText variant="caption" weight="medium" color="warning">
              {t('mobile.newOrder.waitingForFactoryPrice')}
            </AppText>
          ) : null}
        </View>
        {onRemove ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            testID={`order-item-rail-remove-${line.id}`}
            onPress={() => {
              void haptics.selection();
              onRemove(line.id);
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
    </View>
  );
}

function PickerTicket({
  row,
  titleWeight,
  onPress,
}: {
  row: IndexedLine;
  titleWeight: 'medium' | 'semibold';
  onPress: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { line, index } = row;
  const kind = basketLineKind(line);
  const custom = kind === 'custom';
  const title = lineTitle(line, t('mobile.newOrder.untitledModel'));
  const uri = lineThumbUri(line);

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
      accessibilityLabel={title}
      testID={`order-item-rail-${line.id}`}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.sm,
        overflow: 'hidden',
        gap: theme.spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Thumb uri={uri} size={40} index={index + 1} custom={custom} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText weight={titleWeight} numberOfLines={2}>
            {title}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AppText
              variant="caption"
              color={custom ? 'warning' : 'muted'}
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {t(`mobile.lineKind.${kind}`)}
            </AppText>
            <QtyChip qty={line.quantity} compact />
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function Thumb({
  uri,
  size,
  index,
  custom,
}: {
  uri: string | null;
  size: number;
  index: number;
  custom: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  const stamp = Math.round(size * 0.5);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <EmptyProductImage />
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 4,
          ...(isRTL ? { left: 4 } : { right: 4 }),
          minWidth: stamp,
          height: stamp,
          paddingHorizontal: 4,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: custom ? colors.warningSoft : colors.brandSoft,
          borderWidth: 1,
          borderColor: custom ? colors.warning : colors.brand,
        }}
      >
        <AppText variant="caption" weight="medium" dir="ltr" color={custom ? 'warning' : 'brand'}>
          {index}
        </AppText>
      </View>
    </View>
  );
}

function KindStamp({ kind }: { kind: 'standard' | 'customized' | 'custom' }) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const custom = kind === 'custom';

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: custom ? colors.warning : colors.brand,
        backgroundColor: colors.surface,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
      }}
    >
      <AppText variant="caption" weight="medium" color={custom ? 'warning' : 'brand'}>
        {t(`mobile.lineKind.${kind}`)}
      </AppText>
    </View>
  );
}

function QtyChip({ qty, compact }: { qty: string; compact?: boolean }) {
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: compact ? theme.spacing.xs : theme.spacing.sm,
        paddingVertical: 2,
      }}
    >
      <AppText variant="caption" dir="ltr">
        ×{qty}
      </AppText>
    </View>
  );
}
