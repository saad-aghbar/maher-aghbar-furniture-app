import { localizedName } from '@maher/i18n';
import type { AdminProductVariant } from '@/api/modules/catalogAdmin';
import { specLibraryCode } from '@/features/catalog/selectSpecOptions';
import {
  DEALER_NAMED_SPEC_GROUP,
  emptyOrderLine,
  isNamedDealerSpec,
  type NewOrderLine,
  type NewOrderLineOption,
} from './newOrderLine';
import { seedDimensionsFromVariant } from './newOrderMeasurements';

export type SeedModifiedLineInput = {
  productId: string;
  productName: string;
  quantity: string;
  variant: Pick<
    AdminProductVariant,
    | 'id'
    | 'sku'
    | 'code'
    | 'nameAr'
    | 'nameEn'
    | 'nameHe'
    | 'width'
    | 'height'
    | 'depth'
    | 'seatHeight'
    | 'measurements'
    | 'options'
  >;
  locale: string;
  imageUrl?: string;
  dealerPrice?: string;
};

function optionFromVariant(
  row: NonNullable<AdminProductVariant['options']>[number],
): NewOrderLineOption | null {
  const specOptionValueId = String(row.specOptionValueId ?? row.specOptionValue?.id ?? '').trim();
  if (!specOptionValueId) return null;
  const group = row.specOptionValue?.group;
  return {
    specOptionValueId,
    groupId: row.specOptionValue?.groupId ?? group?.id,
    groupCode: group?.code,
    code: row.specOptionValue?.code,
    nameEn: row.specOptionValue?.nameEn,
    nameAr: row.specOptionValue?.nameAr,
    qty: row.qty != null && Number.isFinite(Number(row.qty)) ? Number(row.qty) : undefined,
    note: row.note ?? undefined,
  };
}

/**
 * True when the dealer changed specs, core dims, or measurements vs the catalog variant.
 * Quantity, fabric, photos, and notes stay commercial and do not flip MODIFIED.
 */
export function catalogLineWasModified(line: NewOrderLine, catalog: NewOrderLine): boolean {
  const norm = (value: string) => String(value ?? '').trim();
  if (norm(line.dimWidth) !== norm(catalog.dimWidth)) return true;
  if (norm(line.dimHeight) !== norm(catalog.dimHeight)) return true;
  if (norm(line.dimDepth) !== norm(catalog.dimDepth)) return true;
  if (norm(line.dimSeat) !== norm(catalog.dimSeat)) return true;
  if (norm(line.woodType) !== norm(catalog.woodType)) return true;
  if (norm(line.woodColor) !== norm(catalog.woodColor)) return true;
  if (norm(line.foamDensity) !== norm(catalog.foamDensity)) return true;
  if (norm(line.finish) !== norm(catalog.finish)) return true;
  if (norm(line.accessories) !== norm(catalog.accessories)) return true;
  if (norm(line.orientation) !== norm(catalog.orientation)) return true;

  const measurements = (rows: NewOrderLine['customMeasurements']) =>
    [...rows]
      .map((row) => `${norm(row.label).toLowerCase()}|${norm(row.value)}|${norm(row.unit ?? '')}`)
      .sort()
      .join(';');
  if (measurements(line.customMeasurements) !== measurements(catalog.customMeasurements)) return true;

  const options = (rows: NewOrderLine['options']) =>
    [...rows]
      .map((opt) =>
        isNamedDealerSpec(opt)
          ? `named:${norm(opt.code ?? '')}|${norm(opt.nameEn ?? '')}|${norm(opt.note ?? '')}`
          : `lib:${norm(opt.specOptionValueId)}`,
      )
      .sort()
      .join(';');
  return options(line.options) !== options(catalog.options);
}

/** Catalog product + named variant with that variant’s specs and measurements. */
export function seedModifiedLineFromVariant(input: SeedModifiedLineInput): NewOrderLine {
  const dims = seedDimensionsFromVariant(input.variant, input.locale);
  const label =
    localizedName(input.locale, input.variant) || input.variant.code || input.variant.sku;
  const options = (input.variant.options ?? [])
    .map(optionFromVariant)
    .filter((row): row is NewOrderLineOption => Boolean(row));
  return emptyOrderLine({
    productId: input.productId,
    customProductName: input.productName,
    quantity: input.quantity || '1',
    variantId: input.variant.id,
    variantSku: input.variant.sku ?? '',
    variantLabel: label,
    dimWidth: dims.width,
    dimHeight: dims.height,
    dimDepth: dims.depth,
    dimSeat: dims.seat,
    customMeasurements: dims.custom,
    options,
    imageUrl: input.imageUrl ?? '',
    dealerPrice: input.dealerPrice ?? '',
  });
}

export function addNamedSpecToLine(
  line: NewOrderLine,
  label: string,
  value: string,
  replaceCode?: string,
): NewOrderLine {
  const name = label.trim();
  const nextValue = value.trim();
  if (!name || !nextValue) return line;
  const code = specLibraryCode(name, 'DEALER');
  const options = line.options.filter((opt) => {
    if (replaceCode && isNamedDealerSpec(opt) && opt.code === replaceCode) return false;
    if (isNamedDealerSpec(opt) && opt.code === code) return false;
    return true;
  });
  options.push({
    specOptionValueId: '',
    groupCode: DEALER_NAMED_SPEC_GROUP,
    code,
    nameEn: name,
    nameAr: name,
    note: nextValue,
  });
  return { ...line, options };
}

export function removeNamedSpecFromLine(line: NewOrderLine, code: string): NewOrderLine {
  return {
    ...line,
    options: line.options.filter((opt) => !(isNamedDealerSpec(opt) && opt.code === code)),
  };
}
