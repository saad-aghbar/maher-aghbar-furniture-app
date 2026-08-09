import { IndustrialFloorTaskCard } from './IndustrialFloorTaskCard';
import type { TaskCardModel } from '../selectTask';

type TaskCardProps = {
  task: TaskCardModel;
  index?: number;
  completed?: boolean;
  /** Disable enter animation after first paint (filter changes). */
  animateEnter?: boolean;
};

export function TaskCard({
  task,
  index = 0,
  completed = false,
  animateEnter = true,
}: TaskCardProps) {
  return (
    <IndustrialFloorTaskCard
      index={index}
      animateEnter={animateEnter}
      task={{
        id: task.id,
        department: task.requiredWork,
        productTitle: task.productTitle || task.title,
        orderNumber: task.orderNumber,
        imageUrl: task.imageUrl,
        priority: task.priority,
        deadline: task.deadline,
        emphasize: task.emphasize,
        completed,
      }}
    />
  );
}
