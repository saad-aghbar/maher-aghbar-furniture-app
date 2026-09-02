import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  attentionCtaHref,
  type ProductionAttentionBlock,
} from '../productionAttention';
import { productionInsetStyle } from '../productionFloorStyle';

type Props = {
  blocks: ProductionAttentionBlock[];
  productionOrderId: string;
  salesOrderId?: string | null;
  /** When manage_task CTA should stay in-sheet instead of navigating. */
  onManageTask?: (taskId: string) => void;
};

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  params?: Record<string, string | number>,
  fallback?: string,
): string {
  const label = params ? t(key, params) : t(key);
  if (label === key) return fallback ?? '—';
  return label;
}

/**
 * Attention dossier — WHAT / WHY / WHAT NEXT with domain CTAs.
 * Never renders raw backend codes.
 */
export function ProductionAttentionBoard({
  blocks,
  productionOrderId,
  salesOrderId,
  onManageTask,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (blocks.length === 0) return null;

  return (
    <DealerBoard title={t('mobile.production.attention.title')} titleWeight={titleWeight}>
      <View style={{ gap: theme.spacing.md }}>
        {blocks.map((block, index) => {
          const what = translateOrFallback(t, block.whatKey);
          const whyBase = translateOrFallback(
            t,
            block.whyKey,
            block.whyParams,
          );
          const withStage =
            block.stageName && !whyBase.includes(block.stageName)
              ? `${whyBase} (${block.stageName})`
              : whyBase;
          const why =
            block.whyDetail && block.whyDetail !== withStage
              ? `${withStage}\n${block.whyDetail}`
              : withStage;
          const next = translateOrFallback(t, block.nextKey);

          return (
            <View
              key={`${block.code}:${block.taskId ?? index}`}
              style={{
                ...productionInsetStyle(theme, colors),
                borderColor: colors.warning,
                gap: theme.spacing.sm,
              }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                style={{
                  color: colors.warning,
                  letterSpacing: locale === 'ar' ? 0 : 0.5,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  fontSize: 11,
                }}
              >
                {t('mobile.production.attention.whatLabel')}
              </AppText>
              <AppText variant="label" weight={titleWeight}>
                {what}
              </AppText>

              <AppText
                variant="caption"
                weight={titleWeight}
                style={{
                  color: colors.textMuted,
                  letterSpacing: locale === 'ar' ? 0 : 0.5,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  fontSize: 11,
                  marginTop: theme.spacing.xs,
                }}
              >
                {t('mobile.production.attention.whyLabel')}
              </AppText>
              <AppText variant="body" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {why}
              </AppText>

              <AppText
                variant="caption"
                weight={titleWeight}
                style={{
                  color: colors.textMuted,
                  letterSpacing: locale === 'ar' ? 0 : 0.5,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  fontSize: 11,
                  marginTop: theme.spacing.xs,
                }}
              >
                {t('mobile.production.attention.nextLabel')}
              </AppText>
              <AppText variant="body" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {next}
              </AppText>

              <PrimaryButton
                label={next}
                onPress={() => {
                  void haptics.selection();
                  if (
                    block.ctaKind === 'manage_task' &&
                    block.taskId &&
                    onManageTask
                  ) {
                    onManageTask(block.taskId);
                    return;
                  }
                  const href = attentionCtaHref(block, {
                    productionOrderId,
                    salesOrderId,
                  });
                  if (href) router.push(href as Href);
                }}
                style={{ marginTop: theme.spacing.sm, borderRadius: theme.radius.xl }}
              />
            </View>
          );
        })}
      </View>
    </DealerBoard>
  );
}
