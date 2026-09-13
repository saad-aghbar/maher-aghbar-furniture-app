import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { SchedulingSalesOrderGroup } from '../selectAdminScheduling';

type CardIdentity = {
  id?: string;
  productionOrderId?: string;
};

type Props<T extends CardIdentity> = {
  groups: SchedulingSalesOrderGroup<T>[];
  renderCard: (card: T, indexInGroup: number) => ReactNode;
};

function cardKey(groupKey: string, card: CardIdentity, index: number): string {
  return `${groupKey}:${card.productionOrderId ?? card.id ?? index}`;
}

/** Sales-order header band with nested line/PO tickets. */
export function SchedulingSalesOrderGroups<T extends CardIdentity>({
  groups,
  renderCard,
}: Props<T>) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.md }}>
      {groups.map((group, index) => (
        <ListItemEnter key={group.key} index={index}>
          <DealerBoard
            title={group.salesOrderNumber ?? t('mobile.adminScheduling.salesOrderGroup')}
            titleWeight={titleWeight}
          >
            <View style={{ gap: theme.spacing.sm }}>
              {group.cards.map((card, i) => (
                <Fragment key={cardKey(group.key, card, i)}>{renderCard(card, i)}</Fragment>
              ))}
            </View>
          </DealerBoard>
        </ListItemEnter>
      ))}
    </View>
  );
}
