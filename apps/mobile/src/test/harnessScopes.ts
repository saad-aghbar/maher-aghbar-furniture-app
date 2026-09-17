/**
 * Directories included in the accessibility-label sweep.
 * Grow this list as each phase lands so we never start with a 291-file bulk failure.
 */
export const ACCESSIBILITY_SWEEP_DIRS = [
  'src/components/sheets',
  'src/test',
  'src/features/reports',
  'src/features/catalog/components/SpecOptionPickerSheet.tsx',
  'src/features/catalog/components/SpecOptionChips.tsx',
  'src/features/catalog/AdminVariantDetailScreen.tsx',
  'src/features/catalog/components/CreateVariantSheet.tsx',
  'src/features/catalog/components/VariantOptionGroupsBoard.tsx',
  'src/features/users/components/CreateUserSheet.tsx',
  'src/features/users/components/EditUserSheet.tsx',
  'src/features/users/components/userSheetForm.tsx',
  'src/features/requests/components/OrderBasketBoard.tsx',
  'src/features/requests/components/OrderBasketItemRail.tsx',
  'src/features/requests/components/OrderBasketLineCard.tsx',
  'src/features/requests/OrderBasketScreen.tsx',
  'src/features/requests/components/OrderLineSpecSheet.tsx',
  'src/features/catalog/components/DealerAddSpecSheet.tsx',
  'src/features/catalog/components/DealerMeasurementsBoard.tsx',
  'src/features/catalog/DealerCustomItemScreen.tsx',
  'src/features/catalog/components/DealerCustomPhotosBoard.tsx',
  'src/features/requests/components/NamedPickerSheet.tsx',
  'src/features/requests/FabricSelectionsEditor.tsx',
  'src/features/requests/ScanReviewScreen.tsx',
  'src/features/requests/components/CropPreviewSheet.tsx',
  'src/features/requests/components/SpecCorrectSheet.tsx',
  'src/features/sales-orders/components/CatalogPromotionBoard.tsx',
  'src/adaptive',
  'src/navigation/AdaptiveShell.tsx',
  'src/navigation/AdminSideNav.tsx',
] as const;

/** Window metrics used by the sheet geometry harness (iPhone 14). */
export const HARNESS_WINDOW = {
  width: 390,
  height: 844,
  scale: 3,
  fontScale: 1,
} as const;

export const HARNESS_SAFE_AREA = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
} as const;
