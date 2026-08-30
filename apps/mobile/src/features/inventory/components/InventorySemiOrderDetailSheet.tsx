import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ImageViewer } from '@/components/media/ImageViewer';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { getWipKit, getWipKitTimeline, type WipKitCard } from '@/api/modules/inventory';
import { queryKeys } from '@/api/queryKeys';
import { ImageCarousel } from '@/features/sales-orders/components/ImageCarousel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { InventorySheetFooter } from './InventorySheetFooter';

type Props = {
  open: boolean;
  kitId: string | null;
  /** Seed from list while detail loads */
  seed?: WipKitCard | null;
  onClose: () => void;
  /** After the detail Modal unmounts — open QR / PDF from here. */
  onClosed?: () => void;
  onShowQr?: (kit: WipKitCard) => void;
  onPrintQr?: (kit: WipKitCard) => void;
};

function localizedProduct(kit: WipKitCard, locale: string): string {
  const p = kit.productionOrder.product;
  if (!p) return kit.productionOrder.productDescription;
  if (locale === 'ar') return p.nameAr || p.nameEn;
  if (locale === 'he') return p.nameHe || p.nameEn;
  return p.nameEn || p.nameAr;
}

function localizedStage(kit: WipKitCard, locale: string): string {
  const s = kit.stageInstance.stageDefinition;
  if (locale === 'ar') return s.nameAr || s.nameEn;
  if (locale === 'he') return s.nameHe || s.nameEn;
  return s.nameEn;
}

function kitAccent(
  status: string,
  colors: { info: string; warning: string; success: string; textMuted: string },
): string {
  if (status === 'CLAIMED') return colors.warning;
  if (status === 'READY') return colors.info;
  if (status === 'CONSUMED') return colors.success;
  return colors.textMuted;
}

/**
 * Semi order detail — LotInspect stacking + ImageCarousel for worker photos.
 */
