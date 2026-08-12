import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CustomerAddress } from '@/api/modules/customers';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { formatAddressLine } from '../newOrderValidation';

type Props = {
  open: boolean;
  onClose: () => void;
  addresses: CustomerAddress[];
  selectedLine: string;
  canSaveCurrent?: boolean;
  onSaveCurrent?: () => void;
  onSelect: (addr: CustomerAddress) => void;
};

export function SavedAddressPickerSheet({
  open,
  onClose,
  addresses,
  selectedLine,
  canSaveCurrent = false,
  onSaveCurrent,
  onSelect,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  /** Defer nested Modal until this sheet fully unmounts (avoids iOS freeze). */
  const pendingSaveRef = useRef<(() => void) | null>(null);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        const action = pendingSaveRef.current;
        pendingSaveRef.current = null;
        action?.();
      }}
      title={t('mobile.newOrder.savedAddressesTitle')}
      sheetHeight={520}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xl }}
      >
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left', marginBottom: theme.spacing.xs }}
        >
          {t('mobile.newOrder.savedAddressesBody')}
        </AppText>
        {addresses.length === 0 ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.12)',
              backgroundColor: dark ? colors.surface : colors.brandSoft,
              padding: theme.spacing.lg,
              gap: theme.spacing.xs,
              alignItems: 'center',
            }}
          >
            <Ionicons name="bookmark-outline" size={28} color={colors.brand} />
            <AppText variant="label" weight="semibold" style={{ textAlign: 'center' }}>
              {t('mobile.newOrder.savedAddressesEmptyTitle')}
            </AppText>
            <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              {t('mobile.newOrder.savedAddressesEmptyBody')}
            </AppText>
          </View>
        ) : null}
        {addresses.map((addr) => {
          const line = formatAddressLine(addr);
          const title = addr.label?.trim() || line;
          const active = selectedLine.trim() === line;
          const isDefault = Boolean(addr.isDefaultDelivery);
          return (
            <Pressable
              key={addr.id}
              onPress={() => {
                void haptics.confirmMedium();
                onSelect(addr);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                borderRadius: theme.radius.xl,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: active
                  ? colors.brand
                  : dark
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(63,52,44,0.12)',
                backgroundColor: active
                  ? colors.brandSoft
                  : dark
                    ? colors.surface
                    : 'rgba(255,255,255,0.88)',
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.brand : colors.brandSoft,
                }}
              >
                <Ionicons
                  name={active ? 'location' : 'location-outline'}
                  size={22}
                  color={active ? colors.onBrand : colors.brand}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    flexWrap: 'wrap',
                  }}
                >
                  <AppText
                    variant="label"
                    weight="semibold"
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                      flexShrink: 1,
                    }}
                  >
                    {title}
                  </AppText>
                  {isDefault ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: theme.radius.full,
                        backgroundColor: dark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      <AppText variant="caption" color="muted" style={{ fontSize: 10 }}>
                        {t('mobile.newOrder.savedAddressDefault')}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                {addr.label?.trim() ? (
                  <AppText
                    variant="caption"
                    color="muted"
                    numberOfLines={2}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {line}
                  </AppText>
                ) : null}
              </View>
              {active ? (
                <Ionicons name="checkmark-circle" size={24} color={colors.brand} />
              ) : (
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={18}
                  color={colors.textMuted}
                />
              )}
            </Pressable>
          );
        })}
        {canSaveCurrent && onSaveCurrent ? (
          <Pressable
            onPress={() => {
              void haptics.selection();
              pendingSaveRef.current = onSaveCurrent;
              onClose();
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: theme.spacing.sm,
              borderRadius: theme.radius.xl,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: colors.brand,
              borderStyle: 'dashed',
              backgroundColor: colors.brandSoft,
              padding: theme.spacing.md,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Ionicons name="add-circle" size={22} color={colors.brand} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText
                variant="label"
                weight="semibold"
                color="brand"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.newOrder.saveAddressAction')}
              </AppText>
              <AppText
                variant="caption"
                color="secondary"
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {selectedLine.trim() || t('mobile.newOrder.saveAddressNeedAddress')}
              </AppText>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
