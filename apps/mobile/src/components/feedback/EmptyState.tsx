import { FloorStatus } from './FloorStatus';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <FloorStatus
      tone="empty"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
