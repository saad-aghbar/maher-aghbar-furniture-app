import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { manufacturingComplexityDisplayKey } from '@maher/types';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { listSpecOptionGroups, listSpecOptionValues } from '@/api/modules/catalog';
import { getQuotation, updateQuotation } from '@/api/modules/quotations';
import { getRequest, verifyRequestSpec } from '@/api/modules/requests';
import { resolveDocumentUrl, uploadFile } from '@/api/modules/uploads';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { CatalogSectionBoard } from '@/features/catalog/components/CatalogSectionBoard';
import { DealerCustomPhotosBoard } from '@/features/catalog/components/DealerCustomPhotosBoard';
import { DealerMeasurementsBoard } from '@/features/catalog/components/DealerMeasurementsBoard';
import { DealerOrderSpecsBoard } from '@/features/catalog/components/DealerOrderSpecsBoard';
import { EmptyProductImage } from '@/components/media/EmptyProductImage';
import { ProductDetailSkeleton } from '@/features/catalog/components/ProductDetailSkeleton';
import { FabricSelectionsEditor } from '@/features/requests/FabricSelectionsEditor';
import { NewOrderQtyStepper } from '@/features/requests/components/NewOrderQtyStepper';
import {
  quotationDraftSaveLines,
  quotationLinePatchFromLine,
  quotationLineToOrderLine,
  requestItemToOrderLine,
  verifyFieldsFromLine,
} from '@/features/requests/factoryLineDesk';
import { emptyOrderLine, type NewOrderLine } from '@/features/requests/newOrderLine';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

type RfqProps = { mode: 'rfq'; requestId: string; itemId: string; quotationId?: never; lineId?: never };
type QuoteProps = { mode: 'quote'; quotationId: string; lineId: string; requestId?: never; itemId?: never };
type Props = RfqProps | QuoteProps;

function isLocalUri(uri: string): boolean {
  return /^(file|content|ph|assets-library):/i.test(uri) || uri.startsWith('/');
}

