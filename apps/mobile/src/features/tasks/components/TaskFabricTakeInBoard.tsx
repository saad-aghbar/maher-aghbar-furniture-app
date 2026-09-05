import type { ReactNode } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { queryKeys } from '@/api/queryKeys';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { getFabricTaskBoard, takeInFabricLot } from '@/api/modules/purchasing';
import { getInventoryLotByCode } from '@/api/modules/inventory';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import {
  fabricTakeInErrorKey,
  verdictFabricTakeInScan,
} from '@/features/fabric/fabricTakeInScan';
import { FabricRowBody } from '@/features/fabric/FabricRowBody';
import {
  fabricRowFromTaskItem,
  formatFabricQty,
} from '@/features/fabric/selectFabricTracker';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  taskId: string;
};

type ScanPreview = {
  qr: string;
  label: string;
  qty: string;
  orderNumber: string | null;
};

export function TaskFabricTakeInBoard({ taskId }: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const { openScanner } = useCodeScanner();
  const qc = useQueryClient();
  const allowed = can(user, 'production.material-usage.record');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const boardQuery = useQuery({
    queryKey: queryKeys.purchasing.fabricTaskBoard(taskId),
    queryFn: () => getFabricTaskBoard(taskId),
    enabled: allowed && Boolean(taskId),
  });

  const takeIn = useMutation({
    mutationFn: (qrCode: string) => takeInFabricLot(taskId, qrCode),
    onSuccess: async () => {
      setPreview(null);
      setWarning(null);
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('mobile.tasks.fabricTakeInSuccess') });
      await invalidateAfterTakeIn(qc, taskId);
    },
    onError: (err) => {
      void haptics.error();
      const code = isApiError(err) ? err.code : null;
      const key = fabricTakeInErrorKey(code);
      const message = key
        ? t(key)
        : isApiError(err)
          ? toastMessageForError(err)
          : t('mobile.tasks.fabricTakeInTitle');
      setWarning(message);
      showToast({ variant: 'error', message });
    },
  });

  if (!allowed) return null;

  const items = boardQuery.data?.items ?? [];
  const railPad = isRTL
    ? { paddingRight: theme.spacing.lg + 4 }
    : { paddingLeft: theme.spacing.lg + 4 };

  if (boardQuery.isError && items.length === 0) {
    return (
      <Board>
        <Header title={t('mobile.tasks.requiredFabric')} />
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm, ...railPad }}>
          <AppText variant="caption" style={{ color: colors.error }}>
            {t('mobile.purchasing.fabricLoadFailed')}
          </AppText>
          <SecondaryButton
            label={t('mobile.purchasing.fabricRetry')}
            onPress={() => void boardQuery.refetch()}
          />
        </View>
      </Board>
    );
  }

  if (boardQuery.isLoading && items.length === 0) {
    return (
      <Board>
        <Header title={t('mobile.tasks.requiredFabric')} />
        <View style={{ padding: theme.spacing.lg, ...railPad }}>
          <AppText variant="caption" color="muted">
            {t('mobile.purchasing.fabricLoading')}
          </AppText>
        </View>
      </Board>
    );
  }

  if (!boardQuery.isLoading && items.length === 0) return null;

  const taken = boardQuery.data?.taken ?? 0;
  const total = boardQuery.data?.total ?? items.length;

  async function onScan() {
    setWarning(null);
    setScanning(true);
    try {
      const code = await openScanner();
      if (!code) return;
      let scannedLot: Awaited<ReturnType<typeof getInventoryLotByCode>> | null = null;
      try {
        scannedLot = await getInventoryLotByCode(code);
      } catch {
        scannedLot = null;
      }
      const verdict = verdictFabricTakeInScan({
        code,
        items,
        taskSalesOrderId: boardQuery.data?.salesOrderId,
        scannedLot: scannedLot
          ? {
              qrCode: scannedLot.qrCode,
              salesOrderId: scannedLot.salesOrder?.id ?? scannedLot.fabricProcurement?.salesOrderId,
              salesOrderNumber: scannedLot.salesOrder?.number ?? scannedLot.salesOrderNumber,
              scanKind: scannedLot.scanKind,
              fabricProcurementId: scannedLot.fabricProcurement?.id,
              remainingQty: scannedLot.remainingQty,
              status: scannedLot.status,
            }
          : null,
      });
      if (verdict.kind === 'match') {
        void haptics.confirmLight();
        setPreview({
          qr: code,
          label: verdict.item.label,
          qty: formatFabricQty(
            {
              arrivedQty: verdict.item.arrivedQty,
              expectedQty: verdict.item.expectedQty,
              unit: verdict.item.unit,
            },
            { requiredOnly: true },
          ),
          orderNumber: verdict.orderNumber ?? boardQuery.data?.salesOrderNumber ?? null,
        });
        return;
      }
      if (verdict.kind === 'not_arrived') {
        void haptics.error();
        setPreview(null);
        setWarning(t('mobile.tasks.fabricNotArrived'));
        return;
      }
      if (verdict.kind === 'wrong_order' || verdict.kind === 'wrong_fabric') {
        void haptics.error();
        setPreview(null);
        setWarning(t(fabricTakeInErrorKey(verdict.kind)!));
        return;
      }
      takeIn.mutate(code);
    } finally {
      setScanning(false);
    }
  }

  return (
    <Board>
      <Header title={t('mobile.tasks.requiredFabric')} />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md, ...railPad }}>
        <AppText variant="caption" color="muted">
          {t('mobile.tasks.fabricTakeInHint')}
        </AppText>
        <AppText weight={titleWeight} dir="ltr">
          {t('mobile.tasks.fabricProgress', { taken, total })}
        </AppText>
        {items.map((item) => (
            <FabricRowBody
              key={item.id}
              row={fabricRowFromTaskItem(item, {
                salesOrderId: boardQuery.data?.salesOrderId,
                salesOrderNumber: boardQuery.data?.salesOrderNumber,
              })}
              embedded
              surface="worker"
            />
        ))}

        {warning ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.errorSoft,
              padding: theme.spacing.md,
            }}
          >
            <AppText weight={titleWeight} style={{ color: colors.error }}>
              {warning}
            </AppText>
          </View>
        ) : null}

        {preview ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.successSoft,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            }}
          >
            <AppText weight={titleWeight} style={{ color: colors.success }}>
              {t('mobile.tasks.fabricCorrect')}
            </AppText>
            {preview.orderNumber ? (
              <AppText variant="caption" dir="ltr">
                {preview.orderNumber}
              </AppText>
            ) : null}
            <AppText>{preview.label}</AppText>
            <AppText variant="caption" dir="ltr">
              {preview.qty}
            </AppText>
            <PrimaryButton
              label={t('mobile.tasks.fabricTake')}
              loading={takeIn.isPending}
              onPress={() => {
                if (takeIn.isPending) return;
                takeIn.mutate(preview.qr);
              }}
            />
          </View>
        ) : (
          <PrimaryButton
            label={t('mobile.tasks.fabricScanCta')}
            loading={scanning}
            onPress={() => void onScan()}
          />
        )}
      </View>
    </Board>
  );
}

function Board({ children }: { children: ReactNode }) {
  const { isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      {children}
    </View>
  );
}

function Header({ title }: { title: string }) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        ...(isRTL ? { paddingRight: theme.spacing.lg + 4 } : { paddingLeft: theme.spacing.lg + 4 }),
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surfaceSecondary,
      }}
    >
      <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
        {title}
      </AppText>
    </View>
  );
}

async function invalidateAfterTakeIn(
  qc: ReturnType<typeof useQueryClient>,
  taskId: string,
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.purchasing.fabricTaskBoard(taskId) }),
    qc.invalidateQueries({ queryKey: queryKeys.purchasing.fabricLists() }),
    qc.invalidateQueries({ queryKey: [...queryKeys.purchasing.all, 'fabric-tracker'] }),
    qc.invalidateQueries({ queryKey: [...queryKeys.inventory.all, 'fabric-holding'] }),
    qc.invalidateQueries({ queryKey: [...queryKeys.inventory.all, 'fabric-bundle'] }),
    qc.invalidateQueries({ queryKey: queryKeys.production.all }),
    qc.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  ]);
}
