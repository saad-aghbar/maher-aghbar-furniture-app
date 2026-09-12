import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type NamedPickRow = {
  id: string;
  name: string;
  caption?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: NamedPickRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  emptyLabel?: string;
  allowClear?: boolean;
  /** Stack on another sheet (host yields). Off by default for standalone pickers. */
  overlay?: boolean;
};

export function NamedPickerSheet({
  open,
  onClose,
  title,
  rows,
  selectedId,
  onSelect,
  emptyLabel,
  allowClear = true,
  overlay = false,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const sheetHeight = Math.min(Math.round(height * 0.62), 560);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) || (row.caption ?? '').toLowerCase().includes(q),
    );
  }, [query, rows]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      fitContent
      maxHeight={sheetHeight}
      overlay={overlay}
    >
      <View style={{ gap: theme.spacing.md, maxHeight: sheetHeight - 80 }}>
        <SearchBarShell>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('common.search')}
            accessibilityLabel={t('common.search')}
          />
        </SearchBarShell>
        <ScrollView keyboardShouldPersistTaps="handled">
          {allowClear ? (
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={emptyLabel ?? t('common.none')}
              onPress={() => {
                void haptics.selection();
                onSelect(null);
                onClose();
              }}
              style={{
                minHeight: theme.sizes.touch.min,
                paddingHorizontal: theme.spacing.md,
                justifyContent: 'center',
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: selectedId ? colors.border : colors.brand,
                marginBottom: theme.spacing.sm,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <AppText>{emptyLabel ?? t('common.none')}</AppText>
            </AnimatedPressable>
          ) : null}
          {filtered.map((row) => {
            const active = row.id === selectedId;
            return (
              <AnimatedPressable
                key={row.id}
                variant="card"
                accessibilityRole="button"
                accessibilityLabel={row.name}
                testID={`named-pick-${row.id}`}
                onPress={() => {
                  void haptics.selection();
                  onSelect(row.id);
                  onClose();
                }}
                style={{
                  minHeight: theme.sizes.touch.min,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.borderStrong,
                  marginBottom: theme.spacing.sm,
                  alignItems: isRTL ? 'flex-end' : 'flex-start',
                  ...orderBoardShadow(colorScheme),
                }}
              >
                <AppText weight={active ? 'semibold' : 'medium'}>{row.name}</AppText>
                {row.caption ? (
                  <AppText variant="caption" color="muted">
                    {row.caption}
                  </AppText>
                ) : null}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
