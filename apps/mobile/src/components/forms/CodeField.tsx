import type { ComponentProps } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { TextField, type TextFieldProps } from '@/components/forms/TextField';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type CodeFieldProps = Omit<TextFieldProps, 'onChangeText' | 'containerStyle'> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Called after a successful camera scan (value is already set). */
  onScanned?: (data: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  scanTitle?: string;
  scanHint?: string;
  /** Overrides the camera button a11y label (`mobile.scan.openCamera`). */
  scanAccessibilityLabel?: string;
  /** Camera button glyph. Default is QR; use `barcode-outline` for supplier barcodes. */
  scanIcon?: ComponentProps<typeof Ionicons>['name'];
};

/**
 * Text field for barcode / QR / SKU with a camera scan affordance.
 * Works above bottom sheets via the root CodeScannerProvider.
 */
export function CodeField({
  value,
  onChangeText,
  onScanned,
  scanTitle,
  scanHint,
  scanAccessibilityLabel,
  scanIcon = 'qr-code-outline',
  label,
  error,
  containerStyle,
  ...rest
}: CodeFieldProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { openScanner } = useCodeScanner();

  async function openCamera() {
    const data = await openScanner({
      title: scanTitle,
      hint: scanHint,
    });
    if (!data) return;
    onChangeText(data);
    onScanned?.(data);
  }

  return (
    <View style={[{ gap: theme.spacing.xs, width: '100%' }, containerStyle]}>
      {label ? (
        <AppText variant="label" color="secondary">
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'stretch',
          gap: theme.spacing.sm,
        }}
      >
        <TextField
          {...rest}
          value={value}
          onChangeText={onChangeText}
          error={undefined}
          autoCapitalize={rest.autoCapitalize ?? 'characters'}
          autoCorrect={rest.autoCorrect ?? false}
          containerStyle={{ flex: 1 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scanAccessibilityLabel ?? t('mobile.scan.openCamera')}
          onPress={() => void openCamera()}
          style={{
            minWidth: theme.sizes.touch.min,
            minHeight: theme.sizes.touch.min,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.xl,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.brand,
          }}
        >
          <Ionicons name={scanIcon} size={22} color={colors.brand} />
        </Pressable>
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
    </View>
  );
}
