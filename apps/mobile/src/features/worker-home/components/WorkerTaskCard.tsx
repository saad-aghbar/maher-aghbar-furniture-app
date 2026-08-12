import { IndustrialFloorTaskCard } from '@/features/tasks/components/IndustrialFloorTaskCard';
import { isScheduledToday } from '@/features/tasks/isScheduledToday';
import type { PriorityLevel } from '@/components/badges/badgeStyles';
import { useLocale } from '@/i18n';
import type { WorkerHomeTask } from '../api';
import {
  localizedWorkerProductTitle,
  localizedWorkerStageName,
} from '../selectWorkerHome';

type WorkerTaskCardProps = {
  task: WorkerHomeTask;
  index?: number;
  emphasize?: boolean;
  hero?: boolean;
};

function toPriorityLevel(priority: string): PriorityLevel {
  const p = priority.toLowerCase();
  if (p === 'urgent' || p === 'high' || p === 'low' || p === 'medium') return p;
  if (p === 'normal') return 'medium';
  return 'medium';
}

export function WorkerTaskCard({
  task,
  index = 0,
  emphasize = false,
  hero = false,
}: WorkerTaskCardProps) {
  const { locale } = useLocale();
  const department = localizedWorkerStageName(task, locale);
  const productTitle = localizedWorkerProductTitle(task, locale);

  return (
    <IndustrialFloorTaskCard
      index={index}
      hero={hero}
      task={{
        id: task.id,
        department,
        productTitle,
        orderNumber: task.orderNumber,
        imageUrl: task.imageUrl,
        priority: toPriorityLevel(task.priority),
        deadline: task.deadline,
        emphasize: emphasize || toPriorityLevel(task.priority) === 'urgent',
        isScheduledToday: isScheduledToday(task.timing?.plannedStart ?? task.deadline),
      }}
    />
  );
}
