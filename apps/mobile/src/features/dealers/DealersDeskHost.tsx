import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { DealerDetailScreen } from './DealerDetailScreen';
import { DealersListScreen } from './DealersListScreen';

export function DealersDeskHost() {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();

  return (
    <SplitPane
      testID="dealers-desk-split"
      split={split}
      primary={
        <DealersListScreen
          selectedDealerId={selected}
          onSelectDealer={(id) =>
            selectOrPush(id, `/(app)/(admin)/dealers/${id}` as Href)
          }
        />
      }
      detail={selected ? <DealerDetailScreen dealerId={selected} embedded /> : null}
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="people-outline"
          title={t('mobile.adaptive.chooseDealerTitle')}
          body={t('mobile.adaptive.chooseDealerBody')}
        />
      }
    />
  );
}
