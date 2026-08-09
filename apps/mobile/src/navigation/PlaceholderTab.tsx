import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LargeTitleHeader } from '@/components/layout/LargeTitleHeader';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';

type PlaceholderTabProps = {
  title: string;
  subtitle?: string;
};

/** Themed tab shell until feature screens land. */
export function PlaceholderTab({ title, subtitle }: PlaceholderTabProps) {
  return (
    <ScrollableScreen>
      <LargeTitleHeader title={title} subtitle={subtitle} />
      <EmptyState title={title} description={subtitle} />
      <AppText variant="caption" color="muted" align="center">
        —
      </AppText>
    </ScrollableScreen>
  );
}
