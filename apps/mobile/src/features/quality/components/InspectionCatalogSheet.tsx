import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { productionInsetStyle } from '@/features/production/productionFloorStyle';
import { ImageCarousel } from '@/features/sales-orders/components/ImageCarousel';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { selectProductDetail } from '@/features/catalog/selectProductDetail';
import { useBrowseProductQuery } from '@/features/catalog/query';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  productId: string | null;
};

export function InspectionCatalogSheet({ open, onClose, productId }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const query = useBrowseProductQuery(productId ?? undefined, open && Boolean(productId));
  const vm = query.data ? selectProductDetail(query.data, locale) : null;
  const uris = (vm?.imageUris ?? []).map((uri) => resolveOrderMediaUri(uri)).filter(Boolean) as string[];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.quality.catalogProductTitle')}
      overlay
      expandable
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
      >
        {query.isLoading ? (
          <AppText variant="caption" color="muted">
            {t('mobile.quality.loadingCatalog')}
          </AppText>
        ) : !vm ? (
          <AppText variant="body" color="muted">
            {t('mobile.quality.specEmpty')}
          </AppText>
        ) : (
          <>
            {uris.length ? <ImageCarousel uris={uris} height={180} /> : null}
            <DealerBoard title={vm.name} titleWeight={titleWeight}>
              <View style={{ ...productionInsetStyle(theme, colors), gap: theme.spacing.sm }}>
                {vm.sku ? (
                  <SpecRow label={t('mobile.productDetail.sku')} value={vm.sku} numeric />
                ) : null}
                {vm.categoryName ? (
                  <SpecRow label={t('mobile.productDetail.category')} value={vm.categoryName} />
                ) : null}
                {vm.dimensionSummary ? (
                  <SpecRow
                    label={t('mobile.productDetail.dimensions')}
                    value={vm.dimensionSummary}
                    numeric
                  />
                ) : null}
                {vm.dimensions.map((dim) => (
                  <SpecRow key={`${dim.kind}-${dim.label}`} label={dim.label} value={dim.value} numeric />
                ))}
                {vm.description ? (
                  <AppText
                    variant="body"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {vm.description}
                  </AppText>
                ) : null}
              </View>
            </DealerBoard>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function SpecRow({
  label,
  value,
  numeric,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{ flexShrink: 0, maxWidth: '42%', textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText
        variant="body"
        weight={titleWeight}
        dir={numeric ? 'ltr' : undefined}
        style={{ flex: 1, textAlign: isRTL ? 'left' : 'right' }}
      >
        {value}
      </AppText>
    </View>
  );
}
