import { useEffect, type ReactNode } from 'react';
import { Text, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
import { useLocale } from '@/i18n';
import { KO_SANS, koSansFontSources } from '@/theme/fonts';

type TextDefaults = { style?: { fontFamily?: string } };

/**
 * Loads KO Sans and applies it as the default Text / TextInput face when
 * the active locale is Arabic — covers raw `Text` that bypasses `AppText`.
 */
export function FontProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const [loaded, error] = useFonts(koSansFontSources);

  useEffect(() => {
    const arabic = locale === 'ar' && (loaded || Boolean(error));
    applyDefaultTypeface(arabic);
    return () => applyDefaultTypeface(false);
  }, [locale, loaded, error]);

  // Fail open if a font file is missing — better than a blank boot screen.
  if (!loaded && !error) return null;

  return children;
}

function applyDefaultTypeface(arabic: boolean) {
  const style = arabic ? { fontFamily: KO_SANS.regular } : undefined;
  setDefaultStyle(Text as unknown as { defaultProps?: TextDefaults }, style);
  setDefaultStyle(TextInput as unknown as { defaultProps?: TextDefaults }, style);
}

function setDefaultStyle(
  Component: { defaultProps?: TextDefaults },
  style: TextDefaults['style'],
) {
  Component.defaultProps = {
    ...(Component.defaultProps ?? {}),
    style,
  };
}