export function InventorySemiOrderDetailSheet({
  open,
  kitId,
  seed,
  onClose,
  onClosed,
  onShowQr,
  onPrintQr,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const detailQuery = useQuery({
    queryKey: queryKeys.inventory.wipKitDetail(kitId ?? ''),
    queryFn: () => getWipKit(kitId!),
    enabled: open && Boolean(kitId),
  });

  const timelineQuery = useQuery({
    queryKey: queryKeys.inventory.wipKitTimeline(kitId ?? ''),
    queryFn: () => getWipKitTimeline(kitId!),
    enabled: open && Boolean(kitId),
  });

  const kit = detailQuery.data ?? seed ?? null;
  const photoIds = useMemo(
    () =>
      (kit?.pieces ?? [])
        .map((p) => p.photoDocumentId ?? p.photoDocument?.id ?? null)
        .filter((id): id is string => Boolean(id)),
    [kit?.pieces],
  );
  const [photoByDocId, setPhotoByDocId] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!open || photoIds.length === 0) {
      setPhotoByDocId({});
      return;
    }
    void (async () => {
      const next: Record<string, string> = {};
      for (const id of photoIds) {
        try {
          next[id] = await resolveDocumentUrl(id);
        } catch {
          /* skip broken */
        }
      }
      if (!cancelled) setPhotoByDocId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, photoIds.join('|')]);

  useEffect(() => {
    if (!open) setViewerIndex(null);
  }, [open]);

  const photoUris = useMemo(
    () => photoIds.map((id) => photoByDocId[id]).filter((u): u is string => Boolean(u)),
    [photoIds, photoByDocId],
  );

  const galleryDocIds = useMemo(
    () => photoIds.filter((id) => Boolean(photoByDocId[id])),
    [photoIds, photoByDocId],
  );

  if (!kit) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        onClosed={onClosed}
        title={t('mobile.inventory.semiOrderDetail')}
      >
        <AppText variant="body" color="muted">
          {detailQuery.isLoading
            ? t('mobile.inventory.loadingMore')
            : t('mobile.inventory.semiOrderMissing')}
        </AppText>
      </BottomSheet>
    );
  }

  const name = localizedProduct(kit, locale);
  const stageName = localizedStage(kit, locale);
  const accent = kitAccent(kit.status, colors);
  const bin = kit.location?.name?.trim() || kit.location?.code || null;
  const warehouse = kit.warehouse
    ? locale === 'ar'
      ? kit.warehouse.nameAr || kit.warehouse.nameEn
      : kit.warehouse.nameEn
    : null;
  const qty = kit.pieces.find((p) => p.inventoryLot)?.inventoryLot?.quantity;
  const materials = kit.producingTask?.materialUsages ?? [];
  const makerEmp = kit.producingTask?.assignedEmployee;
  const makerName = makerEmp
    ? `${makerEmp.firstName} ${makerEmp.lastName}`.trim()
    : null;
  const claimer = kit.claimedByUser
    ? `${kit.claimedByUser.firstName} ${kit.claimedByUser.lastName}`.trim()
    : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={t('mobile.inventory.semiOrderDetail')}
      fitContent
      maxHeight={680}
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
      >
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
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              width: 3,
              backgroundColor: accent,
              opacity: 0.85,
            }}
          />
          <View
            style={{
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <AppText
                  variant="caption"
                  weight="semibold"
                  dir="ltr"
                  style={{ color: colors.brand, letterSpacing: locale === 'ar' ? 0 : 0.5 }}
                >
                  {kit.productionOrder.number}
                </AppText>
                <AppText variant="body" weight={titleWeight} numberOfLines={2}>
                  {name}
                </AppText>
              </View>
              <StatusBadge status={kit.status} />
            </View>

            {qty != null ? (
              <View
                style={{
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: theme.radius.full,
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <AppText variant="caption" weight="semibold" color="brand" dir="ltr">
                  {t('mobile.inventory.semiOnHand', { qty: String(qty) })}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        {photoUris.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <SectionEyebrow label={t('mobile.inventory.semiWorkerPhotos')} />
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                overflow: 'hidden',
                backgroundColor: colors.surface,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <ImageCarousel uris={photoUris} height={220} />
            </View>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <SectionEyebrow label={t('mobile.inventory.semiFacts')} />
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <FactRow icon="construct-outline" label={t('inventory.stage')} value={stageName} />
            {bin ? (
              <FactRow
                icon="location-outline"
                label={t('mobile.inventory.wipLocation')}
                value={bin}
              />
            ) : null}
            {warehouse ? (
              <FactRow
                icon="business-outline"
                label={t('inventory.warehouse')}
                value={warehouse}
              />
            ) : null}
            <FactRow
              icon="layers-outline"
              label={t('mobile.inventory.semiPieces')}
              value={`${kit.pieces.length}/${kit.expectedPieceCount}`}
            />
            <FactRow
              icon="qr-code-outline"
              label={t('mobile.inventory.wipQrLabel')}
              value={kit.qrCode}
              last={!makerName && !claimer}
            />
            {makerName ? (
              <FactRow
                icon="hammer-outline"
                label={t('mobile.inventory.semiMadeBy')}
                value={makerName}
                last={!claimer}
              />
            ) : null}
            {claimer ? (
              <FactRow
                icon="person-outline"
                label={t('mobile.inventory.semiTookBy')}
                value={claimer}
                last
              />
            ) : null}
          </View>
        </View>

        {timelineQuery.data?.events?.length ? (
          <View style={{ gap: theme.spacing.sm }}>
            <SectionEyebrow label={t('mobile.inventory.wipTimeline')} />
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              }}
            >
              {timelineQuery.data.events.map((ev, idx) => (
                <View
                  key={`${ev.type}-${ev.at}-${idx}`}
                  style={{
                    gap: 2,
                    paddingBottom: idx === timelineQuery.data!.events.length - 1 ? 0 : theme.spacing.sm,
                    borderBottomWidth: idx === timelineQuery.data!.events.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <AppText variant="bodySecondary" weight="semibold">
                    {ev.type === 'PRODUCED'
                      ? t('mobile.inventory.wipEventProduced')
                      : ev.type === 'RECEIVED'
                        ? t('mobile.inventory.wipEventReceived')
                        : t('mobile.inventory.wipEventConsumed')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {ev.labelEn}
                    {ev.quantity != null ? ` · ${ev.quantity}` : ''}
                  </AppText>
                  <AppText variant="caption" color="muted" dir="ltr">
                    {new Date(ev.at).toLocaleString()}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {kit.pieces.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <SectionEyebrow label={t('mobile.inventory.semiPieces')} />
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                overflow: 'hidden',
              }}
            >
              {kit.pieces.map((piece, i) => {
                const docId = piece.photoDocumentId ?? piece.photoDocument?.id ?? null;
                const pieceUri = docId ? photoByDocId[docId] ?? null : null;
                const galleryIndex = docId ? galleryDocIds.indexOf(docId) : -1;
                const canView = galleryIndex >= 0 && Boolean(pieceUri);
                const pieceLabel =
                  piece.label || t('mobile.inventory.wipPieceN', { n: i + 1 });
                return (
                  <View
                    key={piece.id}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      padding: theme.spacing.md,
                      borderBottomWidth: i === kit.pieces.length - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <PieceThumb uri={pieceUri} />
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <AppText variant="bodySecondary" weight="medium">
                        {pieceLabel}
                      </AppText>
                      {piece.qrCode ? (
                        <AppText variant="caption" color="muted" dir="ltr">
                          {piece.qrCode}
                        </AppText>
                      ) : null}
                    </View>
                    {canView ? (
                      <AnimatedPressable
                        variant="button"
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.inventory.semiViewPiecePhoto')}
                        hitSlop={8}
                        onPress={() => {
                          void haptics.selection();
                          setViewerIndex(galleryIndex);
                        }}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.borderStrong,
                        }}
                      >
                        <Ionicons name="eye-outline" size={18} color={colors.brand} />
                      </AnimatedPressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {materials.length > 0 || kit.materialOverageNotes ? (
          <View style={{ gap: theme.spacing.sm }}>
            <SectionEyebrow label={t('mobile.inventory.semiMaterials')} />
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                overflow: 'hidden',
              }}
            >
              {materials.map((m, i) => {
                const itemName =
                  locale === 'ar'
                    ? m.inventoryItem?.nameAr || m.inventoryItem?.nameEn || m.sku
                    : m.inventoryItem?.nameEn || m.inventoryItem?.nameAr || m.sku;
                return (
                  <View
                    key={m.id}
                    style={{
                      padding: theme.spacing.md,
                      borderBottomWidth:
                        i === materials.length - 1 && !kit.materialOverageNotes ? 0 : 1,
                      borderBottomColor: colors.border,
                      gap: 2,
                    }}
                  >
                    <AppText variant="bodySecondary" weight="medium">
                      {itemName}
                    </AppText>
                    <AppText variant="caption" color="muted" dir="ltr">
                      {String(m.actualQty)} / {String(m.expectedQty)}
                      {m.isExtra ? ` · ${t('mobile.inventory.semiMaterialExtra')}` : ''}
                    </AppText>
                  </View>
                );
              })}
              {kit.materialOverageNotes ? (
                <View style={{ padding: theme.spacing.md }}>
                  <AppText variant="caption" color="warning">
                    {kit.materialOverageNotes}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <InventorySheetFooter
          primaryLabel={t('mobile.inventory.wipShowQr')}
          onPrimary={onShowQr ? () => onShowQr(kit) : undefined}
          secondaryLabel={
            onPrintQr ? t('mobile.inventory.wipPrintKitLabel') : t('mobile.inventory.cancel')
          }
          onSecondary={onPrintQr ? () => onPrintQr(kit) : onClose}
        />
      </ScrollView>
      <ImageViewer
        open={viewerIndex != null && photoUris.length > 0}
        uris={photoUris}
        index={viewerIndex ?? 0}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
        title={
          viewerIndex != null && galleryDocIds[viewerIndex]
            ? (() => {
                const docId = galleryDocIds[viewerIndex]!;
                const pieceIndex = kit.pieces.findIndex(
                  (p) => (p.photoDocumentId ?? p.photoDocument?.id) === docId,
                );
                const piece = pieceIndex >= 0 ? kit.pieces[pieceIndex] : null;
                return (
                  piece?.label ||
                  t('mobile.inventory.wipPieceN', {
                    n: pieceIndex >= 0 ? pieceIndex + 1 : viewerIndex + 1,
                  })
                );
              })()
            : undefined
        }
      />
    </BottomSheet>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  const { locale, isRTL } = useLocale();
  const { colors } = useTheme();
  return (
    <AppText
      variant="caption"
      weight={locale === 'ar' ? 'regular' : 'medium'}
      style={{
        letterSpacing: locale === 'ar' ? 0 : 0.8,
        textTransform: locale === 'ar' ? 'none' : 'uppercase',
        fontSize: 11,
        lineHeight: 14,
        color: colors.brand,
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      {label}
    </AppText>
  );
}

function FactRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name={icon} size={15} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText variant="bodySecondary" weight="medium" numberOfLines={2}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

function PieceThumb({ uri }: { uri?: string | null }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: 44, height: 44 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name="image-outline" size={18} color={colors.textMuted} />
      )}
    </View>
  );
}