async function uploadLinePhotos(line: NewOrderLine, requestId?: string): Promise<NewOrderLine> {
  if (!line.photoUris.length) {
    return { ...line, photoDocumentIds: [], primaryImageDocumentId: '' };
  }
  const ids = line.photoDocumentIds.slice(0, line.photoUris.length);
  for (let i = ids.length; i < line.photoUris.length; i += 1) {
    const uri = line.photoUris[i]!;
    if (!isLocalUri(uri) && !uri.startsWith('file')) continue;
    const uploaded = await uploadFile({
      uri,
      fileName: `line-photo-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      category: 'CUSTOMER_ATTACHMENT',
      requestId,
    });
    ids.push(uploaded.document.id);
  }
  return {
    ...line,
    photoDocumentIds: ids.slice(0, line.photoUris.length),
    primaryImageDocumentId: line.primaryImageDocumentId || ids[0] || '',
  };
}

export function FactoryLineDeskScreen(props: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canUpdate =
    props.mode === 'rfq' ? can(user, 'request.update') : can(user, 'quotation.update');
  const backFallback = (
    props.mode === 'rfq'
      ? `/(app)/(admin)/requests/${props.requestId}`
      : `/(app)/(admin)/quotations/${props.quotationId}`
  ) as Href;

  const requestQuery = useQuery({
    queryKey: queryKeys.requests.detail(props.mode === 'rfq' ? props.requestId : ''),
    queryFn: () => getRequest(props.mode === 'rfq' ? props.requestId : ''),
    enabled: props.mode === 'rfq' && Boolean(props.requestId),
  });
  const quotationQuery = useQuery({
    queryKey: queryKeys.quotations.detail(props.mode === 'quote' ? props.quotationId : ''),
    queryFn: () => getQuotation(props.mode === 'quote' ? props.quotationId : ''),
    enabled: props.mode === 'quote' && Boolean(props.quotationId),
  });

  const specGroupsQuery = useQuery({
    queryKey: queryKeys.catalog.specOptionGroups({ pageSize: 100 }),
    queryFn: () => listSpecOptionGroups({ page: 1, pageSize: 100 }),
    enabled: can(user, 'catalog.read'),
    staleTime: 60_000,
  });
  const specValuesQuery = useQuery({
    queryKey: queryKeys.catalog.specOptionValues({ pageSize: 200 }),
    queryFn: () => listSpecOptionValues({ page: 1, pageSize: 200 }),
    enabled: can(user, 'catalog.read'),
    staleTime: 60_000,
  });

  const rfqItem = useMemo(() => {
    if (props.mode !== 'rfq') return null;
    return (requestQuery.data?.items ?? []).find((row) => row.id === props.itemId) ?? null;
  }, [props, requestQuery.data]);
  const quoteLine = useMemo(() => {
    if (props.mode !== 'quote') return null;
    return (quotationQuery.data?.lines ?? []).find((row) => row.id === props.lineId) ?? null;
  }, [props, quotationQuery.data]);

  const [line, setLine] = useState<NewOrderLine>(() => emptyOrderLine());
  const seededKey = useRef('');
  const seatLabel = t('mobile.newOrder.dimSeat');

  useEffect(() => {
    const source =
      props.mode === 'rfq'
        ? rfqItem
          ? requestItemToOrderLine(rfqItem, seatLabel)
          : null
        : quoteLine
          ? quotationLineToOrderLine(quoteLine, seatLabel)
          : null;
    if (!source) return;
    const key = `${props.mode}:${source.id}`;
    if (seededKey.current === key) return;
    seededKey.current = key;
    let cancelled = false;
    void (async () => {
      const ids = source.photoDocumentIds;
      const uris: string[] = [];
      for (const id of ids) {
        try {
          uris.push(await resolveDocumentUrl(id));
        } catch {
          uris.push('');
        }
      }
      if (cancelled) return;
      setLine({
        ...source,
        photoUris: uris.filter(Boolean).length ? uris : source.photoUris,
        imageUrl: uris.find(Boolean) ?? source.imageUrl,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [props.mode, quoteLine, rfqItem, seatLabel]);

  const complexity = manufacturingComplexityDisplayKey(
    props.mode === 'rfq'
      ? rfqItem?.manufacturingComplexity
      : quoteLine?.manufacturingComplexity,
  );
  const quoteDraft = props.mode === 'quote' && quotationQuery.data?.status === 'DRAFT';
  const editable = canUpdate && (props.mode === 'rfq' || quoteDraft);

  const onChangeLine = (next: NewOrderLine) => {
    const photoDocumentIds = next.photoDocumentIds.slice(0, next.photoUris.length);
    setLine({ ...next, photoDocumentIds });
  };

  const saveMutation = useMutation({
    mutationFn: async (action: 'CONFIRM' | 'CORRECT') => {
      const untitled = t('mobile.newOrder.untitledModel');
      const withPhotos = await uploadLinePhotos(
        line,
        props.mode === 'rfq' ? props.requestId : quotationQuery.data?.request?.id,
      );
      if (props.mode === 'rfq') {
        return verifyRequestSpec(props.requestId, {
          itemId: props.itemId,
          action,
          message: withPhotos.customProductName,
          fields: action === 'CORRECT' ? verifyFieldsFromLine(withPhotos, untitled, seatLabel) : undefined,
        });
      }
      const quote = quotationQuery.data;
      if (!quote) throw new Error(t('mobile.adminQuotation.saveFailed'));
      const draft = (quote.lines ?? []).map((row) => ({
        id: row.id,
        unitPrice: String(row.unitPrice ?? '0'),
        line: row,
      }));
      const priced = draft.find((row) => row.id === props.lineId);
      const patched = quotationLinePatchFromLine(
        withPhotos,
        {
          unitPrice: Number(priced?.unitPrice ?? quoteLine?.unitPrice) || 0,
          taxRate: quoteLine?.taxRate != null ? Number(quoteLine.taxRate) : 0.16,
        },
        untitled,
        seatLabel,
      );
      const lines = quotationDraftSaveLines(draft).map((row) =>
        row.id === props.lineId ? { ...row, ...patched, id: props.lineId } : row,
      );
      return updateQuotation(props.quotationId, { lines });
    },
    onSuccess: async (_data, action) => {
      void haptics.confirmMedium();
      showToast({
        variant: 'success',
        message:
          props.mode === 'rfq'
            ? action === 'CONFIRM'
              ? t('mobile.adminRequest.specConfirmed')
              : t('mobile.adminRequest.saved')
            : t('mobile.adminQuotation.saved'),
      });
      if (props.mode === 'rfq') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.requests.detail(props.requestId) });
      } else {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.quotations.detail(props.quotationId),
        });
      }
      router.back();
    },
    onError: (err) => {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err)
          ? toastMessageForError(err)
          : props.mode === 'rfq'
            ? t('mobile.adminRequest.actionFailed')
            : t('mobile.adminQuotation.saveFailed'),
      });
    },
  });

  const loading =
    (props.mode === 'rfq' && requestQuery.isLoading && !requestQuery.data) ||
    (props.mode === 'quote' && quotationQuery.isLoading && !quotationQuery.data);
  const failed =
    (props.mode === 'rfq' && requestQuery.isError && !requestQuery.data) ||
    (props.mode === 'quote' && quotationQuery.isError && !quotationQuery.data);
  const missing = props.mode === 'rfq' ? !rfqItem && !requestQuery.isLoading : !quoteLine && !quotationQuery.isLoading;

  const footerClearance = stickyCtaBottomInset(insets.bottom, theme.spacing.sm, SURFACE_TAB_BAR_CLEARANCE);
  const visual = line.imageUrl || line.photoUris.find(Boolean);
  const sku = line.variantSku || line.variantLabel;

  if (loading) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={backFallback} />
        <ProductDetailSkeleton />
      </AppScreen>
    );
  }
  if (failed) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={backFallback} />
        <ErrorState
          title={t('mobile.adminRequest.errorTitle')}
          description={t('mobile.adminRequest.errorBody')}
          retryLabel={t('mobile.adminRequest.retry')}
          onRetry={() =>
            props.mode === 'rfq' ? void requestQuery.refetch() : void quotationQuery.refetch()
          }
        />
      </AppScreen>
    );
  }
  if (missing) {
    return (
      <AppScreen>
        <ScreenBackLead fallback={backFallback} />
        <EmptyState title={t('mobile.adminRequest.noLineItems')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: true }} style={{ paddingHorizontal: 0 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <ScreenBackLead fallback={backFallback} />
        <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText variant="largeTitle" weight={titleWeight}>
            {t('mobile.adminRequest.lineDeskTitle')}
          </AppText>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 88 + footerClearance + theme.spacing.lg,
        }}
      >
        <ListItemEnter index={0}>
          <CatalogSectionBoard title={t('mobile.adminRequest.product')} titleWeight={titleWeight}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.md,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: theme.radius.lg,
                  overflow: 'hidden',
                  backgroundColor: colors.surfaceSecondary,
                  ...orderBoardShadow(colorScheme),
                }}
              >
                {visual ? (
                  <Image source={{ uri: visual }} style={{ width: 72, height: 72 }} />
                ) : (
                  <EmptyProductImage />
                )}
              </View>
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                {sku ? (
                  <AppText variant="caption" color="muted">
                    {sku}
                  </AppText>
                ) : null}
                <View
                  style={{
                    alignSelf: isRTL ? 'flex-end' : 'flex-start',
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: 4,
                    borderRadius: theme.radius.md,
                    backgroundColor: colors.warningSoft,
                    borderWidth: 1,
                    borderColor: colors.warning,
                  }}
                >
                  <AppText variant="caption" weight="medium" style={{ color: colors.warning }}>
                    {t(`mobile.lineKind.${complexity}`)}
                  </AppText>
                </View>
              </View>
            </View>
            <TextField
              label={t('mobile.adminRequest.product')}
              value={line.customProductName}
              onChangeText={(customProductName) => onChangeLine({ ...line, customProductName })}
              editable={editable}
            />
            <NewOrderQtyStepper
              value={line.quantity}
              onChange={(quantity) => onChangeLine({ ...line, quantity })}
              disabled={!editable}
            />
          </CatalogSectionBoard>
        </ListItemEnter>

        <ListItemEnter index={1}>
          <View pointerEvents={editable ? 'auto' : 'none'}>
            <DealerCustomPhotosBoard line={line} onChange={onChangeLine} titleWeight={titleWeight} />
          </View>
        </ListItemEnter>
        <ListItemEnter index={2}>
          <View pointerEvents={editable ? 'auto' : 'none'}>
            <DealerOrderSpecsBoard
              line={line}
              onChange={onChangeLine}
              groups={specGroupsQuery.data?.data ?? []}
              values={specValuesQuery.data?.data ?? []}
              titleWeight={titleWeight}
            />
          </View>
        </ListItemEnter>
        <ListItemEnter index={3}>
          <View pointerEvents={editable ? 'auto' : 'none'}>
            <DealerMeasurementsBoard line={line} onChange={onChangeLine} titleWeight={titleWeight} />
          </View>
        </ListItemEnter>
        <ListItemEnter index={4}>
          <View pointerEvents={editable ? 'auto' : 'none'}>
            <CatalogSectionBoard title={t('mobile.adminRequest.fabrics')} titleWeight={titleWeight}>
              <FabricSelectionsEditor
                value={line.fabrics}
                onChange={(fabrics) => onChangeLine({ ...line, fabrics })}
              />
            </CatalogSectionBoard>
          </View>
        </ListItemEnter>
        <ListItemEnter index={5}>
          <CatalogSectionBoard title={t('mobile.adminRequest.itemNotes')} titleWeight={titleWeight}>
            <TextField
              label={t('mobile.adminRequest.itemNotes')}
              value={line.notes}
              onChangeText={(notes) => onChangeLine({ ...line, notes })}
              editable={editable}
              multiline
            />
          </CatalogSectionBoard>
        </ListItemEnter>
      </ScrollView>

      {editable ? (
        <FloatingActionDock floating tabClearance={SURFACE_TAB_BAR_CLEARANCE}>
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
              ...orderBoardShadow(colorScheme),
            }}
          >
            {props.mode === 'rfq' ? (
              <SecondaryButton
                label={t('mobile.adminRequest.confirmSpec')}
                onPress={() => saveMutation.mutate('CONFIRM')}
                loading={saveMutation.isPending}
              />
            ) : null}
            <PrimaryButton
              label={
                props.mode === 'rfq'
                  ? t('mobile.adminRequest.saveCorrections')
                  : t('mobile.adminQuotation.save')
              }
              onPress={() => saveMutation.mutate('CORRECT')}
              loading={saveMutation.isPending}
            />
          </View>
        </FloatingActionDock>
      ) : null}
    </AppScreen>
  );
}
