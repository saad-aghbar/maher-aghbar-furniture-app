import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { ProductThumb } from '@/components/desk';
import { queryKeys } from '@/api/queryKeys';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { fetchWipKitBoard, type WipKitCard } from '@/api/modules/inventory';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  productionBoardShadow,
  productionSectionLabelStyle,
} from '../productionFloorStyle';

type Props = {
  productionOrderId: string;
  enabled: boolean;
  onInspectKit?: (kit: WipKitCard) => void;
};

function localizedStage(
  section: { stageNameEn: string; stageNameAr: string; stageNameHe: string | null },
  locale: string,
): string {
  if (locale === 'ar') return section.stageNameAr || section.stageNameEn;
  if (locale === 'he') return section.stageNameHe || section.stageNameEn;
  return section.stageNameEn;
}

function productName(kit: WipKitCard, locale: string): string {
  const p = kit.productionOrder.product;
  if (!p) return kit.productionOrder.productDescription;
  if (locale === 'ar') return p.nameAr || p.nameEn;
  if (locale === 'he') return p.nameHe || p.nameEn;
  return p.nameEn || p.nameAr;
}

function KitMedia({ kit }: { kit: WipKitCard }) {
  const productUri = resolveOrderMediaUri(kit.productionOrder.product?.imageUrl);
  const photoDocId =
    kit.pieces.find((p) => p.photoDocumentId)?.photoDocumentId ??
    kit.pieces.find((p) => p.photoDocument?.id)?.photoDocument?.id ??
    null;
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoDocId) {
      setPhotoUri(null);
      return;
    }
    void resolveDocumentUrl(photoDocId)
      .then((url) => {
        if (!cancelled) setPhotoUri(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [photoDocId]);

  return <ProductThumb uri={photoUri || productUri} size={88} radius={14} />;
}

function MetaChip({
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

/**
 * Order-scoped WIP kits for the production hub — photo cards + inspect sheet.
 */
export function ProductionWipSection({
  productionOrderId,
  enabled,
  onInspectKit,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const boardQuery = useQuery({
    queryKey: queryKeys.inventory.wipKitBoard({ productionOrderId }),
    queryFn: () => fetchWipKitBoard({ productionOrderId }),
    enabled: enabled && Boolean(productionOrderId),
    staleTime: 15_000,
  });

  const sections = boardQuery.data?.sections ?? [];
  const totalKits = boardQuery.data?.totalKits ?? 0;
  const flatKits = sections.flatMap((s) =>
    s.kits.map((kit) => ({ kit, stageLabel: localizedStage(s, locale) })),
  );

  return (
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
      <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.55 }} />
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.borderMuted,
            }}
          >
            <Ionicons name="cube-outline" size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={productionSectionLabelStyle(locale, colors.brand)}
            >
              {t('mobile.production.hubWipEyebrow')}
            </AppText>
            <AppText variant="heading" weight={titleWeight}>
              {t('mobile.production.wipTitle')}
            </AppText>
          </View>
          {totalKits > 0 ? (
            <View
              style={{
                minWidth: 32,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 6,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandSoft,
                alignItems: 'center',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
              >
                {totalKits}
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText variant="caption" color="muted">
          {t('mobile.production.wipHint')}
        </AppText>

        {boardQuery.isLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : boardQuery.isError ? (
          <AppText variant="caption" color="error">
            {t('mobile.production.wipError')}
          </AppText>
        ) : flatKits.length === 0 ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            }}
          >
            <AppText variant="body" weight="medium">
              {t('mobile.production.wipEmptyTitle')}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('mobile.production.wipEmptyBody')}
            </AppText>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {flatKits.map(({ kit, stageLabel }) => {
              const name = productName(kit, locale);
              const bin = kit.location?.name?.trim() || kit.location?.code || null;
              const accent =
                kit.status === 'CLAIMED'
                  ? colors.warning
                  : kit.status === 'READY'
                    ? colors.info
                    : colors.brand;
              const chevron = isRTL ? 'chevron-back' : 'chevron-forward';

              return (
                <AnimatedPressable
                  key={kit.id}
                  variant="card"
                  accessibilityRole="button"
                  accessibilityLabel={`${name} ${kit.qrCode}`}
                  onPress={() => {
                    void haptics.selection();
                    onInspectKit?.(kit);
                  }}
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surfaceElevated,
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                    overflow: 'hidden',
                    ...theme.elevation.rest,
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
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      gap: theme.spacing.md,
                      alignItems: 'center',
                      ...(isRTL ? { paddingRight: 4 } : { paddingLeft: 4 }),
                    }}
                  >
                    <KitMedia kit={kit} />
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: theme.spacing.sm,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="caption" weight="semibold" style={{ color: accent }}>
                            {stageLabel}
                          </AppText>
                          <AppText variant="label" weight={titleWeight} numberOfLines={2}>
                            {name}
                          </AppText>
                        </View>
                        <StatusBadge status={kit.status} />
                      </View>

                      <AppText variant="caption" color="muted" numberOfLines={1} dir="ltr">
                        {kit.qrCode}
                      </AppText>

                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          flexWrap: 'wrap',
                          gap: theme.spacing.xs,
                        }}
                      >
                        <MetaChip
                          icon="layers-outline"
                          label={`${kit.pieces.length}/${kit.expectedPieceCount}`}
                        />
                        <MetaChip
                          icon="location-outline"
                          label={bin ?? t('mobile.production.wipNoBin')}
                        />
                        {kit.claimedByUser ? (
                          <MetaChip
                            icon="person-outline"
                            label={`${kit.claimedByUser.firstName} ${kit.claimedByUser.lastName}`.trim()}
                          />
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name={chevron} size={18} color={colors.textMuted} />
                  </View>

                  <AppText variant="caption" color="brand" style={{ ...(isRTL ? { paddingRight: 4 } : { paddingLeft: 4 }) }}>
                    {t('mobile.production.wipTapForDetails')}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
