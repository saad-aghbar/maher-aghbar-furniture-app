import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CustomerAddress } from '@/api/modules/customers';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { formatAddressLine, isAddressAlreadySaved } from '../newOrderValidation';

type Props = {
  savedAddresses: CustomerAddress[];
  deliveryAddress: string;
  deliveryNotes: string;
  deliveryLat?: number;
  notesMax: number;
  addressError?: string;
  canSaveAddress?: boolean;
  onOpenSavedAddresses: () => void;
  onSaveAddress?: () => void;
  onChangeAddress: (value: string) => void;
  onClearCoords: () => void;
  onOpenMap: () => void;
  onChangeNotes: (value: string) => void;
};

/**
 * Customer & delivery — saved-address CTA + unified address/map shell + notes.
 */
export function NewOrderDeliveryAddressBlock({
  savedAddresses,
  deliveryAddress,
  deliveryNotes,
  deliveryLat,
  notesMax,
  addressError,
  canSaveAddress = false,
  onOpenSavedAddresses,
  onSaveAddress,
  onChangeAddress,
  onClearCoords,
  onOpenMap,
  onChangeNotes,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const pinned = deliveryLat != null;
  const alreadySaved = isAddressAlreadySaved(deliveryAddress, savedAddresses);
  const canOfferSave =
    canSaveAddress &&
    Boolean(onSaveAddress) &&
    deliveryAddress.trim().length > 0 &&
    !alreadySaved;
  const showSavedRow = savedAddresses.length > 0 || canSaveAddress;
  const selectedSaved = savedAddresses.find(
    (a) => formatAddressLine(a) === deliveryAddress.trim(),
  );
  const savedLabel =
    selectedSaved?.label?.trim() ||
    (deliveryAddress.trim()
      ? deliveryAddress.trim()
      : savedAddresses.length > 0
        ? t('mobile.newOrder.savedAddressesHint', { count: savedAddresses.length })
        : t('mobile.newOrder.savedAddressesEmptyHint'));

  const shellBorder = addressError
    ? colors.error
    : dark
      ? 'rgba(255,255,255,0.16)'
      : 'rgba(63,52,44,0.14)';
  const shellFill = dark ? colors.surface : 'rgba(255,255,255,0.88)';
  const softWash = dark ? 'rgba(255,255,255,0.06)' : colors.brandSoft;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {showSavedRow ? (
        <Pressable
          onPress={() => {
            void haptics.selection();
            onOpenSavedAddresses();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.newOrder.savedAddresses')}
          style={({ pressed }) => ({
            borderRadius: theme.radius.xl,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.12)',
            backgroundColor: softWash,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          })}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brand,
              }}
            >
              <Ionicons name="bookmark" size={20} color={colors.onBrand} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <AppText
                variant="caption"
                color="muted"
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  fontSize: 11,
                }}
              >
                {t('mobile.newOrder.savedAddresses')}
              </AppText>
              <AppText
                variant="label"
                weight="semibold"
                numberOfLines={2}
                style={{
                  color: colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {savedLabel}
              </AppText>
            </View>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: theme.radius.full,
                backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.75)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.1)',
              }}
            >
              <AppText variant="caption" weight="semibold" color="brand">
                {savedAddresses.length > 0
                  ? t('mobile.newOrder.savedAddressesChoose')
                  : t('mobile.newOrder.savedAddressesManage')}
              </AppText>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={14}
                color={colors.brand}
              />
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={{ gap: theme.spacing.xs }}>
        <AppText
          variant="label"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.newOrder.deliveryAddress')}
        </AppText>

        <View
          style={{
            borderRadius: theme.radius.xl,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: shellBorder,
            backgroundColor: shellFill,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            minHeight: 72,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
            }}
          >
            <View
              style={{
                marginTop: 2,
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: softWash,
              }}
            >
              <Ionicons name="home-outline" size={15} color={colors.brand} />
            </View>
            <TextInput
              value={deliveryAddress}
              onChangeText={(v) => {
                onChangeAddress(v);
                if (!v.trim()) onClearCoords();
              }}
              placeholder={t('mobile.newOrder.deliveryAddressPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              accessibilityLabel={t('mobile.newOrder.deliveryAddress')}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 88,
                padding: 0,
                margin: 0,
                color: colors.textPrimary,
                fontSize: theme.typography.variants.body.fontSize,
                lineHeight: theme.typography.variants.body.lineHeight,
                textAlignVertical: 'top',
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
                ...resolveAppFontStyle(locale, { variant: 'body' }),
              }}
            />
          </View>

          <Pressable
            onPress={() => {
              void haptics.selection();
              onOpenMap();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.newOrder.openMap')}
            style={({ pressed }) => ({
              width: 84,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: theme.spacing.sm,
              backgroundColor: pinned ? colors.brand : softWash,
              borderLeftWidth: isRTL ? 0 : StyleSheet.hairlineWidth * 2,
              borderRightWidth: isRTL ? StyleSheet.hairlineWidth * 2 : 0,
              borderColor: shellBorder,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Ionicons
              name={pinned ? 'navigate' : 'map'}
              size={22}
              color={pinned ? colors.onBrand : colors.brand}
            />
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: pinned ? colors.onBrand : colors.brand,
                fontSize: 11,
                letterSpacing: 0.3,
              }}
            >
              {pinned
                ? t('mobile.newOrder.mapPinnedShort')
                : t('mobile.newOrder.mapPinShort')}
            </AppText>
          </Pressable>
        </View>

        {addressError ? (
          <AppText variant="caption" color="error">
            {addressError}
          </AppText>
        ) : (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {pinned
              ? t('mobile.newOrder.mapPinnedHint')
              : t('mobile.newOrder.mapOptionalHint')}
          </AppText>
        )}

        {canOfferSave ? (
          <Pressable
            onPress={() => {
              void haptics.selection();
              onSaveAddress?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.newOrder.saveAddressAction')}
            style={({ pressed }) => ({
              marginTop: theme.spacing.xs,
              minHeight: theme.sizes.touch.min - 4,
              borderRadius: theme.radius.xl,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: colors.brand,
              borderStyle: 'dashed',
              backgroundColor: softWash,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Ionicons name="bookmark-outline" size={18} color={colors.brand} />
            <View style={{ flex: 1, gap: 1 }}>
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
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.newOrder.saveAddressHint')}
              </AppText>
            </View>
            <Ionicons name="add-circle" size={22} color={colors.brand} />
          </Pressable>
        ) : alreadySaved && deliveryAddress.trim() ? (
          <View
            style={{
              marginTop: theme.spacing.xs,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <AppText variant="caption" color="secondary">
              {t('mobile.newOrder.addressAlreadySaved')}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <TextField
          label={t('mobile.newOrder.deliveryNotes')}
          value={deliveryNotes}
          onChangeText={onChangeNotes}
          placeholder={t('mobile.newOrder.deliveryNotesPlaceholder')}
          multiline
          style={{ minHeight: 156, textAlignVertical: 'top' }}
        />
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'left' : 'right' }}
        >
          {deliveryNotes.length}/{notesMax}
        </AppText>
      </View>
    </View>
  );
}
