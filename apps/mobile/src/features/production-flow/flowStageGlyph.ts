import type { ProductionFlowStage } from './selectProductionFlow';

function normalizeStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === 'DONE') return 'COMPLETED';
  return s;
}

type GlyphOpts = {
  preview?: boolean;
  index?: number;
  /** Product-times editor may show a real estimate. Order flow must not paint stub minutes. */
  showEstimatedDuration?: boolean;
};

/**
 * Inner circle label. Completed stages use a check instead.
 * Order-flow maps leave pending nodes empty until progress or a time-approval bang exists —
 * do not fill with leftover estimatedMinutes stubs (e.g. identical "5m").
 */
export function selectFlowStageGlyph(
  stage: Pick<
    ProductionFlowStage,
    'status' | 'progressPercent' | 'estimateReviewRequired' | 'estimatedMinutes'
  >,
  opts: GlyphOpts = {},
): string | null {
  if (opts.preview) return String((opts.index ?? 0) + 1);

  const status = normalizeStatus(String(stage.status ?? ''));
  if (status === 'COMPLETED' || status === 'SKIPPED') return null;
  if (stage.estimateReviewRequired) return '!';

  const inProgress = status === 'IN_PROGRESS' || status === 'ACTIVE';
  const pct = Math.round(Number(stage.progressPercent ?? 0));
  if (inProgress || pct > 0) return `${pct}%`;

  if (
    opts.showEstimatedDuration &&
    stage.estimatedMinutes != null &&
    stage.estimatedMinutes > 0
  ) {
    return stage.estimatedMinutes >= 60
      ? `${Math.round(stage.estimatedMinutes / 60)}h`
      : `${stage.estimatedMinutes}m`;
  }

  return null;
}
