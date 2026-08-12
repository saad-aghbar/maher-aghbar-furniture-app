import { useMemo, useState, type ReactNode } from 'react';
import { Image, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { uploadFile } from '@/api/modules/uploads';
import {
  getSalesOrder,
  type SalesOrderLineItem,
  type SalesOrderListItem,
} from '@/api/modules/sales-orders';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useQuery } from '@tanstack/react-query';
import { ReturnOrderPickerSheet } from './components/ReturnOrderPickerSheet';
import { ReturnPhotoBoard } from './components/ReturnPhotoBoard';
import { useCreateReturnMutation, type ReturnReason } from './query';

const REASONS: ReturnReason[] = [
  'MANUFACTURING_DEFECT',
  'INCORRECT_MEASUREMENT',
  'INCORRECT_MATERIAL',
  'INCORRECT_COLOR',
  'DELIVERY_DAMAGE',
  'CUSTOMER_REQUEST',
  'OTHER',
];

type Props = { afterCreateHref: (id: string) => Href };

type PhotoSlot = {
  key: string;
  previewUri: string;
};

function reasonLabel(t: (key: string) => string, r: ReturnReason): string {
  const catalog = t(`catalog.returnReason.${r}`);
  if (catalog !== `catalog.returnReason.${r}`) return catalog;
  return t(`mobile.returns.reasons.${r}`);
}

function lineMeta(line: SalesOrderLineItem): string {
  return [line.fabricType, line.fabricColor, line.woodType, line.finish]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .join(' · ');
}

