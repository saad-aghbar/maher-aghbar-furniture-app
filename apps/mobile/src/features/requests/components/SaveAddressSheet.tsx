import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { suggestAddressLabel } from '../newOrderValidation';

type Props = {
  open: boolean;
  onClose: () => void;
  addressLine: string;
  pinned: boolean;
  defaultAsFirst: boolean;
  saving: boolean;
  error?: string | null;
  onSave: (input: { label: string; isDefaultDelivery: boolean }) => void;
};

export function SaveAddressSheet({
  open,
  onClose,
  addressLine,
  pinned,
  defaultAsFirst,
  saving,
  error,
  onSave,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const [label, setLabel] = useState('');
  const [asDefault, setAsDefault] = useState(defaultAsFirst);

  useEffect(() => {
    if (!open) return;
    setLabel(suggestAddressLabel(addressLine));
    setAsDefault(defaultAsFirst);
  }, [open, addressLine, defaultAsFirst]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.newOrder.saveAddressTitle')}
      fitContent
      maxHeight={520}
    >
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.newOrder.saveAddressBody')}
        </AppText>

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(63,52,44,0.12)',
            backgroundColor: dark ? colors.surface : colors.brandSoft,
            padding: theme.spacing.md,
            gap: theme.spacing.xs,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand,
            }}
          >
            <Ionicons
              name={pinned ? 'navigate' : 'location-outline'}
              size={18}
              color={colors.onBrand}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="label"
              weight="semibold"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {addressLine.trim() || '—'}
            </AppText>
            <AppText
              variant="caption"
              color="muted"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {pinned
                ? t('mobile.newOrder.saveAddressWithPin')
                : t('mobile.newOrder.saveAddressNoPin')}
            </AppText>
          </View>
        </View>

        <TextField
          label={t('mobile.newOrder.saveAddressLabel')}
          value={label}
          onChangeText={setLabel}
          placeholder={t('mobile.newOrder.saveAddressLabelPlaceholder')}
          autoCapitalize="words"
          maxLength={40}
        />

        <Pressable
          onPress={() => {
            void haptics.selection();
            setAsDefault((v) => !v);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: asDefault }}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
          }}
        >
          <Ionicons
            name={asDefault ? 'checkbox' : 'square-outline'}
            size={22}
            color={asDefault ? colors.brand : colors.textMuted}
          />
          <AppText variant="body" style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.newOrder.saveAddressAsDefault')}
          </AppText>
        </Pressable>

        {error ? (
          <AppText variant="caption" color="error" accessibilityLiveRegion="assertive">
            {error}
          </AppText>
        ) : null}

        <PrimaryButton
          label={t('mobile.newOrder.saveAddressAction')}
          loading={saving}
          disabled={!label.trim() || !addressLine.trim()}
          onPress={() => {
            void haptics.confirmMedium();
            onSave({ label: label.trim(), isDefaultDelivery: asDefault });
          }}
        />
      </View>
    </BottomSheet>
  );
}
