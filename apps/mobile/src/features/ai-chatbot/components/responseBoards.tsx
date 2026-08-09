import type { ReactNode } from 'react';
import { I18nManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type {
  ChatAction,
  ChatBarPoint,
  ChatContent,
  ChatEntityCard,
  ChatListItem,
  ChatMetric,
  ChatTableColumn,
  ChatTableRow,
} from '../types';

function BoardShell({
  title,
  children,
  accent,
  meta,
  tight,
}: {
  title?: string;
  children: ReactNode;
  accent?: 'brand' | 'warning' | 'error';
  /** Optional trailing meta in the header (e.g. unit). */
  meta?: string;
  /** Denser body padding for compact boards like charts. */
  tight?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const strip =
    accent === 'warning'
      ? colors.warning
      : accent === 'error'
        ? colors.error
        : colors.brand;
  const bodyPad = tight ? theme.spacing.sm + 2 : theme.spacing.md;

  return (
    <View
      style={{
        width: '100%',
        borderRadius: theme.radius.lg,
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
          top: 6,
          bottom: 6,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 2.5,
          borderRadius: 2,
          backgroundColor: strip,
          opacity: 0.55,
        }}
      />
      {title ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 6,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 2 }
              : { paddingLeft: theme.spacing.md + 2 }),
            backgroundColor: colors.surfaceSecondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{
              flex: 1,
              color: colors.brand,
              letterSpacing: isRTL ? 0 : 0.5,
              textTransform: isRTL ? 'none' : 'uppercase',
              fontSize: 10,
              lineHeight: 13,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </AppText>
          {meta ? (
            <AppText
              variant="caption"
              color="muted"
              style={{ fontSize: 10, lineHeight: 13 }}
              dir="ltr"
            >
              {meta}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          padding: bodyPad,
          gap: tight ? theme.spacing.xs : theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: bodyPad + 2 }
            : { paddingLeft: bodyPad + 2 }),
        }}
      >
        {children}
      </View>
    </View>
  );
}

