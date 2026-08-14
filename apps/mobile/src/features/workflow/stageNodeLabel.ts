import { localizedName } from '@maher/i18n';
import type { StageDefinition } from '@/api/modules/workflow';

export function stageNodeLabel(
  locale: string,
  stageDefinition: StageDefinition | null | undefined,
): string {
  return localizedName(locale, stageDefinition, stageDefinition?.code ?? '—');
}
