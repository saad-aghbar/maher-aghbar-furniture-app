import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import type { UnscheduledOrderCard } from '@/api/modules/scheduling';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { UnscheduledOrderCardView } from './UnscheduledOrderCard';

type Props = {
  orders: UnscheduledOrderCard[];
  onOpen: (order: UnscheduledOrderCard) => void;
  onSchedule: (order: UnscheduledOrderCard) => void;
};

export function UnscheduledWorkspace({ orders, onOpen, onSchedule }: Props) {
  const { t } = useLocale();
  const { theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <DealerBoard title={t('mobile.adminScheduling.unscheduledTitle')}>
        <AppText color="secondary">{t('mobile.adminScheduling.unscheduledHint')}</AppText>
      </DealerBoard>
      {orders.length === 0 ? (
        <DealerEmptyPanel text={t('mobile.adminScheduling.searchEmpty')} />
      ) : (
        orders.map((order, index) => (
          <ListItemEnter key={order.id} index={index}>
            <UnscheduledOrderCardView
              order={order}
              onOpen={() => onOpen(order)}
              onSchedule={() => onSchedule(order)}
            />
          </ListItemEnter>
        ))
      )}
    </View>
  );
}
