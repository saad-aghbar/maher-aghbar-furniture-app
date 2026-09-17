import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { ReturnDetailScreen } from './ReturnDetailScreen';
import { ReturnsListScreen } from './ReturnsListScreen';

export function ReturnsDeskHost() {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();
  const compactHref = (id: string) => `/(app)/(admin)/returns/${id}` as Href;

  return (
    <SplitPane
      testID="returns-desk-split"
      split={split}
      primary={
        <ReturnsListScreen
          detailHref={compactHref}
          adminControls
          selectedReturnId={selected}
          onSelectReturn={(id) => selectOrPush(id, compactHref(id))}
        />
      }
      detail={selected ? <ReturnDetailScreen returnId={selected} embedded /> : null}
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="return-down-back-outline"
          title={t('mobile.adaptive.chooseReturnTitle')}
          body={t('mobile.adaptive.chooseReturnBody')}
        />
      }
    />
  );
}
