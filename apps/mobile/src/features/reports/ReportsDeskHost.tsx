import type { ReactNode } from 'react';
import type { Href } from 'expo-router';
import { SplitPane, SplitPanePlaceholder } from '@/adaptive/SplitPane';
import { useDeskSelection } from '@/adaptive/useDeskSelection';
import { useLocale } from '@/i18n';
import { ReportsMoneyScreen } from './ReportsMoneyScreen';
import { ReportsOrdersScreen } from './ReportsOrdersScreen';
import { ReportsProductsScreen } from './ReportsProductsScreen';
import { ReportsInventoryScreen } from './ReportsInventoryScreen';
import { ReportsReturnsScreen } from './ReportsReturnsScreen';
import { ReportsCoverageScreen } from './ReportsCoverageScreen';
import { CostOrderDossierScreen } from './CostOrderDossierScreen';
import { CostProductProfileScreen } from './CostProductProfileScreen';
import { CostVariantProfileScreen } from './CostVariantProfileScreen';
import { CostCustomWorkScreen } from './CostCustomWorkScreen';
import { CostInventoryItemScreen } from './CostInventoryItemScreen';
import { CostReturnDossierScreen } from './CostReturnDossierScreen';
import { CostCoverageIssuesScreen } from './CostCoverageIssuesScreen';
import {
  coverageIssuesHref,
  inventoryItemHref,
  orderDossierHref,
  productProfileHref,
  returnDossierHref,
  variantProfileHref,
} from './reportsDeskHrefs';
import { useReportsPeriod } from './reportsPeriod';

function ReportsSplit({
  testID,
  primary,
  detail,
}: {
  testID: string;
  primary: ReactNode;
  detail: ReactNode | null;
}) {
  const { t } = useLocale();
  const { split } = useDeskSelection();
  return (
    <SplitPane
      testID={testID}
      split={split}
      primary={primary}
      detail={detail}
      detailPlaceholder={
        <SplitPanePlaceholder
          icon="stats-chart-outline"
          title={t('mobile.adaptive.chooseReportTitle')}
          body={t('mobile.adaptive.chooseReportBody')}
        />
      }
    />
  );
}

export function ReportsMoneyDeskHost() {
  return (
    <ReportsSplit
      testID="reports-money-desk-split"
      primary={<ReportsMoneyScreen />}
      detail={null}
    />
  );
}

export function ReportsOrdersDeskHost() {
  const { split, selected, selectOrPush } = useDeskSelection();
  const { range, dateBasis } = useReportsPeriod();
  const period = { from: range.from, to: range.to, dateBasis };

  return (
    <ReportsSplit
      testID="reports-orders-desk-split"
      primary={
        <ReportsOrdersScreen
          selectedOrderId={selected}
          onSelectOrder={(id) =>
            selectOrPush(id, orderDossierHref(id, period))
          }
        />
      }
      detail={
        selected ? <CostOrderDossierScreen id={selected} embedded={split} /> : null
      }
    />
  );
}

export function ReportsProductsDeskHost() {
  const { split, selected, selectOrPush } = useDeskSelection();
  const { range, dateBasis } = useReportsPeriod();
  const period = { from: range.from, to: range.to, dateBasis };

  const detail = !selected
    ? null
    : selected === 'custom'
      ? <CostCustomWorkScreen embedded={split} />
      : selected.startsWith('v:')
        ? (() => {
            const [, productId, variantId] = selected.split(':');
            if (!productId || !variantId) return null;
            return (
              <CostVariantProfileScreen
                productId={productId}
                variantId={variantId}
                embedded={split}
              />
            );
          })()
        : (
          <CostProductProfileScreen productId={selected} embedded={split} />
        );

  return (
    <ReportsSplit
      testID="reports-products-desk-split"
      primary={
        <ReportsProductsScreen
          selectedKey={selected}
          onSelectProduct={(id) => selectOrPush(id, productProfileHref(id, period))}
          onSelectVariant={(productId, variantId) =>
            selectOrPush(
              `v:${productId}:${variantId}`,
              variantProfileHref(productId, variantId, period),
            )
          }
          onSelectCustom={() =>
            selectOrPush('custom', '/(app)/(admin)/reports/products/custom' as Href)
          }
        />
      }
      detail={detail}
    />
  );
}

export function ReportsInventoryDeskHost() {
  const { split, selected, selectOrPush } = useDeskSelection();
  const { range, dateBasis } = useReportsPeriod();
  const period = { from: range.from, to: range.to, dateBasis };

  return (
    <ReportsSplit
      testID="reports-inventory-desk-split"
      primary={
        <ReportsInventoryScreen
          selectedItemId={selected}
          onSelectItem={(id) => selectOrPush(id, inventoryItemHref(id, period))}
        />
      }
      detail={
        selected ? <CostInventoryItemScreen itemId={selected} embedded={split} /> : null
      }
    />
  );
}

export function ReportsReturnsDeskHost() {
  const { split, selected, selectOrPush } = useDeskSelection();
  const { range, dateBasis } = useReportsPeriod();
  const period = { from: range.from, to: range.to, dateBasis };

  return (
    <ReportsSplit
      testID="reports-returns-desk-split"
      primary={
        <ReportsReturnsScreen
          selectedReturnId={selected}
          onSelectReturn={(id) => selectOrPush(id, returnDossierHref(id, period))}
        />
      }
      detail={
        selected ? <CostReturnDossierScreen id={selected} embedded={split} /> : null
      }
    />
  );
}

export function ReportsCoverageDeskHost() {
  const { split, selected, selectOrPush } = useDeskSelection();
  const { range, dateBasis } = useReportsPeriod();
  const period = { from: range.from, to: range.to, dateBasis };

  return (
    <ReportsSplit
      testID="reports-coverage-desk-split"
      primary={
        <ReportsCoverageScreen
          selectedIssueType={selected}
          onSelectIssue={(type) => selectOrPush(type, coverageIssuesHref(type, period))}
        />
      }
      detail={
        selected ? <CostCoverageIssuesScreen issueType={selected} embedded={split} /> : null
      }
    />
  );
}
