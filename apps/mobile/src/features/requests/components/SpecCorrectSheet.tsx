import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { useEffect, useState } from 'react';
import type { RequestItem } from '../types';

type Props = {
  open: boolean;
  item: RequestItem | null;
  onClose: () => void;
  onSave: (fields: Record<string, string>) => void;
};

const FIELD_KEYS = [
  'width',
  'height',
  'depth',
  'foamDensity',
  'woodType',
  'finish',
  'orientation',
] as const;

export function SpecCorrectSheet({ open, item, onClose, onSave }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.7), 640);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!item) {
      setFields({});
      return;
    }
    setFields({
      width: String(item.width ?? ''),
      height: String(item.height ?? ''),
      depth: String(item.depth ?? ''),
      foamDensity: item.foamDensity ?? '',
      woodType: item.woodType ?? '',
      finish: item.finish ?? '',
      orientation: item.orientation ?? '',
    });
  }, [item]);

  if (!item) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.adminRequest.correctSpec')}
      fitContent
      maxHeight={sheetHeight}
      overlay={false}
    >
      <ScrollView
        testID="spec-correct-sheet"
        style={{ maxHeight: sheetHeight - 72 }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="caption" color="muted">
          {item.productName}
        </AppText>
        {FIELD_KEYS.map((key) => (
          <TextField
            key={key}
            label={
              key === 'width' || key === 'height' || key === 'depth'
                ? `${t('mobile.adminRequest.dimensions')} ${key === 'width' ? 'W' : key === 'height' ? 'H' : 'D'}`
                : t(`mobile.adminRequest.${key}`)
            }
            value={fields[key] ?? ''}
            onChangeText={(text) => setFields((prev) => ({ ...prev, [key]: text }))}
          />
        ))}
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.adminRequest.saveCorrection')}
          testID="spec-correct-save"
          onPress={() => {
            void haptics.confirmMedium();
            onSave(fields);
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.brand,
          }}
        >
          <AppText weight={titleWeight} color="onBrand">
            {t('mobile.adminRequest.saveCorrection')}
          </AppText>
        </AnimatedPressable>
      </ScrollView>
    </BottomSheet>
  );
}
