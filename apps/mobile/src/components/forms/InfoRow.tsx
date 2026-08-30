import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';

type InfoRowProps = {
  label: string;
  value?: string | number | null;
  /** Force LTR for codes, phones, quantities. */
  ltr?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Read-only label + value — prefer over disabled TextInputs for facts.
 */
export function InfoRow({ label, value, ltr, style }: InfoRowProps) {
  const { isRTL } = useLocale();
  const display =
    value == null || (typeof value === 'string' && !value.trim())
      ? '—'
      : String(value);

  return (
    <View style={[{ gap: 2 }, style]}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText
        variant="body"
        style={
          ltr
            ? { writingDirection: 'ltr', textAlign: isRTL ? 'right' : 'left' }
            : undefined
        }
        dir={ltr ? 'ltr' : undefined}
      >
        {display}
      </AppText>
    </View>
  );
}