export function CreateReturnScreen({ afterCreateHref }: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const { openAccessoryCamera } = useAccessoryCamera();
  const allowed = can(user, 'sales-order.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrderListItem | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [productDesc, setProductDesc] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<ReturnReason>('MANUFACTURING_DEFECT');
  const [description, setDescription] = useState('');
  const [reasonPhotos, setReasonPhotos] = useState<PhotoSlot[]>([]);
  const [issuePhotos, setIssuePhotos] = useState<PhotoSlot[]>([]);
  const [uploading, setUploading] = useState<'reason' | 'issue' | null>(null);

  const salesOrderId = selectedOrder?.id ?? '';

  const orderDetailQuery = useQuery({
    queryKey: ['returns-order', salesOrderId],
    queryFn: () => getSalesOrder(salesOrderId),
    enabled: Boolean(salesOrderId),
  });

  const createMutation = useCreateReturnMutation();

  const lines = useMemo(() => {
    const detail = orderDetailQuery.data;
    if (!detail) return [] as SalesOrderLineItem[];
    const ordered = detail.orderedItems ?? [];
    if (ordered.length > 0) return ordered;
    return detail.customerRequest?.items ?? [];
  }, [orderDetailQuery.data]);

  const orderImageUrl =
    selectedOrder?.imageUrl ?? orderDetailQuery.data?.imageUrl ?? null;

  async function uploadAssets(
    slot: 'reason' | 'issue',
    assets: Array<{ uri: string; fileName?: string | null; mimeType?: string | null }>,
  ) {
    if (!assets.length) return;
    setUploading(slot);
    try {
      const uploaded: PhotoSlot[] = [];
      for (const a of assets) {
        const doc = await uploadFile({
          uri: a.uri,
          fileName: a.fileName ?? `return-${slot}-${Date.now()}.jpg`,
          mimeType: a.mimeType ?? 'image/jpeg',
          category: slot === 'reason' ? 'RETURN_REASON' : 'RETURN_ISSUE',
        });
        uploaded.push({ key: doc.document.storageKey, previewUri: a.uri });
      }
      if (slot === 'reason') setReasonPhotos((prev) => [...prev, ...uploaded].slice(0, 8));
      else setIssuePhotos((prev) => [...prev, ...uploaded].slice(0, 8));
      void haptics.confirmMedium();
    } catch {
      showToast({ variant: 'error', message: t('mobile.returns.uploadFailed') });
    } finally {
      setUploading(null);
    }
  }

  async function pickPhoto(
    slot: 'reason' | 'issue',
    source: 'camera' | 'gallery',
  ) {
    try {
      if (source === 'camera') {
        /** Branded in-app camera — same AccessoryCamera as inventory / new order. */
        const uri = await openAccessoryCamera({
          title:
            slot === 'reason'
              ? t('mobile.returns.cameraReasonTitle')
              : t('mobile.returns.cameraDamageTitle'),
          hint:
            slot === 'reason'
              ? t('mobile.returns.cameraReasonHint')
              : t('mobile.returns.cameraDamageHint'),
          aspectRatio: 4 / 3,
        });
        if (!uri) return;
        await uploadAssets(slot, [
          {
            uri,
            fileName: `return-${slot}-${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
          },
        ]);
        return;
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast({
          variant: 'error',
          message: t('mobile.returns.galleryPermission'),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 8,
      });
      if (result.canceled || !result.assets?.length) return;
      await uploadAssets(slot, result.assets);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/simulator|not available/i.test(message)) {
        showToast({
          variant: 'error',
          message: t('mobile.returns.cameraUnavailable'),
        });
        return;
      }
      showToast({
        variant: 'error',
        message:
          source === 'camera'
            ? t('mobile.returns.cameraPermission')
            : t('mobile.returns.uploadFailed'),
      });
    }
  }

  function submit() {
    if (!salesOrderId) {
      showToast({
        variant: 'error',
        message: t('catalog.returnOrderRequired'),
      });
      return;
    }
    if (!productDesc.trim()) {
      showToast({ variant: 'error', message: t('mobile.returns.itemRequired') });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast({ variant: 'error', message: t('mobile.returns.qtyInvalid') });
      return;
    }
    if (reasonPhotos.length === 0 || issuePhotos.length === 0) {
      showToast({
        variant: 'error',
        message: t('catalog.returnPhotosRequired'),
      });
      return;
    }
    createMutation.mutate(
      {
        customerId: user?.customerId || undefined,
        salesOrderId,
        productDesc: productDesc.trim(),
        quantity: qty,
        reason,
        description: description.trim() || undefined,
        reasonPhotoKeys: reasonPhotos.map((p) => p.key),
        issuePhotoKeys: issuePhotos.map((p) => p.key),
      },
      {
        onSuccess: (row) => {
          void haptics.confirmMedium();
          showToast({ variant: 'success', message: t('mobile.returns.createSuccess') });
          router.replace(afterCreateHref(row.id));
        },
        onError: () => {
          void haptics.error();
          showToast({ variant: 'error', message: t('mobile.returns.createFailed') });
        },
      },
    );
  }

  if (!allowed) {
    return (
      <AppScreen>
        <CreateReturnHeader
          backFallback={'/(app)/(customer)/returns' as Href}
          titleWeight={titleWeight}
        />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <CreateReturnHeader
          backFallback={'/(app)/(customer)/returns' as Href}
          titleWeight={titleWeight}
        />

        {/* Order board */}
        <FloorSection title={t('mobile.returns.order')}>
          {selectedOrder ? (
            <SelectedOrderPreview
              order={selectedOrder}
              imageUrl={orderImageUrl}
              formatDate={formatDate}
              onChange={() => setOrderOpen(true)}
            />
          ) : (
            <AnimatedPressable
              variant="button"
              onPress={() => {
                void haptics.selection();
                setOrderOpen(true);
              }}
              style={{
                minHeight: 56,
                borderRadius: theme.radius.full,
                borderWidth: 1.5,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                paddingHorizontal: theme.spacing.lg,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <AppText weight={titleWeight} style={{ color: colors.textPrimary, flex: 1 }}>
                {t('catalog.selectSalesOrderPlaceholder')}
              </AppText>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.textMuted}
              />
            </AnimatedPressable>
          )}
        </FloorSection>

        {/* Item board */}
        {salesOrderId ? (
          <FloorSection title={t('mobile.returns.pickItem')}>
            {orderDetailQuery.isLoading ? (
              <AppText variant="caption" color="muted">
                {t('mobile.returns.loading')}
              </AppText>
            ) : lines.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                {lines.map((line) => {
                  const selected = selectedLineId === line.id;
                  const meta = lineMeta(line);
                  const thumb = resolveOrderMediaUri(orderImageUrl);
                  return (
                    <AnimatedPressable
                      key={line.id}
                      variant="button"
                      onPress={() => {
                        void haptics.selection();
                        setSelectedLineId(line.id);
                        setProductDesc(line.productName || line.description || '');
                        setQuantity(String(line.quantity ?? '1'));
                      }}
                      style={{
                        borderRadius: theme.radius.xl,
                        borderWidth: selected ? 1.5 : 1,
                        borderColor: selected ? colors.brand : colors.borderStrong,
                        backgroundColor: selected ? colors.brandSoft : colors.surface,
                        overflow: 'hidden',
                        ...orderBoardShadow(colorScheme),
                      }}
                    >
                      {selected ? (
                        <View
                          pointerEvents="none"
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            ...(isRTL ? { right: 0 } : { left: 0 }),
                            width: 3,
                            backgroundColor: colors.brand,
                            opacity: 0.85,
                          }}
                        />
                      ) : null}
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          gap: theme.spacing.md,
                          padding: theme.spacing.md,
                          ...(isRTL
                            ? { paddingRight: theme.spacing.md + (selected ? 4 : 0) }
                            : { paddingLeft: theme.spacing.md + (selected ? 4 : 0) }),
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: theme.radius.lg,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceSecondary,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {thumb ? (
                            <Image
                              source={{ uri: thumb }}
                              style={{ width: 56, height: 56 }}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="cube-outline" size={22} color={colors.textMuted} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <AppText
                            weight={titleWeight}
                            numberOfLines={2}
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                          >
                            {line.productName || line.description || '—'}
                          </AppText>
                          <AppText variant="caption" color="muted" dir="ltr">
                            {t('mobile.returns.qtyLabel', {
                              qty: String(line.quantity ?? 1),
                            })}
                          </AppText>
                          {meta ? (
                            <AppText
                              variant="caption"
                              color="secondary"
                              numberOfLines={1}
                              style={{ textAlign: isRTL ? 'right' : 'left' }}
                            >
                              {meta}
                            </AppText>
                          ) : null}
                        </View>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                        ) : null}
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </View>
            ) : selectedOrder?.title ? (
              <AnimatedPressable
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  setSelectedLineId(null);
                  setProductDesc(selectedOrder.title || '');
                }}
                style={{
                  minHeight: 48,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surface,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <AppText color="brand" weight="semibold">
                  {t('mobile.returns.useOrderTitle')}
                </AppText>
              </AnimatedPressable>
            ) : (
              <AppText variant="caption" color="muted">
                {t('mobile.returns.noLinesHint')}
              </AppText>
            )}

            <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
              <TextField
                label={t('mobile.returns.item')}
                value={productDesc}
                onChangeText={setProductDesc}
              />
              <TextField
                label={t('mobile.returns.quantity')}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
              />
            </View>
          </FloorSection>
        ) : null}

        {/* Reason board */}
        <FloorSection title={t('mobile.returns.reason')}>
          <View style={{ gap: theme.spacing.sm }}>
            {REASONS.map((r) => {
              const selected = reason === r;
              return (
                <AnimatedPressable
                  key={r}
                  variant="button"
                  onPress={() => {
                    void haptics.selection();
                    setReason(r);
                  }}
                  style={{
                    minHeight: theme.sizes.touch.min,
                    borderWidth: selected ? 1.5 : 1,
                    borderColor: selected ? colors.brand : colors.borderStrong,
                    backgroundColor: selected ? colors.brandSoft : colors.surface,
                    borderRadius: theme.radius.xl,
                    paddingHorizontal: theme.spacing.md,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    weight={selected ? titleWeight : 'medium'}
                    style={{ color: selected ? colors.brand : colors.textPrimary, flex: 1 }}
                  >
                    {reasonLabel(t, r)}
                  </AppText>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
                  ) : null}
                </AnimatedPressable>
              );
            })}
          </View>
        </FloorSection>

        {/* Notes */}
        <FloorSection title={t('mobile.returns.notes')}>
          <TextField
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder={t('mobile.returns.notesPlaceholder')}
          />
        </FloorSection>

        {/* Photos */}
        <FloorSection
          title={(() => {
            const v = t('catalog.uploadReasonPhoto');
            return v === 'catalog.uploadReasonPhoto'
              ? t('mobile.returns.reasonPhoto')
              : v;
          })()}
          count={reasonPhotos.length}
        >
          <ReturnPhotoBoard
            photos={reasonPhotos}
            loading={uploading === 'reason'}
            onCamera={() => void pickPhoto('reason', 'camera')}
            onGallery={() => void pickPhoto('reason', 'gallery')}
            onRemove={(key) =>
              setReasonPhotos((prev) => prev.filter((p) => p.key !== key))
            }
          />
        </FloorSection>

        <FloorSection
          title={(() => {
            const v = t('catalog.uploadIssuePhoto');
            return v === 'catalog.uploadIssuePhoto'
              ? t('mobile.returns.damagePhoto')
              : v;
          })()}
          count={issuePhotos.length}
        >
          <ReturnPhotoBoard
            photos={issuePhotos}
            loading={uploading === 'issue'}
            onCamera={() => void pickPhoto('issue', 'camera')}
            onGallery={() => void pickPhoto('issue', 'gallery')}
            onRemove={(key) =>
              setIssuePhotos((prev) => prev.filter((p) => p.key !== key))
            }
          />
        </FloorSection>

        <PrimaryButton
          label={t('mobile.returns.submit')}
          loading={createMutation.isPending}
          onPress={submit}
          style={{ borderRadius: theme.radius.xl }}
        />
      </ScrollView>

      <ReturnOrderPickerSheet
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        selectedId={salesOrderId}
        selectedOrder={selectedOrder}
        onConfirm={(order) => {
          setSelectedOrder(order);
          setSelectedLineId(null);
          setProductDesc('');
          setQuantity('1');
        }}
      />
    </AppScreen>
  );
}

function CreateReturnHeader({
  backFallback,
  titleWeight,
}: {
  backFallback: Href;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            zIndex: 1,
            justifyContent: 'center',
          }}
        >
          <ScreenBackLead fallback={backFallback} />
        </View>
        <AppText
          variant="largeTitle"
          weight={titleWeight}
          align="center"
          numberOfLines={1}
          style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
        >
          {t('mobile.returns.newReturn')}
        </AppText>
      </View>
      <AppText
        variant="caption"
        color="muted"
        align="center"
        style={{ paddingHorizontal: theme.spacing.lg }}
      >
        {t('mobile.returns.subtitle')}
      </AppText>
    </View>
  );
}

function FloorSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
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
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="caption" weight="semibold" color="brand">
          {title}
        </AppText>
        {typeof count === 'number' ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {String(count)}
          </AppText>
        ) : null}
      </View>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>{children}</View>
    </View>
  );
}

function SelectedOrderPreview({
  order,
  imageUrl,
  formatDate,
  onChange,
}: {
  order: SalesOrderListItem;
  imageUrl: string | null;
  formatDate: (iso: string) => string;
  onChange: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const uri = resolveOrderMediaUri(imageUrl);
  const subtitle = order.title || order.projectName || order.externalOrderNumber;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
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
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {uri ? (
            <Image source={{ uri }} style={{ width: 64, height: 64 }} resizeMode="cover" />
          ) : (
            <Ionicons name="cube-outline" size={24} color={colors.textMuted} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <AppText weight={titleWeight} dir="ltr" numberOfLines={1} style={{ flex: 1 }}>
              {order.number}
            </AppText>
            <StatusBadge status={order.status} dot />
          </View>
          {subtitle ? (
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={2}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {subtitle}
            </AppText>
          ) : null}
          {order.requiredDeliveryDate ? (
            <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.returns.deliveryBy', {
                date: formatDate(order.requiredDeliveryDate),
              })}
            </AppText>
          ) : null}
        </View>
      </View>
      <AnimatedPressable
        variant="button"
        onPress={() => {
          void haptics.selection();
          onChange();
        }}
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingVertical: theme.spacing.sm + 2,
          paddingHorizontal: theme.spacing.md,
          alignItems: 'center',
        }}
      >
        <AppText variant="caption" color="brand" weight="semibold">
          {t('mobile.returns.changeOrder')}
        </AppText>
      </AnimatedPressable>
    </View>
  );
}
