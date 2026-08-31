import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import type { WipKitCard } from '@/api/modules/inventory';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { ImageCarousel } from '@/features/sales-orders/components/ImageCarousel';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { productionBoardShadow } from '../productionFloorStyle';

type Props = {
  open: boolean;
  kit: WipKitCard | null;
  onClose: () => void;
};

function productName(kit: WipKitCard, locale: string): string {
  const p = kit.productionOrder.product;
  if (!p) return kit.productionOrder.productDescription;
  if (locale === 'ar') return p.nameAr || p.nameEn;
  if (locale === 'he') return p.nameHe || p.nameEn;
  return p.nameEn || p.nameAr;
}

function stageName(kit: WipKitCard, locale: string): string {
  const s = kit.stageInstance.stageDefinition;
  if (locale === 'ar') return s.nameAr || s.nameEn;
  if (locale === 'he') return s.nameHe || s.nameEn;
  return s.nameEn;
}

function kitAccent(
  status: string,
  colors: { warning: string; success: string; brand: string },
): string {
  if (status === 'CLAIMED') return colors.warning;
  if (status === 'READY') return colors.success;
  if (status === 'CONSUMED') return colors.success;
  return colors.brand;
}

function FactRow({
  icon,
  label,
  value,
  ltr,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  ltr?: boolean;
  last?: boolean;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.borderMuted,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSoft,
          borderWidth: 1,
          borderColor: colors.borderMuted,
        }}
      >
        <Ionicons name={icon} size={15} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText
          variant="body"
          weight="medium"
          numberOfLines={3}
          dir={ltr ? 'ltr' : 'auto'}
          style={{ width: '100%' }}
        >
          {value}
        </AppText>
      </View>
    </View>
  );
}

function PieceThumb({ uri }: { uri: string | null }) {
  return <ProductThumb uri={uri} size={48} radius={12} />;
}

/**
 * Production hub WIP kit inspect sheet — hero media, custody facts, optional QR.
 */
