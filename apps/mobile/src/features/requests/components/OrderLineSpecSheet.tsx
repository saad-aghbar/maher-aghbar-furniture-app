import { ScrollView, useWindowDimensions, View } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { SpecOptionGroup, SpecOptionValue } from '@/api/modules/catalog';
import type { AdminProductVariant } from '@/api/modules/catalogAdmin';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { VariantOptionGroupsBoard } from '@/features/catalog/components/VariantOptionGroupsBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { applyOptionToLine, type NewOrderLine } from '../newOrderLine';
import { NamedPickerSheet } from './NamedPickerSheet';
import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  line: NewOrderLine | null;
  onChange: (next: NewOrderLine) => void;
  variants: AdminProductVariant[];
  groups: SpecOptionGroup[];
  values: SpecOptionValue[];
  /** When set, the footer confirms instead of only closing (PDP customize). */
  confirmLabel?: string;
  onConfirm?: () => void;
};

export function OrderLineSpecSheet({
  open,
  onClose,
  line,
  onChange,
  variants,
  groups,
  values,
  confirmLabel,
  onConfirm,
}: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const [variantOpen, setVariantOpen] = useState(false);
  const sheetHeight = Math.min(Math.round(height * 0.7), 640);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  useEffect(() => {
    if (!open) setVariantOpen(false);
  }, [open]);

  if (!line) return null;

  const selectedByGroup: Record<string, string | null> = {};
  for (const opt of line.options) {
    if (opt.groupId) selectedByGroup[opt.groupId] = opt.specOptionValueId;
  }

  const variantRows = variants
    .filter((row) => row.isActive)
    .map((row) => ({
      id: row.id,
      name: localizedName(locale, row) || row.code,
      caption: [row.sku, row.width && `${row.width}`].filter(Boolean).join(' · '),
    }));

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('mobile.newOrder.editLineSpec')}
        fitContent
        maxHeight={sheetHeight}
        overlay={false}
      >
        <ScrollView
          style={{ maxHeight: sheetHeight - 72 }}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <AnimatedPressable
            variant="card"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.newOrder.pickVariant')}
            testID="order-line-variant"
            onPress={() => {
              void haptics.selection();
              setVariantOpen(true);
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.newOrder.pickVariant')}
            </AppText>
            <AppText weight={titleWeight}>
              {line.variantLabel || t('mobile.newOrder.defaultVariant')}
            </AppText>
          </AnimatedPressable>

          <VariantOptionGroupsBoard
            groups={groups}
            values={values}
            selectedByGroup={selectedByGroup}
            hostOpen={open}
            pickerOverlay
            onChange={(groupId, valueId) => {
              const group = groups.find((g) => g.id === groupId);
              if (!group) return;
              const value = values.find((v) => v.id === valueId) ?? null;
              onChange(
                applyOptionToLine(
                  line,
                  { id: group.id, code: group.code },
                  value
                    ? { id: value.id, code: value.code, nameEn: value.nameEn, nameAr: value.nameAr }
                    : null,
                ),
              );
            }}
          />
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={confirmLabel ?? t('common.close')}
            testID="order-line-spec-done"
            onPress={() => {
              if (onConfirm) {
                void haptics.confirmLight();
                onConfirm();
                return;
              }
              void haptics.selection();
              onClose();
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: onConfirm ? colors.brandSoft : colors.surface,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
            }}
          >
            <AppText weight={titleWeight} color={onConfirm ? 'brand' : undefined}>
              {confirmLabel ?? t('common.close')}
            </AppText>
          </AnimatedPressable>
        </ScrollView>
      </BottomSheet>
      <NamedPickerSheet
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        title={t('mobile.newOrder.pickVariant')}
        rows={variantRows}
        selectedId={line.variantId || null}
        overlay
        onSelect={(id) => {
          const picked = variants.find((row) => row.id === id);
          onChange({
            ...line,
            variantId: id ?? '',
            variantSku: picked?.sku ?? '',
            variantLabel: picked ? localizedName(locale, picked) || picked.code : '',
          });
        }}
      />
    </>
  );
}
