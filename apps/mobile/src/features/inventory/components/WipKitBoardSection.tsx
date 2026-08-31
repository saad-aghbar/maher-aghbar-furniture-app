import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppText } from '@/components/AppText';
import { useToast, toastCopy } from '@/components/feedback/Toast';
import { useLocale } from '@/i18n';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  fetchWipKitBoard,
  openWipKitQrLabelPdf,
  openWipPieceQrLabelPdf,
  type WipKitCard,
} from '@/api/modules/inventory';
import { queryKeys } from '@/api/queryKeys';
import { InventoryQrSheet, type InventoryQrItem } from './InventoryQrSheet';
import { StatusBadge } from '@/components/badges/StatusBadge';

function localizedProduct(kit: WipKitCard, locale: string): string {
  const p = kit.productionOrder.product;
  if (!p) return kit.productionOrder.productDescription;
  if (locale === 'ar') return p.nameAr || p.nameEn;
  if (locale === 'he') return p.nameHe || p.nameEn;
  return p.nameEn || p.nameAr;
}

function localizedStage(
  section: { stageNameEn: string; stageNameAr: string; stageNameHe: string | null },
  locale: string,
): string {
  if (locale === 'ar') return section.stageNameAr || section.stageNameEn;
  if (locale === 'he') return section.stageNameHe || section.stageNameEn;
  return section.stageNameEn;
}

type Props = {
  enabled: boolean;
};

/**
 * Floor board of order×stage WIP kits (QR claim cards) above the lots list.
 * Always visible on Semi-finished so the floor can see kits / empty state.
 */
export function WipKitBoardSection({ enabled }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const { showToast } = useToast();
  const { pickPdfOptions } = usePdfDownload();
  const [qrItem, setQrItem] = useState<InventoryQrItem | null>(null);
  const [pendingPrint, setPendingPrint] = useState<{
    kind: 'kit' | 'piece';
    id: string;
    code: string;
  } | null>(null);

  const boardQuery = useQuery({
    queryKey: queryKeys.inventory.wipKitBoard({}),
    queryFn: () => fetchWipKitBoard(),
    enabled,
  });

  const sections = boardQuery.data?.sections ?? [];
  const totalKits = boardQuery.data?.totalKits ?? 0;

  if (!enabled) return null;

  function openPrint(kind: 'kit' | 'piece', id: string, code: string) {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        if (kind === 'kit') await openWipKitQrLabelPdf(id, code, opts);
        else await openWipPieceQrLabelPdf(id, code, opts);
      } catch {
        void haptics.error();
        showToast({
          variant: 'error',
          message: toastCopy(
            t('mobile.inventory.wipLabelFailedTitle'),
            t('mobile.inventory.wipLabelFailedBody'),
          ),
        });
      }
    })();
  }

  return (
    <View
      style={{
        gap: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="label" weight="semibold" style={{ flex: 1 }}>
          {t('mobile.inventory.wipBoardTitle')}
        </AppText>
        {totalKits > 0 ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {totalKits}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" color="muted">
        {t('mobile.inventory.wipBoardHint')}
      </AppText>

      {boardQuery.isLoading ? (
        <ActivityIndicator color={colors.brand} />
      ) : boardQuery.isError ? (
        <AppText variant="caption" color="error">
          {t('mobile.inventory.wipBoardError')}
        </AppText>
      ) : sections.length === 0 ? (
        <AppText variant="bodySecondary" color="secondary">
          {t('mobile.inventory.wipBoardEmpty')}
        </AppText>
      ) : (
        sections.map((section) => (
          <View key={section.stageCode} style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" weight="semibold" color="brand">
              {localizedStage(section, locale)}
            </AppText>
            {section.kits.map((kit) => (
              <AnimatedPressable
                variant="card"
                key={kit.id}
                onPress={() => {
                  void haptics.selection();
                  setPendingPrint({ kind: 'kit', id: kit.id, code: kit.qrCode });
                  setQrItem({
                    id: kit.id,
                    sku: kit.qrCode,
                    name: localizedProduct(kit, locale),
                    scanCode: kit.qrCode,
                    category: 'SEMI_FINISHED',
                    unit: `${kit.pieces.length}/${kit.expectedPieceCount}`,
                    imageUrl: null,
                    itemClass: 'SEMI_FINISHED_GOOD',
                  });
                }}
                style={{
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  borderRadius: theme.radius.xl,
                  padding: theme.spacing.md,
                  backgroundColor: colors.surface,
                  gap: theme.spacing.xs,
                  overflow: 'hidden',
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText
                    variant="body"
                    weight={locale === 'ar' ? 'medium' : 'semibold'}
                    style={{ flex: 1 }}
                  >
                    {kit.productionOrder.number}
                  </AppText>
                  <StatusBadge status={kit.status} />
                </View>
                <AppText variant="caption" color="secondary" numberOfLines={2}>
                  {localizedProduct(kit, locale)}
                </AppText>
                <AppText variant="caption" color="muted" style={{ writingDirection: 'ltr' }}>
                  {kit.qrCode}
                  {kit.location
                    ? ` · ${kit.location.name?.trim() || kit.location.code}`
                    : ''}
                </AppText>
                <AppText variant="caption" color="brand">
                  {t('mobile.inventory.wipTapForQr')}
                </AppText>
                {kit.pieces.length > 1 ? (
                  <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
                    {kit.pieces.map((piece, i) => (
                      <AnimatedPressable
                        variant="button"
                        key={piece.id}
                        onPress={() => {
                          void haptics.selection();
                          const code = piece.qrCode || kit.qrCode;
                          setPendingPrint({ kind: 'piece', id: piece.id, code });
                          setQrItem({
                            id: piece.id,
                            sku: code,
                            name: piece.label || t('mobile.inventory.wipPieceN', { n: i + 1 }),
                            scanCode: code,
                            category: 'SEMI_FINISHED',
                            unit: kit.productionOrder.number,
                            imageUrl: null,
                            itemClass: 'SEMI_FINISHED_GOOD',
                          });
                        }}
                      >
                        <AppText
                          variant="caption"
                          color="brand"
                          style={{ writingDirection: 'ltr' }}
                        >
                          {piece.label || t('mobile.inventory.wipPieceN', { n: i + 1 })}
                          {piece.qrCode ? ` · ${piece.qrCode}` : ''}
                        </AppText>
                      </AnimatedPressable>
                    ))}
                  </View>
                ) : null}
              </AnimatedPressable>
            ))}
          </View>
        ))
      )}

      <InventoryQrSheet
        open={Boolean(qrItem)}
        item={qrItem}
        onClose={() => {
          setQrItem(null);
        }}
        onClosed={() => {
          const next = pendingPrint;
          setPendingPrint(null);
          if (next) openPrint(next.kind, next.id, next.code);
        }}
        onPrint={() => {
          setQrItem(null);
        }}
      />
    </View>
  );
}