function MetricRow({ items }: { items: ChatMetric[] }) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  // 3+ tiles in a chat column are too narrow for "2,840 JOD" — stack as rows.
  const stacked = items.length >= 3;

  if (stacked) {
    return (
      <View style={{ gap: theme.spacing.xs }}>
        {items.map((m) => {
          const toneColor =
            m.tone === 'warning'
              ? colors.warning
              : m.tone === 'success'
                ? colors.success
                : m.tone === 'brand'
                  ? colors.brand
                  : colors.textPrimary;
          return (
            <View
              key={m.label}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                paddingHorizontal: theme.spacing.sm + 2,
                paddingVertical: theme.spacing.sm,
              }}
            >
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <AppText
                  variant="caption"
                  color="muted"
                  numberOfLines={1}
                  style={{ fontSize: 10, textAlign: isRTL ? 'right' : 'left' }}
                >
                  {m.label}
                </AppText>
                {m.hint ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    numberOfLines={1}
                    style={{ fontSize: 10, textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {m.hint}
                  </AppText>
                ) : null}
              </View>
              <AppText
                weight="semibold"
                dir="ltr"
                style={{
                  fontSize: 16,
                  lineHeight: 20,
                  color: toneColor,
                  flexShrink: 0,
                }}
              >
                {m.value}
              </AppText>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
      }}
    >
      {items.map((m) => {
        const toneColor =
          m.tone === 'warning'
            ? colors.warning
            : m.tone === 'success'
              ? colors.success
              : m.tone === 'brand'
                ? colors.brand
                : colors.textPrimary;
        return (
          <View
            key={m.label}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.sm,
              gap: 2,
            }}
          >
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{ fontSize: 10, textAlign: isRTL ? 'right' : 'left' }}
            >
              {m.label}
            </AppText>
            <AppText
              weight="semibold"
              dir="ltr"
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={2}
              style={{
                fontSize: 16,
                lineHeight: 20,
                color: toneColor,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {m.value}
            </AppText>
            {m.hint ? (
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                style={{ fontSize: 10, textAlign: isRTL ? 'right' : 'left' }}
              >
                {m.hint}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function TableBoard({
  columns,
  rows,
  caption,
}: {
  columns: ChatTableColumn[];
  rows: ChatTableRow[];
  caption?: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            backgroundColor: colors.surfaceSecondary,
            paddingVertical: theme.spacing.xs + 2,
            paddingHorizontal: theme.spacing.sm,
            gap: theme.spacing.sm,
          }}
        >
          {columns.map((c) => (
            <AppText
              key={c.key}
              variant="caption"
              color="muted"
              weight="medium"
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 10,
                textAlign:
                  c.align === 'end'
                    ? isRTL
                      ? 'left'
                      : 'right'
                    : isRTL
                      ? 'right'
                      : 'left',
              }}
            >
              {c.label}
            </AppText>
          ))}
        </View>
        {rows.map((row, i) => (
          <View
            key={i}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.sm,
              gap: theme.spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: i % 2 ? colors.surfaceSecondary : colors.surface,
            }}
          >
            {columns.map((c) => (
              <AppText
                key={c.key}
                variant="caption"
                numberOfLines={2}
                style={{
                  flex: 1,
                  fontSize: 12,
                  textAlign:
                    c.align === 'end'
                      ? isRTL
                        ? 'left'
                        : 'right'
                      : isRTL
                        ? 'right'
                        : 'left',
                }}
              >
                {row[c.key] ?? '—'}
              </AppText>
            ))}
          </View>
        ))}
      </View>
      {caption ? (
        <AppText
          variant="caption"
          color="muted"
          style={{ fontSize: 10, textAlign: isRTL ? 'right' : 'left' }}
        >
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

const ENTITY_ICON: Record<ChatEntityCard['kind'], keyof typeof Ionicons.glyphMap> = {
  order: 'cube-outline',
  dealer: 'storefront-outline',
  invoice: 'receipt-outline',
  product: 'diamond-outline',
  task: 'construct-outline',
};

function EntityCards({
  items,
  onAction,
}: {
  items: ChatEntityCard[];
  onAction?: (action: ChatAction) => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {items.map((item, i) => {
        const inner = (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.sm + 2,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name={ENTITY_ICON[item.kind]} size={16} color={colors.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText
                  weight={titleWeight}
                  numberOfLines={1}
                  style={{ flex: 1, fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}
                >
                  {item.title}
                </AppText>
                {item.status ? <StatusBadge status={item.status} /> : null}
              </View>
              {item.subtitle ? (
                <AppText
                  variant="caption"
                  color="secondary"
                  numberOfLines={1}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {item.subtitle}
                </AppText>
              ) : null}
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                {item.meta ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    numberOfLines={1}
                    style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {item.meta}
                  </AppText>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {item.amount ? (
                  <AppText
                    variant="caption"
                    weight="medium"
                    dir="ltr"
                    style={{ color: colors.brand }}
                  >
                    {item.amount}
                  </AppText>
                ) : null}
              </View>
            </View>
          </View>
        );

        if (item.href && onAction) {
          return (
            <AnimatedPressable
              key={`${item.title}-${i}`}
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => {
                void haptics.selection();
                onAction({ id: `entity-${item.title}`, label: item.title, href: item.href });
              }}
            >
              {inner}
            </AnimatedPressable>
          );
        }

        return <View key={`${item.title}-${i}`}>{inner}</View>;
      })}
    </View>
  );
}

function ListBoard({ items }: { items: ChatListItem[] }) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {items.map((item, i) => {
        const tone =
          item.tone === 'warning'
            ? colors.warning
            : item.tone === 'success'
              ? colors.success
              : colors.textSecondary;
        return (
          <View
            key={`${item.title}-${i}`}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.sm,
              borderBottomWidth: i === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: tone,
              }}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <AppText
                variant="caption"
                weight="medium"
                numberOfLines={1}
                style={{ fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}
              >
                {item.title}
              </AppText>
              {item.subtitle ? (
                <AppText
                  variant="caption"
                  color="muted"
                  numberOfLines={1}
                  style={{ fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}
                >
                  {item.subtitle}
                </AppText>
              ) : null}
            </View>
            {item.trailing ? (
              <AppText variant="caption" weight="medium" style={{ color: tone, fontSize: 11 }}>
                {item.trailing}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function ChartBoard({
  points,
  caption,
}: {
  points: ChatBarPoint[];
  caption?: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const max = Math.max(1, ...points.map((p) => p.value));
  const valueH = 14;
  const trackH = 56;
  const plotH = trackH + valueH;
  const labelRowH = 14;

  return (
    <View style={{ gap: theme.spacing.sm, width: '100%' }}>
      <View
        style={{
          // Keep bar order stable; avoid RTL flex flips that collapse columns.
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.xs,
          width: '100%',
        }}
      >
        {points.map((p) => {
          const h = Math.max(6, Math.round((p.value / max) * trackH));
          return (
            <View key={p.label} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
              <View
                style={{
                  width: '100%',
                  height: plotH,
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <AppText
                    variant="caption"
                    weight="medium"
                    dir="ltr"
                    numberOfLines={1}
                    style={{ fontSize: 10, lineHeight: 12, color: colors.textPrimary }}
                  >
                    {p.display ?? String(p.value)}
                  </AppText>
                  <View
                    style={{
                      width: 22,
                      height: h,
                      borderTopLeftRadius: theme.radius.sm,
                      borderTopRightRadius: theme.radius.sm,
                      backgroundColor: colors.brand,
                      opacity: 0.78,
                    }}
                  />
                </View>
              </View>
              <View
                style={{
                  height: labelRowH,
                  marginTop: 4,
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <AppText
                  variant="caption"
                  color="muted"
                  dir="ltr"
                  style={{ fontSize: 10, lineHeight: 12 }}
                  numberOfLines={1}
                >
                  {p.label}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
      {caption ? (
        <AppText
          variant="caption"
          color="muted"
          style={{ fontSize: 10, lineHeight: 13, textAlign: isRTL ? 'right' : 'left' }}
        >
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

export function SuggestionChips({
  actions,
  onPress,
}: {
  actions: ChatAction[];
  onPress: (action: ChatAction) => void;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  // Pack chips to the physical left (I18nManager flips flex-start in RTL).
  const packLeft = I18nManager.isRTL ? 'flex-end' : 'flex-start';

  return (
    <View
      style={{
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: packLeft,
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
      }}
    >
      {actions.map((a) => (
        <AnimatedPressable
          key={a.id}
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={() => {
            void haptics.selection();
            onPress(a);
          }}
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {a.label}
          </AppText>
        </AnimatedPressable>
      ))}
    </View>
  );
}

/** Render one assistant content block. */
export function AssistantContentBlock({
  block,
  onAction,
}: {
  block: ChatContent;
  onAction?: (action: ChatAction) => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  switch (block.type) {
    case 'text':
      return (
        <AppText
          variant="body"
          style={{
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
            lineHeight: 22,
            fontSize: 15,
          }}
        >
          {block.markdown.replace(/\*\*(.*?)\*\*/g, '$1')}
        </AppText>
      );
    case 'thinking':
      return (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="sparkles-outline" size={14} color={colors.brand} />
          </View>
          <AppText variant="caption" color="muted">
            {t('mobile.aiChat.thinking')}
          </AppText>
        </View>
      );
    case 'metrics':
      return (
        <BoardShell title={block.title ?? t('mobile.aiChat.boards.metrics')}>
          <MetricRow items={block.items} />
        </BoardShell>
      );
    case 'table':
      return (
        <BoardShell title={block.title ?? t('mobile.aiChat.boards.table')}>
          <TableBoard columns={block.columns} rows={block.rows} caption={block.caption} />
        </BoardShell>
      );
    case 'entities':
      return (
        <BoardShell title={block.title ?? t('mobile.aiChat.boards.entities')}>
          <EntityCards items={block.items} onAction={onAction} />
        </BoardShell>
      );
    case 'list':
      return (
        <BoardShell title={block.title ?? t('mobile.aiChat.boards.list')}>
          <ListBoard items={block.items} />
        </BoardShell>
      );
    case 'chart':
      return (
        <BoardShell
          title={block.title ?? t('mobile.aiChat.boards.chart')}
          meta={block.unit}
          tight
        >
          <ChartBoard points={block.points} caption={block.caption} />
        </BoardShell>
      );
    case 'clarification':
      return (
        <BoardShell title={t('mobile.aiChat.boards.clarify')} accent="brand">
          <AppText
            variant="body"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 15 }}
          >
            {block.question}
          </AppText>
          {block.options?.length && onAction ? (
            <SuggestionChips actions={block.options} onPress={onAction} />
          ) : null}
        </BoardShell>
      );
    case 'error':
      return (
        <BoardShell title={block.title} accent="error">
          <AppText
            variant="caption"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
          >
            {block.body}
          </AppText>
        </BoardShell>
      );
    case 'sources':
      return (
        <View style={{ gap: 4 }}>
          {block.lines.map((line) => (
            <AppText
              key={line}
              variant="caption"
              color="muted"
              style={{ fontSize: 10, textAlign: isRTL ? 'right' : 'left' }}
            >
              {line}
            </AppText>
          ))}
        </View>
      );
    default:
      return null;
  }
}
