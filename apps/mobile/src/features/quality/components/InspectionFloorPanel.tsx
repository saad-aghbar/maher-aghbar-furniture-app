import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import type { OrderPlanDims, OrderPlanMeasurement } from '@/api/modules/production';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { TextField } from '@/components/forms/TextField';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { productionInsetStyle } from '@/features/production/productionFloorStyle';
import { CatalogModificationsBoard } from '@/features/sales-orders/components/CatalogModificationsBoard';
import { ImageCarousel } from '@/features/sales-orders/components/ImageCarousel';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { complexityBadgeKey } from '@/features/sales-orders/orderManufacturingKind';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type {
  InspectionDealerDetails,
  ItemUnderInspection,
  ManufacturingSpec,
} from '../api';
import {
  dealerDetailRows,
  localizedName,
  paperCustomNotes,
  splitCatalogHint,
  type InspectionOrderIdentity,
  type InspectionSpecRow,
} from '../inspectionChecklist';
import { InspectionCatalogSheet } from './InspectionCatalogSheet';

type Props = {
  itemUnderInspection: ItemUnderInspection | null;
  manufacturingSpec: ManufacturingSpec | null;
  dealerDetails?: InspectionDealerDetails | null;
  order?: InspectionOrderIdentity | null;
  productImageUrl?: string | null;
  productId?: string | null;
  notes: string;
  onNotesChange: (value: string) => void;
  onConfirm: () => void;
  onFail: () => void;
  busy?: boolean;
  disabled?: boolean;
};

