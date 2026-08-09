import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { uploadFile } from '@/api/modules/uploads';
import { listSalesOrders, getSalesOrder } from '@/api/modules/sales-orders';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useQuery } from '@tanstack/react-query';
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

export function CreateReturnScreen({ afterCreateHref }: Props) {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const allowed = can(user, 'sales-order.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [orderOpen, setOrderOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<ReturnReason>('MANUFACTURING_DEFECT');
  const [description, setDescription] = useState('');
  const [reasonPhotos, setReasonPhotos] = useState<PhotoSlot[]>([]);
  const [issuePhotos, setIssuePhotos] = useState<PhotoSlot[]>([]);
  const [uploading, setUploading] = useState<'reason' | 'issue' | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['returns-orders'],
    queryFn: () => listSalesOrders({ page: 1, pageSize: 30 }),
    enabled: allowed && orderOpen,
  });

  const orderDetailQuery = useQuery({
    queryKey: ['returns-order', salesOrderId],
    queryFn: () => getSalesOrder(salesOrderId),
    enabled: Boolean(salesOrderId),
  });

  const createMutation = useCreateReturnMutation();
  const selectedOrder = ordersQuery.data?.data.find((o) => o.id === salesOrderId);

  async function pickPhoto(slot: 'reason' | 'issue') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 8,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(slot);
    try {
      const uploaded: PhotoSlot[] = [];
      for (const a of result.assets) {
        const doc = await uploadFile({
          uri: a.uri,
          fileName: a.fileName ?? `return-${slot}-${Date.now()}.jpg`,
          mimeType: a.mimeType ?? 'image/jpeg',
          category: slot === 'reason' ? 'RETURN_REASON' : 'RETURN_ISSUE',
        });
        uploaded.push({ key: doc.document.storageKey, previewUri: a.uri });
      }
      if (slot === 'reason') setReasonPhotos((prev) => [...prev, ...uploaded]);
      else setIssuePhotos((prev) => [...prev, ...uploaded]);
      void haptics.confirmMedium();
    } catch {
      showToast({ variant: 'error', message: t('mobile.returns.uploadFailed') });
    } finally {
      setUploading(null);
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
      <AppScreen backFallback={'/(app)/(customer)/(tabs)' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  const lines = orderDetailQuery.data?.customerRequest?.items ?? [];

  return (
    <AppScreen backFallback={'/(app)/(customer)/(tabs)' as Href}>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
      >
        <AppText variant="title" weight={titleWeight}>
          {t('mobile.returns.newReturn')}
        </AppText>

        <SecondaryButton
          label={
            selectedOrder
              ? `${t('mobile.returns.order')}: ${selectedOrder.number}`
              : t('catalog.selectSalesOrderPlaceholder')
          }
          onPress={() => setOrderOpen(true)}
          style={{ borderRadius: theme.radius.xl }}
        />

        {lines.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="secondary">
              {t('mobile.returns.pickItem')}
            </AppText>
            {lines.map((line) => (
              <Pressable
                key={line.id}
                onPress={() => {
                  setProductDesc(line.productName || '');
                  setQuantity(String(line.quantity ?? '1'));
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: theme.radius.lg,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                }}
              >
                <AppText>{line.productName}</AppText>
              </Pressable>
            ))}
          </View>
        ) : selectedOrder?.title ? (
          <SecondaryButton
            label={t('mobile.returns.useOrderTitle')}
            onPress={() => setProductDesc(selectedOrder.title || '')}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}

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

        <AppText variant="label" color="secondary">
          {t('mobile.returns.reason')}
        </AppText>
        <View style={{ gap: theme.spacing.sm }}>
          {REASONS.map((r) => {
            const selected = reason === r;
            const label = (() => {
              const catalog = t(`catalog.returnReason.${r}`);
              if (catalog !== `catalog.returnReason.${r}`) return catalog;
              return t(`mobile.returns.reasons.${r}`);
            })();
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
                  borderWidth: 1,
                  borderColor: selected ? colors.brand : colors.border,
                  backgroundColor: selected ? colors.brandSoft : colors.surface,
                  borderRadius: theme.radius.lg,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                }}
              >
                <AppText style={{ color: selected ? colors.brand : colors.textPrimary }}>
                  {label}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>

        <TextField
          label={t('mobile.returns.notes')}
          value={description}
          onChangeText={setDescription}
        />

        <PhotoAlbumEditor
          title={(() => {
            const v = t('catalog.uploadReasonPhoto');
            return v === 'catalog.uploadReasonPhoto' ? 'Reason photos' : v;
          })()}
          photos={reasonPhotos}
          loading={uploading === 'reason'}
          onAdd={() => void pickPhoto('reason')}
          onRemove={(key) => setReasonPhotos((prev) => prev.filter((p) => p.key !== key))}
        />
        <PhotoAlbumEditor
          title={(() => {
            const v = t('catalog.uploadIssuePhoto');
            return v === 'catalog.uploadIssuePhoto' ? 'Damage photos' : v;
          })()}
          photos={issuePhotos}
          loading={uploading === 'issue'}
          onAdd={() => void pickPhoto('issue')}
          onRemove={(key) => setIssuePhotos((prev) => prev.filter((p) => p.key !== key))}
        />

        <PrimaryButton
          label={t('catalog.submitReturn')}
          loading={createMutation.isPending}
          onPress={submit}
          style={{ borderRadius: theme.radius.xl }}
        />
      </ScrollView>

      <BottomSheet
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        title={t('catalog.selectSalesOrder')}
        sheetHeight={480}
      >
        <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}
            showsVerticalScrollIndicator
          >
            {(ordersQuery.data?.data ?? []).map((o) => {
              const active = o.id === salesOrderId;
              return (
                <AnimatedPressable
                  key={o.id}
                  variant="button"
                  onPress={() => {
                    void haptics.selection();
                    setSalesOrderId(o.id);
                  }}
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: active ? 1.5 : 1,
                    borderColor: active ? colors.brand : colors.borderStrong,
                    backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                    padding: theme.spacing.md,
                    gap: 2,
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  <AppText weight="semibold" dir="ltr">
                    {o.number}
                  </AppText>
                  {o.title ? (
                    <AppText variant="caption" color="secondary" numberOfLines={1}>
                      {o.title}
                    </AppText>
                  ) : null}
                </AnimatedPressable>
              );
            })}
          </ScrollView>
          <View style={{ gap: theme.spacing.sm }}>
            <PrimaryButton
              label={t('common.confirm')}
              onPress={() => {
                void haptics.confirmLight();
                setOrderOpen(false);
              }}
              style={{ borderRadius: theme.radius.xl }}
            />
            <SecondaryButton
              label={t('common.cancel')}
              onPress={() => setOrderOpen(false)}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
        </View>
      </BottomSheet>
    </AppScreen>
  );
}

function PhotoAlbumEditor({
  title,
  photos,
  loading,
  onAdd,
  onRemove,
}: {
  title: string;
  photos: PhotoSlot[];
  loading: boolean;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText variant="caption" weight="semibold" color="brand">
          {title}
        </AppText>
        <AppText variant="caption" color="muted" dir="ltr">
          {String(photos.length)}
        </AppText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
        }}
      >
        {photos.map((p) => (
          <View key={p.key} style={{ width: 88, height: 88 }}>
            <Image
              source={{ uri: p.previewUri }}
              style={{
                width: 88,
                height: 88,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
            <AnimatedPressable
              variant="button"
              onPress={() => onRemove(p.key)}
              hitSlop={8}
              style={{
                position: 'absolute',
                top: -6,
                ...(isRTL ? { left: -6 } : { right: -6 }),
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderStrong,
              }}
            >
              <Ionicons name="close" size={14} color={colors.textPrimary} />
            </AnimatedPressable>
          </View>
        ))}
        <AnimatedPressable
          variant="button"
          onPress={onAdd}
          disabled={loading}
          style={{
            width: 88,
            height: 88,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.brand,
            borderStyle: 'dashed',
            backgroundColor: colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: loading ? 0.7 : 1,
          }}
        >
          <Ionicons name="add" size={22} color={colors.brand} />
          <AppText variant="caption" color="brand" style={{ fontSize: 10 }}>
            {loading ? '…' : '+'}
          </AppText>
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}