export function ProductionWipKitSheet({ open, kit, onClose }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const [showQr, setShowQr] = useState(false);
  const [photoByDocId, setPhotoByDocId] = useState<Record<string, string>>({});

  const photoIds = useMemo(
    () =>
      (kit?.pieces ?? [])
        .map((p) => p.photoDocumentId ?? p.photoDocument?.id ?? null)
        .filter((id): id is string => Boolean(id)),
    [kit?.pieces],
  );

  useEffect(() => {
    if (!open) setShowQr(false);
  }, [open]);

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

  if (!kit) {
    return (
      <BottomSheet open={false} onClose={onClose} title="">
        <View />
      </BottomSheet>
    );
  }

  const name = productName(kit, locale);
  const stage = stageName(kit, locale);
  const productUri = resolveOrderMediaUri(kit.productionOrder.product?.imageUrl);
  const photoUris = photoIds
    .map((id) => photoByDocId[id])
    .filter((u): u is string => Boolean(u));
  const heroUris = photoUris.length > 0 ? photoUris : productUri ? [productUri] : [];
  const accent = kitAccent(kit.status, colors);
  const bin = kit.location?.name?.trim() || kit.location?.code || null;
  const warehouse = kit.warehouse
    ? localizedName(locale, kit.warehouse, kit.warehouse.code)
    : null;
  const claimed = kit.claimedByUser
    ? `${kit.claimedByUser.firstName} ${kit.claimedByUser.lastName}`.trim()
    : null;
  const producer = kit.producingTask?.assignedEmployee
    ? `${kit.producingTask.assignedEmployee.firstName} ${kit.producingTask.assignedEmployee.lastName}`.trim()
    : null;
  const piecesLabel = `${kit.pieces.length}/${kit.expectedPieceCount}`;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const materials = kit.producingTask?.materialUsages ?? [];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={showQr ? t('mobile.production.wipKitQrTitle') : t('mobile.production.wipKitDetailTitle')}
      fitContent
      maxHeight={680}
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
      >
        {showQr ? (
          <View style={{ gap: theme.spacing.md, alignItems: 'center' }}>
            <View
              style={{
                width: '100%',
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                ...productionBoardShadow(colorScheme),
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: accent,
                  opacity: 0.9,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
              <View
                style={{
                  padding: theme.spacing.lg,
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.lg + 4 }
                    : { paddingLeft: theme.spacing.lg + 4 }),
                }}
              >
                <View
                  style={{
                    padding: theme.spacing.lg,
                    borderRadius: theme.radius.xl,
                    backgroundColor: colors.surfaceElevated,
                    borderWidth: 1,
                    borderColor: colors.borderMuted,
                  }}
                >
                  <QRCode
                    value={kit.qrCode}
                    size={208}
                    backgroundColor={colors.surfaceElevated}
                    color={colors.textPrimary}
                  />
                </View>
                <View style={{ gap: 4, alignItems: 'center', paddingHorizontal: theme.spacing.sm }}>
                  <AppText variant="body" weight={titleWeight} align="center" numberOfLines={2}>
                    {name}
                  </AppText>
                  <AppText variant="caption" color="muted" dir="ltr" align="center">
                    {kit.qrCode}
                  </AppText>
                  <AppText variant="caption" weight="semibold" style={{ color: accent }}>
                    {stage}
                  </AppText>
                </View>
              </View>
            </View>
            <SecondaryButton
              label={t('mobile.production.wipKitHideQr')}
              onPress={() => {
                void haptics.selection();
                setShowQr(false);
              }}
              style={{ borderRadius: theme.radius.full, minHeight: theme.sizes.touch.min }}
            />
          </View>
        ) : (
          <>
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                ...productionBoardShadow(colorScheme),
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
                  opacity: 0.9,
                  zIndex: 2,
                }}
              />

              {heroUris.length > 0 ? (
                <View style={{ backgroundColor: colors.surfaceSecondary }}>
                  {heroUris.length === 1 ? (
                    <ProductThumb uri={heroUris[0]} aspectRatio={16 / 10} radius={0} />
                  ) : (
                    <ImageCarousel uris={heroUris} height={200} />
                  )}
                </View>
              ) : (
                <View
                  style={{
                    height: 140,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <Ionicons name="cube-outline" size={40} color={colors.brand} />
                </View>
              )}

              <View
                style={{
                  gap: theme.spacing.sm,
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
                      style={{ color: accent, letterSpacing: locale === 'ar' ? 0 : 0.6 }}
                    >
                      {stage}
                    </AppText>
                    <AppText variant="title" weight={titleWeight} numberOfLines={2}>
                      {name}
                    </AppText>
                    <AppText variant="caption" color="muted" dir="ltr">
                      {kit.productionOrder.number}
                      {kit.productionOrder.product?.sku
                        ? ` · ${kit.productionOrder.product.sku}`
                        : ''}
                    </AppText>
                  </View>
                  <StatusBadge status={kit.status} />
                </View>

                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.xs,
                  }}
                >
                  <QuickChip
                    icon="layers-outline"
                    label={piecesLabel}
                  />
                  <QuickChip
                    icon="location-outline"
                    label={bin ?? t('mobile.production.wipNoBin')}
                  />
                  {claimed ? (
                    <QuickChip icon="person-outline" label={claimed} />
                  ) : null}
                </View>
              </View>
            </View>

            <DealerBoard title={t('mobile.production.wipKitFacts')} titleWeight={titleWeight} contentStyle={{ padding: 0, gap: 0 }}>
              <View
                style={{
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                <FactRow
                  icon="barcode-outline"
                  label={t('mobile.production.wipKitCode')}
                  value={kit.qrCode}
                  ltr
                />
                <FactRow
                  icon="document-text-outline"
                  label={t('mobile.production.wipKitOrder')}
                  value={kit.productionOrder.number}
                  ltr
                />
                <FactRow
                  icon="construct-outline"
                  label={t('mobile.production.wipKitStage')}
                  value={stage}
                />
                <FactRow
                  icon="layers-outline"
                  label={t('mobile.production.wipKitPieces')}
                  value={piecesLabel}
                  ltr
                />
                <FactRow
                  icon="location-outline"
                  label={t('mobile.production.wipKitBin')}
                  value={bin ?? t('mobile.production.wipNoBin')}
                  last={!warehouse && !kit.custody && !claimed && !producer && !(kit.handoffCount && kit.handoffCount > 0)}
                />
                {warehouse ? (
                  <FactRow
                    icon="business-outline"
                    label={t('mobile.production.wipKitWarehouse')}
                    value={warehouse}
                    last={!kit.custody && !claimed && !producer && !(kit.handoffCount && kit.handoffCount > 0)}
                  />
                ) : null}
                {kit.custody ? (
                  <FactRow
                    icon="hand-left-outline"
                    label={t('mobile.production.wipKitCustody')}
                    value={kit.custody}
                    last={!claimed && !producer && !(kit.handoffCount && kit.handoffCount > 0)}
                  />
                ) : null}
                {claimed ? (
                  <FactRow
                    icon="person-outline"
                    label={t('mobile.production.wipKitClaimed')}
                    value={claimed}
                    last={!producer && !(kit.handoffCount && kit.handoffCount > 0)}
                  />
                ) : null}
                {producer ? (
                  <FactRow
                    icon="hammer-outline"
                    label={t('mobile.production.wipKitProducer')}
                    value={producer}
                    last={!(kit.handoffCount && kit.handoffCount > 0)}
                  />
                ) : null}
                {typeof kit.handoffCount === 'number' && kit.handoffCount > 0 ? (
                  <FactRow
                    icon="swap-horizontal-outline"
                    label={t('mobile.production.wipKitHandoffs')}
                    value={String(kit.handoffCount)}
                    ltr
                    last
                  />
                ) : null}
              </View>
            </DealerBoard>

            {kit.pieces.length > 0 ? (
              <DealerBoard title={t('mobile.production.wipKitPiecesList')} titleWeight={titleWeight} contentStyle={{ padding: 0, gap: 0 }}>
                <View
                  style={{
                    overflow: 'hidden',
                  }}
                >
                  {kit.pieces.map((piece, i) => {
                    const docId = piece.photoDocumentId ?? piece.photoDocument?.id ?? null;
                    const pieceUri = docId ? photoByDocId[docId] ?? null : null;
                    const pieceLabel =
                      piece.label?.trim() ||
                      t('mobile.production.wipKitPieceN', { n: i + 1 });
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
                          <AppText variant="bodySecondary" weight="medium" numberOfLines={1}>
                            {pieceLabel}
                          </AppText>
                          {piece.qrCode ? (
                            <AppText variant="caption" color="muted" dir="ltr" numberOfLines={1}>
                              {piece.qrCode}
                            </AppText>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </DealerBoard>
            ) : null}

            {materials.length > 0 || kit.materialOverageNotes ? (
              <DealerBoard title={t('mobile.production.wipKitMaterials')} titleWeight={titleWeight} contentStyle={{ padding: 0, gap: 0 }}>
                <View
                  style={{
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
                          {m.isExtra ? ` · ${t('mobile.production.wipKitMaterialExtra')}` : ''}
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
              </DealerBoard>
            ) : null}

            <PrimaryButton
              label={t('mobile.production.wipKitShowQr')}
              onPress={() => {
                void haptics.selection();
                setShowQr(true);
              }}
              leading={<Ionicons name="qr-code-outline" size={18} color={colors.onBrand} />}
              style={{ borderRadius: theme.radius.full, minHeight: theme.sizes.touch.min }}
            />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function QuickChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 5,
        borderRadius: theme.radius.md,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        maxWidth: '100%',
      }}
    >
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <AppText variant="caption" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </AppText>
    </View>
  );
}
