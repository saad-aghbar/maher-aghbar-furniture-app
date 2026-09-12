/** Spread onto RFQ / quote / SO / PO creates so piece UAT rows follow the variant. */

export type VariantAttachProduct = {
  id?: string;
  defaultVariantId?: string;
  defaultVariantSku?: string;
  defaultVariantLabel?: string;
  factoryNotesAr?: string | null;
  factoryNotesEn?: string | null;
  factoryNotesHe?: string | null;
};

export function variantLineFields(product: VariantAttachProduct) {
  if (!product.defaultVariantId) return {};
  return {
    variantId: product.defaultVariantId,
    variantSku: product.defaultVariantSku ?? null,
    variantLabel: product.defaultVariantLabel ?? null,
  };
}

export function variantPoFields(product: VariantAttachProduct) {
  return {
    ...variantLineFields(product),
    instructionsAr: product.factoryNotesAr ?? null,
    instructionsEn: product.factoryNotesEn ?? null,
    instructionsHe: product.factoryNotesHe ?? null,
  };
}

export function variantIdFields(product: VariantAttachProduct) {
  if (!product.defaultVariantId) return {};
  return { variantId: product.defaultVariantId };
}

export function variantIdFieldsForProductId(
  products: VariantAttachProduct[],
  productId?: string | null,
) {
  if (!productId) return {};
  const product = products.find((p) => p.id === productId);
  return product ? variantIdFields(product) : {};
}

export function variantLineFieldsForProductId(
  products: VariantAttachProduct[],
  productId?: string | null,
) {
  if (!productId) return {};
  const product = products.find((p) => p.id === productId);
  return product ? variantLineFields(product) : {};
}

export function variantPoFieldsForProductId(
  products: VariantAttachProduct[],
  productId?: string | null,
) {
  if (!productId) return {};
  const product = products.find((p) => p.id === productId);
  return product ? variantPoFields(product) : {};
}
