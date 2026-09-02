import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ProductionWhereNow } from '../selectProductionJourney';
import { productionFloorStatusLabel } from '../selectProduction';
import { productionInsetStyle } from '../productionFloorStyle';

type Props = {
  where: ProductionWhereNow;
  onPressImage?: () => void;
};

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'warning' | 'brand';
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const color =
    tone === 'warning'
      ? colors.warning
      : tone === 'brand'
        ? colors.brand
        : tone === 'muted'
          ? colors.textMuted
          : colors.textPrimary;
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: 4,
      }}
    >
      <AppText variant="caption" color="muted" style={{ flexShrink: 0 }}>
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={2}
        style={{ flex: 1, textAlign: isRTL ? 'left' : 'right', color }}
      >
        {value}
      </AppText>
    </View>
  );
}

/**
 * Top-of-dossier answer: WHERE IS THIS ORDER RIGHT NOW?
 */
export function ProductionWhereNowBoard({ where, onPressImage }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pct = Math.max(0, Math.min(100, Math.round(where.progressPercent || 0)));

  const plannedVs =
    where.plannedVsActualLabel === 'ahead'
      ? t('mobile.production.dossier.plannedAhead')
      : where.plannedVsActualLabel === 'behind'
        ? t('mobile.production.dossier.plannedBehind')
        : where.plannedVsActualLabel === 'on_track'
          ? t('mobile.production.dossier.plannedOnTrack')
          : where.plannedVsActualLabel === 'not_started'
            ? t('mobile.production.dossier.plannedNotStarted')
            : '—';

  const soPo = [where.salesOrderNumber, where.productionOrderNumber]
    .filter(Boolean)
    .join(' · ');

  return (
    <DealerBoard
      title={t('mobile.production.dossier.whereNow')}
      titleWeight={titleWeight}
      trailing={
        where.attentionCount > 0 ? (
          <AppText variant="caption" weight={titleWeight} style={{ color: colors.warning }}>
            {t('mobile.production.attention.count', { count: where.attentionCount })}
          </AppText>
        ) : undefined
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'flex-start',
          }}
        >
          <AnimatedPressable
            variant="button"
            disabled={!where.imageUrl || !onPressImage}
            onPress={() => {
              if (!onPressImage) return;
              void haptics.selection();
              onPressImage();
            }}
            style={{
              width: 88,
              height: 88,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {where.imageUrl ? (
              <Image source={{ uri: where.imageUrl }} style={{ width: 88, height: 88 }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
              </View>
            )}
          </AnimatedPressable>

          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <AppText variant="label" weight={titleWeight} numberOfLines={2}>
              {where.productTitle}
            </AppText>
            {soPo ? (
              <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
                {soPo}
              </AppText>
            ) : null}
            {where.dealerName ? (
              <AppText variant="caption" color="secondary" numberOfLines={1}>
                {where.dealerName}
              </AppText>
            ) : null}
            <StatusBadge
              status={where.operationalState}
              dot
              label={productionFloorStatusLabel(
                where.operationalState,
                t('mobile.production.inProduction'),
              )}
            />
          </View>
        </View>

        <View style={productionInsetStyle(theme, colors)}>
          <Fact
            label={t('mobile.production.dossier.currentStage')}
            value={where.currentStageName ?? '—'}
            tone="brand"
          />
          <Fact
            label={t('mobile.production.dossier.activeWorker')}
            value={where.activeWorkerName ?? '—'}
          />
          <Fact
            label={t('mobile.production.dossier.actualStart')}
            value={
              where.actualStartDate
                ? new Date(where.actualStartDate).toLocaleString(locale)
                : '—'
            }
          />
          <Fact label={t('mobile.production.dossier.plannedVsActual')} value={plannedVs} />
          <Fact
            label={t('mobile.production.deliveryDate')}
            value={where.deliveryDate ?? '—'}
            tone={where.deliveryDate ? 'default' : 'muted'}
          />
          {where.completedStageNames.length > 0 ? (
            <Fact
              label={t('mobile.production.dossier.completedStages')}
              value={where.completedStageNames.join(' · ')}
            />
          ) : null}
          {where.waitingStageNames.length > 0 ? (
            <Fact
              label={t('mobile.production.dossier.waitingStages')}
              value={where.waitingStageNames.join(' · ')}
              tone="muted"
            />
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="caption" color="muted">
              {where.progressLabel?.trim() || t('mobile.production.progress')}
            </AppText>
            <AppText
              variant="caption"
              weight={titleWeight}
              dir="ltr"
              style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
            >
              {`${pct}%`}
            </AppText>
          </View>
          <WorkflowProgressHit progressPercent={pct} height={8} />
        </View>
      </View>
    </DealerBoard>
  );
}