function SpecMetaRow({
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
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          flexShrink: 0,
          maxWidth: '42%',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="body"
        weight={titleWeight}
        dir={numeric ? 'ltr' : undefined}
        style={{
          flex: 1,
          textAlign: isRTL ? 'left' : 'right',
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

function planDims(rec?: Record<string, unknown> | null): OrderPlanDims | null {
  if (!rec) return null;
  const pick = (key: string): number | null => {
    const raw = rec[key];
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return {
    width: pick('width'),
    height: pick('height'),
    depth: pick('depth'),
    seatHeight: pick('seatHeight'),
  };
}

function planMeasurements(spec: ManufacturingSpec | null): OrderPlanMeasurement[] {
  if (!Array.isArray(spec?.measurements)) return [];
  return spec.measurements.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.value,
    unit: row.unit,
    catalogValue: row.catalogValue,
  }));
}

export function InspectionFloorPanel({
  itemUnderInspection,
  manufacturingSpec,
  dealerDetails,
  order,
  productImageUrl,
  productId,
  notes,
  onNotesChange,
  onConfirm,
  onFail,
  busy,
  disabled,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [galleryW, setGalleryW] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const complexity = complexityBadgeKey(manufacturingSpec?.complexity);
  const canOpenCatalog = Boolean(productId) && complexity !== 'custom';

  const inspectingLabel = itemUnderInspection
    ? localizedName(locale, {
        nameEn: itemUnderInspection.stageNameEn,
        nameAr: itemUnderInspection.stageNameAr,
        nameHe: itemUnderInspection.stageNameHe,
      }) ?? itemUnderInspection.stageNameEn
    : t('mobile.quality.finishedGoods');
  const inspectingMeta = itemUnderInspection?.workerName
    ? t('mobile.quality.madeBy', { name: itemUnderInspection.workerName })
    : '';

  const dealerRows = dealerDetailRows(dealerDetails ?? {});
  if (manufacturingSpec?.foam && !dealerRows.some((row) => row.key === 'foam')) {
    const foamName = localizedName(locale, {
      nameEn: manufacturingSpec.foam.nameEn,
      nameAr: manufacturingSpec.foam.nameAr,
      nameHe: manufacturingSpec.foam.nameHe,
    });
    const foam = [foamName, manufacturingSpec.foam.sku].filter(Boolean).join(' · ');
    if (foam) dealerRows.push({ key: 'foam', labelKey: 'specFoam', value: foam });
  }
  if (manufacturingSpec?.fabric && !dealerRows.some((row) => row.key.startsWith('fabric'))) {
    const fabricName = localizedName(locale, {
      nameEn: manufacturingSpec.fabric.nameEn,
      nameAr: manufacturingSpec.fabric.nameAr,
      nameHe: manufacturingSpec.fabric.nameHe,
    });
    const fabric = [fabricName, manufacturingSpec.fabric.color, manufacturingSpec.fabric.sku]
      .filter(Boolean)
      .join(' · ');
    if (fabric) dealerRows.push({ key: 'fabric', labelKey: 'specFabricName', value: fabric });
  }

  const identityRows: InspectionSpecRow[] = [];
  if (order?.composition) {
    identityRows.push({ key: 'composition', labelKey: 'specComposition', value: order.composition });
  }
  if (order?.productionOrderNumber) {
    identityRows.push({
      key: 'po',
      labelKey: 'specPo',
      value: order.productionOrderNumber,
      numeric: true,
    });
  }
  if (order?.salesOrderNumber) {
    identityRows.push({
      key: 'so',
      labelKey: 'specSo',
      value: order.salesOrderNumber,
      numeric: true,
    });
  }
  const dealerName = localizedName(locale, {
    nameEn: order?.dealerName,
    nameAr: order?.dealerNameAr,
    nameHe: order?.dealerNameHe,
  });
  if (dealerName) identityRows.push({ key: 'dealer', labelKey: 'specDealer', value: dealerName });
  const specRows = [...identityRows, ...dealerRows];
  const customNotes = paperCustomNotes({
    factoryNotes: manufacturingSpec?.factoryNotes,
    lineNotes: dealerDetails?.lineNotes,
    dealerNotes: dealerDetails?.dealerNotes,
    description: dealerDetails?.description,
    lineSpec:
      typeof manufacturingSpec?.lineSpec === 'string' ? manufacturingSpec.lineSpec : null,
  });
  const productTitle =
    dealerDetails?.productName ||
    manufacturingSpec?.manufacturingName ||
    localizedName(locale, {
      nameEn: order?.productName,
      nameAr: order?.productNameAr,
      nameHe: order?.productNameHe,
    }) ||
    inspectingLabel;

  const resolvedProduct = resolveOrderMediaUri(productImageUrl);
  const docIds = dealerDetails?.photoDocumentIds ?? [];
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fromUrls = (dealerDetails?.imageUrls ?? [])
        .map((url) => resolveOrderMediaUri(url))
        .filter((uri): uri is string => Boolean(uri));
      const fromDocs: string[] = [];
      for (const id of docIds) {
        try {
          fromDocs.push(await resolveDocumentUrl(id));
        } catch {
          /* skip */
        }
      }
      const seen = new Set<string>();
      const next = [...fromUrls, ...fromDocs, resolvedProduct].filter((uri): uri is string => {
        if (!uri || seen.has(uri)) return false;
        seen.add(uri);
        return true;
      });
      if (!cancelled) setPhotoUris(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [dealerDetails?.imageUrls, docIds.join('|'), resolvedProduct]);

  const rowLabel = (row: InspectionSpecRow) => {
    if (row.label) return row.label;
    if (row.absLabelKey) return t(row.absLabelKey);
    if (row.labelKey) return t(`mobile.quality.${row.labelKey}`);
    return row.key;
  };
  const rowValue = (row: InspectionSpecRow) => {
    if (row.numeric) {
      const split = splitCatalogHint(row.value);
      if (split.catalog) {
        return t('mobile.quality.specWithCatalog', {
          value: split.value,
          catalog: split.catalog,
        });
      }
    }
    return row.value;
  };

  const headerRow = (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.md,
        alignItems: 'center',
      }}
    >
      <ProductThumb uri={photoUris[0] ?? resolvedProduct} size={72} radius={theme.radius.lg} />
      <View style={{ flex: 1, gap: 4 }}>
        <AppText
          variant="title"
          weight={titleWeight}
          style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 18, lineHeight: 24 }}
        >
          {productTitle}
        </AppText>
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.quality.lastFinishedStage', { stage: inspectingLabel })}
          {inspectingMeta ? ` · ${inspectingMeta}` : ''}
        </AppText>
        {canOpenCatalog ? (
          <AppText variant="caption" color="brand" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.quality.openCatalogDetails')}
          </AppText>
        ) : null}
      </View>
      {canOpenCatalog ? (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.brand}
        />
      ) : null}
    </View>
  );

  const identityBody = (
    <View style={{ gap: theme.spacing.md }}>
      {canOpenCatalog ? (
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.quality.openCatalogDetails')}
          onPress={() => {
            void haptics.selection();
            setCatalogOpen(true);
          }}
        >
          {headerRow}
        </AnimatedPressable>
      ) : (
        headerRow
      )}

      {photoUris.length ? (
        <View onLayout={(e) => setGalleryW(e.nativeEvent.layout.width)}>
          {galleryW > 0 ? (
            <ImageCarousel uris={photoUris} height={200} itemWidth={galleryW} />
          ) : null}
        </View>
      ) : null}

      <View style={{ ...productionInsetStyle(theme, colors) }}>
        {specRows.length ? (
          specRows.map((row) => (
            <SpecMetaRow
              key={row.key}
              label={rowLabel(row)}
              value={rowValue(row)}
              numeric={row.numeric}
            />
          ))
        ) : (
          <AppText variant="body" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.quality.specEmpty')}
          </AppText>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ gap: theme.spacing.md }}>
      <DealerBoard
        title={t('mobile.quality.inspectAgainst')}
        titleWeight={titleWeight}
        accentColor={complexity === 'standard' ? colors.brand : colors.warning}
      >
        {identityBody}
      </DealerBoard>

      {complexity === 'modified' ? (
        <CatalogModificationsBoard
          catalogDimensions={planDims(manufacturingSpec?.catalogDimensions ?? null)}
          orderDimensions={planDims(manufacturingSpec?.orderDimensions ?? null)}
          measurements={planMeasurements(manufacturingSpec)}
          changesFromCatalog={manufacturingSpec?.changesFromCatalog ?? []}
        />
      ) : null}

      {customNotes.length ? (
        <DealerBoard
          title={t('mobile.quality.customNotes')}
          titleWeight={titleWeight}
          accentColor={colors.warning}
        >
          <View style={{ ...productionInsetStyle(theme, colors), gap: theme.spacing.sm }}>
            {customNotes.map((note) => (
              <AppText
                key={note}
                variant="body"
                weight={titleWeight}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {note}
              </AppText>
            ))}
          </View>
        </DealerBoard>
      ) : null}

      <TextField
        label={t('mobile.quality.notes')}
        value={notes}
        onChangeText={onNotesChange}
        multiline
        numberOfLines={3}
        placeholder={t('mobile.quality.notesPlaceholder')}
        editable={!disabled && !busy}
      />

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        disabled={disabled || busy}
        onPress={() => {
          void haptics.confirmMedium();
          onConfirm();
        }}
        style={{
          minHeight: theme.sizes.touch.min + 8,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.success,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || busy ? 0.55 : 1,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <AppText variant="label" weight="semibold" style={{ color: colors.onBrand, fontSize: 16 }}>
          {t('mobile.quality.passInspection')}
        </AppText>
      </AnimatedPressable>

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        disabled={disabled || busy}
        onPress={() => {
          void haptics.selection();
          onFail();
        }}
        style={{
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.error,
          backgroundColor: colors.errorSoft,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || busy ? 0.55 : 1,
        }}
      >
        <AppText variant="label" weight="semibold" style={{ color: colors.error }}>
          {t('mobile.quality.failInspection')}
        </AppText>
      </AnimatedPressable>

      <InspectionCatalogSheet
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        productId={productId ?? null}
      />
    </View>
  );
}
