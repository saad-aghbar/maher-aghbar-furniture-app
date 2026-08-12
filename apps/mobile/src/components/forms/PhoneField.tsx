import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { AppTextInput } from './AppTextInput';
import {
  COUNTRY_DIAL_CODES,
  defaultCountry,
  digitsOnly,
  formatInternational,
  parsePhoneValue,
  type CountryDial,
} from './countryDialCodes';

type Props = {
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** ISO2 used when `value` has no country prefix. Default Palestine (970). */
  defaultIso2?: string;
};

/**
 * Phone field with country dial-code picker + national number.
 * Dial chip stays LTR (left) in all locales. Emits `+9705…` via `onChangeText`.
 */
export function PhoneField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  containerStyle,
  defaultIso2,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const sheetHeight = Math.round(windowH * 0.72);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const fallback = useMemo(() => {
    if (defaultIso2) {
      return (
        COUNTRY_DIAL_CODES.find((c) => c.iso2 === defaultIso2) ?? defaultCountry()
      );
    }
    return defaultCountry();
  }, [defaultIso2]);

  const parsed = useMemo(() => parsePhoneValue(value, fallback), [value, fallback]);
  const [country, setCountry] = useState<CountryDial>(parsed.country);
  const [national, setNational] = useState(parsed.national);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const next = parsePhoneValue(value, fallback);
    setCountry(next.country);
    setNational(next.national);
  }, [value, fallback]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_DIAL_CODES;
    return COUNTRY_DIAL_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q.replace(/^\+/, '')) ||
        c.iso2.toLowerCase().includes(q),
    );
  }, [query]);

  function emit(nextCountry: CountryDial, nextNational: string) {
    onChangeText(formatInternational(nextCountry.dial, nextNational));
  }

  function onSelectCountry(next: CountryDial) {
    void haptics.selection();
    setCountry(next);
    emit(next, national);
    setPickerOpen(false);
    setQuery('');
  }

  function onNationalChange(text: string) {
    const next = digitsOnly(text);
    setNational(next);
    emit(country, next);
  }

  const touchMin = theme.sizes.touch.min;

  return (
    <View style={[{ gap: theme.spacing.xs, width: '100%' }, containerStyle]}>
      {label ? (
        <AppText variant="label" color="secondary">
          {label}
        </AppText>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          minHeight: touchMin,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.borderStrong,
          borderRadius: theme.radius.xl,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          direction: 'ltr',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mobile.phone.countryCode')}
          onPress={() => {
            void haptics.selection();
            setPickerOpen(true);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: theme.spacing.md,
            backgroundColor: colors.brandSoft,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderColor: colors.borderStrong,
            minWidth: 112,
          }}
        >
          <AppText variant="body" style={{ fontSize: 18, lineHeight: 22 }}>
            {country.flag}
          </AppText>
          <AppText
            variant="label"
            weight="semibold"
            dir="ltr"
            style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
          >
            +{country.dial}
          </AppText>
          <Ionicons name="chevron-down" size={14} color={colors.brand} />
        </Pressable>

        <AppTextInput
          accessibilityLabel={label ?? t('mobile.phone.number')}
          value={national}
          onChangeText={onNationalChange}
          keyboardType="phone-pad"
          placeholder={placeholder ?? t('mobile.phone.numberPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            minHeight: touchMin,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            color: colors.textPrimary,
            fontSize: theme.typography.variants.body.fontSize,
            lineHeight: theme.typography.variants.body.lineHeight,
            textAlign: 'left',
            writingDirection: 'ltr',
            ...resolveAppFontStyle(locale, { variant: 'body' }),
          }}
        />
      </View>

      {error ? (
        <AppText
          variant="caption"
          color="error"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {error}
        </AppText>
      ) : null}

      <BottomSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setQuery('');
        }}
        sheetHeight={sheetHeight}
      >
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          {/* Floor header board */}
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: colors.brand,
                opacity: 0.55,
              }}
            />
            <View
              style={{
                padding: theme.spacing.md,
                gap: theme.spacing.md,
                ...(isRTL
                  ? { paddingRight: theme.spacing.md + 4 }
                  : { paddingLeft: theme.spacing.md + 4 }),
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="globe-outline" size={16} color={colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    style={{
                      color: colors.brand,
                      letterSpacing: locale === 'ar' ? 0 : 1.1,
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      fontSize: 11,
                      lineHeight: 14,
                    }}
                  >
                    {t('mobile.phone.countryCode')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.phone.pickerHint')}
                  </AppText>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius.full,
                    backgroundColor: colors.brandSoft,
                    borderWidth: 1,
                    borderColor: colors.brand,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    dir="ltr"
                    style={{ color: colors.brand, fontVariant: ['tabular-nums'] }}
                  >
                    +{country.dial}
                  </AppText>
                </View>
              </View>

              <SearchBarShell>
                <AppTextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('mobile.phone.searchCountry')}
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingVertical: theme.spacing.sm,
                    color: colors.textPrimary,
                    fontSize: theme.typography.variants.body.fontSize,
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                    ...resolveAppFontStyle(locale, { variant: 'body' }),
                  }}
                />
                {query.length > 0 ? (
                  <Pressable
                    onPress={() => setQuery('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('mobile.phone.clearSearch')}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </SearchBarShell>
            </View>
          </View>

          {/* Country boards */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => `${item.iso2}-${item.dial}`}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{
              gap: theme.spacing.sm,
              paddingBottom: theme.spacing.lg,
            }}
            ListEmptyComponent={
              <View
                style={{
                  padding: theme.spacing.xl,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  alignItems: 'center',
                }}
              >
                <AppText variant="caption" color="muted" align="center">
                  {t('mobile.phone.noCountries')}
                </AppText>
              </View>
            }
            renderItem={({ item }) => {
              const active = item.iso2 === country.iso2 && item.dial === country.dial;
              return (
                <AnimatedPressable
                  variant="button"
                  onPress={() => onSelectCountry(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.borderStrong,
                    backgroundColor: active ? colors.brandSoft : colors.surface,
                    overflow: 'hidden',
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  {active ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: 3,
                        backgroundColor: colors.brand,
                        opacity: 0.9,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.md,
                      paddingLeft: active ? theme.spacing.md + 4 : theme.spacing.md,
                      direction: 'ltr',
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.surfaceSecondary,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: active ? colors.brand : colors.border,
                      }}
                    >
                      <AppText style={{ fontSize: 20, lineHeight: 26 }}>{item.flag}</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText
                        variant="label"
                        weight={active ? titleWeight : 'medium'}
                        numberOfLines={1}
                      >
                        {item.name}
                      </AppText>
                    </View>
                    <View
                      style={{
                        minWidth: 52,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: theme.radius.full,
                        backgroundColor: active ? colors.brand : colors.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                        alignItems: 'center',
                      }}
                    >
                      <AppText
                        variant="caption"
                        weight="semibold"
                        dir="ltr"
                        style={{
                          color: active ? colors.onBrand : colors.brand,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        +{item.dial}
                      </AppText>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                    ) : null}
                  </View>
                </AnimatedPressable>
              );
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
