import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { NewOrderScreen } from '@/features/requests/NewOrderScreen';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

/**
 * Visual QA for New Order steps 1–2.
 * Route: `/dev/new-order`
 *
 * Note: Uses live auth gate inside NewOrderScreen; open while logged in as dealer.
 */
export default function NewOrderGalleryScreen() {
  const { theme, colors } = useTheme();
  const { setLocale, locale } = useLocale();
  const [key, setKey] = useState(0);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText variant="caption" color="secondary">
          New Order gallery · steps 1–2 · {locale}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          <SecondaryButton label="Reset" onPress={() => setKey((k) => k + 1)} />
          <SecondaryButton
            label={locale === 'ar' ? 'EN' : 'AR'}
            onPress={() => void setLocale(locale === 'ar' ? 'en' : 'ar')}
          />
        </View>
      </View>
      <NewOrderScreen key={key} />
    </View>
  );
}
