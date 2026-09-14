import React, { useEffect, type ReactNode } from 'react';
import { Text, TextInput, type StyleProp, type TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { getActiveLocale, useLocale } from '@/i18n';
import {
  PLEX_ARABIC,
  PLEX_HEBREW,
  PLEX_LATIN,
  applyAppTypeface,
  plexFontSources,
} from '@/theme/fonts';

type TextDefaults = { style?: { fontFamily?: string } };

let hostTextPatched = false;

/**
 * New Architecture ignores Text.defaultProps for many styled nodes, and
 * `fontFamily` + `fontWeight` together makes iOS drop the custom face.
 * Patch createElement so every Text / TextInput gets the locale typeface.
 */
function patchHostText() {
  if (hostTextPatched) return;
  hostTextPatched = true;
  const original = React.createElement.bind(React) as typeof React.createElement;
  const patched: typeof React.createElement = ((
    type: React.ElementType,
    props: { style?: StyleProp<TextStyle> } | null,
    ...children: React.ReactNode[]
  ) => {
    if (type === Text || type === TextInput) {
      return original(
        type,
        {
          ...(props ?? {}),
          style: applyAppTypeface(getActiveLocale(), props?.style),
        },
        ...children,
      );
    }
    return original(type, props, ...children);
  }) as typeof React.createElement;
  (React as { createElement: typeof React.createElement }).createElement = patched;
}

patchHostText();

function defaultFamilyFor(locale: string): string {
  if (locale === 'ar') return PLEX_ARABIC.regular;
  if (locale === 'he') return PLEX_HEBREW.regular;
  return PLEX_LATIN.regular;
}

/**
 * Loads IBM Plex Sans / Sans Arabic / Sans Hebrew and applies the matching
 * regular face as the default Text / TextInput typeface — covers raw `Text`
 * that bypasses `AppText`.
 */
export function FontProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const [loaded, error] = useFonts(plexFontSources);

  useEffect(() => {
    if (!loaded && !error) return;
    applyDefaultTypeface(defaultFamilyFor(locale));
    return () => applyDefaultTypeface(undefined);
  }, [locale, loaded, error]);

  // Fail open if a font file is missing — better than a blank boot screen.
  if (!loaded && !error) return null;

  return children;
}

function applyDefaultTypeface(family: string | undefined) {
  const style = family ? { fontFamily: family } : undefined;
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
