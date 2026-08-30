import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import {
  formatInventoryMaterialType,
  selectInventoryItemCard,
} from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';

export type InventoryScanMatchKind =
  | 'MATCH'
  | 'MISMATCH'
  | 'UNKNOWN'
  | 'ARCHIVED'
  | 'DISALLOWED'
  | 'ERROR';

export type InventoryScanMatchCurrent = {
  id: string;
  sku: string;
  name: string;
  unit?: string;
  imageUrl?: string | null;
  materialType?: string | null;
};

type Props = {
  kind: InventoryScanMatchKind;
  current: InventoryScanMatchCurrent;
  scanned?: InventoryItem | null;
  onScanAgain: () => void;
  onKeepCurrent: () => void;
  /** Only for MISMATCH when the form may change material. */
  onUseScanned?: () => void;
};

export function classifyLabelScan(args: {
  currentId: string;
  scanned: InventoryItem | null;
  allowItem?: (item: InventoryItem) => boolean;
}): InventoryScanMatchKind {
  if (!args.scanned) return 'UNKNOWN';
  if (!args.scanned.isActive || args.scanned.archivedAt) return 'ARCHIVED';
  if (args.allowItem && !args.allowItem(args.scanned)) return 'DISALLOWED';
  if (args.scanned.id === args.currentId) return 'MATCH';
  return 'MISMATCH';
}

/**
 * Inline known-item label confirmation result.
 * Never posts stock movements. Prefer inline UI (no extra Modal) to avoid RN races.
 */
