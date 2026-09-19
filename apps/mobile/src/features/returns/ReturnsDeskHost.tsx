import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { ReturnDetailScreen } from './ReturnDetailScreen';
import { ReturnsListScreen } from './ReturnsListScreen';

type Props = {
  compactHref?: (id: string) => Href;
  backFallback?: Href;
  adminControls?: boolean;
  dealerFacing?: boolean;
  canCreate?: boolean;
  createHref?: Href;
};

export function ReturnsDeskHost({
  compactHref = (id) => `/(app)/(admin)/returns/${id}` as Href,
  backFallback,
  adminControls = true,
  dealerFacing = false,
  canCreate,
  createHref,
}: Props = {}) {
  const { t } = useLocale();
  const { split, selected, selectOrPush } = useDeskSelection();

  return (
    <SplitPane
      testID="returns-desk-split"
      split={split}
      primary={
        <ReturnsListScreen
          detailHref={compactHref}
          adminControls={adminControls}
          selectedReturnId={selected}
          onSelectReturn={(id) => selectOrPush(id, compactHref(id))}
          backFallback={backFallback}
          canCreate={canCreate}
          createHref={createHref}
        />
      }
      detail={
        selected ? (
          <ReturnDetailScreen
            returnId={selected}
            embedded
            dealerFacing={dealerFacing}
            backFallback={backFallback}
          />
        ) : null
      }
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