export function InventoryScanMatchResult({
  kind,
  current,
  scanned,
  onScanAgain,
  onKeepCurrent,
  onUseScanned,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const scannedCard = scanned ? selectInventoryItemCard(scanned, locale) : null;
  const scannedType = formatInventoryMaterialType(scannedCard?.materialType, t);
  const row = isRTL ? ('row-reverse' as const) : ('row' as const);

  if (kind === 'MATCH') {
    return (
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={t('mobile.inventory.a11yLabelConfirmed', {
          name: current.name,
        })}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1.5,
          borderColor: colors.success,
          backgroundColor: colors.successSoft,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            [isRTL ? 'right' : 'left']: 0,
            width: 4,
            backgroundColor: colors.success,
          }}
        />
        <View
          style={{
            flexDirection: row,
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingStart: 4,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.success,
            }}
          >
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" weight="semibold" color="success">
              {t('mobile.inventory.labelConfirmed')}
            </AppText>
            <AppText variant="body" weight="semibold">
              {current.name}
            </AppText>
            <AppText variant="caption" color="muted" dir="ltr">
              {current.sku}
              {current.unit ? ` · ${current.unit}` : ''}
            </AppText>
            <AppText variant="caption" color="success">
              {t('mobile.inventory.labelMatchesSelected')}
            </AppText>
          </View>
        </View>
      </View>
    );
  }

  const tone: 'error' | 'warning' =
    kind === 'MISMATCH' || kind === 'ERROR' || kind === 'UNKNOWN' || kind === 'ARCHIVED'
      ? 'error'
      : 'warning';
  const accent = tone === 'error' ? colors.error : colors.warning;
  const soft = tone === 'error' ? colors.errorSoft : colors.warningSoft;
  const iconName =
    kind === 'MISMATCH'
      ? ('close-circle' as const)
      : kind === 'ERROR'
        ? ('alert-circle' as const)
        : kind === 'ARCHIVED'
          ? ('archive-outline' as const)
          : ('help-circle' as const);

  const title =
    kind === 'MISMATCH'
      ? t('mobile.inventory.labelMismatchTitle')
      : kind === 'ARCHIVED'
        ? t('mobile.inventory.inactiveCannotSelect')
        : kind === 'DISALLOWED'
          ? t('mobile.inventory.cannotUseHere')
          : kind === 'ERROR'
            ? t('mobile.inventory.couldntIdentifyItem')
            : t('mobile.inventory.itemNotFound');

  const body =
    kind === 'MISMATCH'
      ? t('mobile.inventory.labelMismatchBody', {
          scanned: scannedCard?.name ?? scanned?.sku ?? '—',
          current: current.name,
        })
      : kind === 'UNKNOWN'
        ? t('mobile.inventory.labelUnknownBody')
        : kind === 'ARCHIVED'
          ? t('mobile.inventory.inactiveCannotSelect')
          : kind === 'ERROR'
            ? t('mobile.inventory.couldntIdentifyHint')
            : t('mobile.inventory.cannotUseHere');

  const a11y =
    kind === 'MISMATCH'
      ? t('mobile.inventory.a11yLabelMismatch', {
          scanned: scannedCard?.name ?? '—',
          current: current.name,
        })
      : title;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11y}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1.5,
        borderColor: accent,
        backgroundColor: soft,
        padding: theme.spacing.md,
        gap: theme.spacing.md,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [isRTL ? 'right' : 'left']: 0,
          width: 4,
          backgroundColor: accent,
        }}
      />

      <View
        style={{
          flexDirection: row,
          alignItems: 'flex-start',
          gap: theme.spacing.md,
          paddingStart: 4,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: accent,
          }}
        >
          <Ionicons name={iconName} size={26} color={accent} />
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText
            variant="body"
            weight="semibold"
            color={tone === 'error' ? 'error' : 'warning'}
          >
            {title}
          </AppText>
          <AppText variant="caption" color="secondary">
            {body}
          </AppText>
        </View>
      </View>

      {scannedCard && kind !== 'UNKNOWN' ? (
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: accent,
            backgroundColor: colors.surface,
            padding: theme.spacing.sm,
            gap: theme.spacing.sm,
            marginStart: 4,
          }}
        >
          <View style={{ flexDirection: row, alignItems: 'center', gap: theme.spacing.sm }}>
            <AppText
              variant="caption"
              weight="semibold"
              color={tone === 'error' ? 'error' : 'warning'}
              style={{ flex: 1 }}
            >
              {t('mobile.inventory.scannedMaterial')}
            </AppText>
            {kind === 'MISMATCH' ? (
              <View
                style={{
                  flexDirection: row,
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: 3,
                  borderRadius: theme.radius.sm,
                  backgroundColor: soft,
                  borderWidth: 1,
                  borderColor: accent,
                }}
              >
                <Ionicons name="close" size={12} color={accent} />
                <AppText variant="caption" weight="semibold" color="error">
                  ≠
                </AppText>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: row, gap: theme.spacing.md, alignItems: 'center' }}>
            <InventorySkuThumb uri={scannedCard.imageUrl} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="body" weight="semibold">
                {scannedCard.name}
              </AppText>
              <AppText variant="caption" color="muted" dir="ltr">
                {[scannedCard.sku, scannedType, scannedCard.unit].filter(Boolean).join(' · ')}
              </AppText>
            </View>
          </View>
        </View>
      ) : null}

      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          padding: theme.spacing.sm,
          gap: 2,
          marginStart: 4,
        }}
      >
        <AppText variant="caption" color="muted">
          {t('mobile.inventory.currentMaterial')}
        </AppText>
        <AppText variant="body" weight="medium">
          {current.name}
        </AppText>
        <AppText variant="caption" color="muted" dir="ltr">
          {current.sku}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.sm, marginStart: 4 }}>
        <ActionPill
          label={
            kind === 'ERROR'
              ? t('mobile.inventory.tryAgain')
              : t('mobile.inventory.scanAgain')
          }
          tone="brand"
          onPress={onScanAgain}
        />
        <ActionPill
          label={
            kind === 'ERROR' || kind === 'UNKNOWN'
              ? t('mobile.inventory.cancel')
              : t('mobile.inventory.keepSelectedMaterial')
          }
          tone="neutral"
          onPress={onKeepCurrent}
        />
        {kind === 'MISMATCH' && onUseScanned && scannedCard ? (
          <ActionPill
            label={t('mobile.inventory.useScannedMaterial')}
            accessibilityLabel={t('mobile.inventory.a11yUseScanned', {
              name: scannedCard.name,
            })}
            tone="danger"
            onPress={() => {
              void haptics.selection();
              onUseScanned();
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function ActionPill({
  label,
  onPress,
  tone,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone: 'brand' | 'neutral' | 'danger';
  accessibilityLabel?: string;
}) {
  const { colors, theme } = useTheme();
  const filled = tone === 'brand';
  const danger = tone === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 44,
        borderRadius: theme.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: filled
          ? colors.brand
          : danger
            ? colors.errorSoft
            : colors.surface,
        borderWidth: filled ? 0 : 1,
        borderColor: danger ? colors.error : colors.borderStrong,
      }}
    >
      <AppText
        variant="label"
        weight="semibold"
        style={
          filled
            ? { color: colors.onBrand }
            : danger
              ? { color: colors.error }
              : undefined
        }
        color={filled || danger ? undefined : 'brand'}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
