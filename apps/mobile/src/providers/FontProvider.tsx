import React, { useEffect, type ReactNode } from 'react';
import { Text, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
import { getActiveLocale, useLocale } from '@/i18n';
import {
  KO_SANS,
  RUBIK,
  applyAppTypeface,
  koSansFontSources,
  rubikFontSources,
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
  (React as unknown as { createElement: typeof React.createElement }).createElement = ((
    type: unknown,
    props: { style?: unknown } | null,
    ...children: unknown[]
  ) => {
    if (type === Text || type === TextInput) {
      return original(
        type as typeof Text,
        {
          ...(props ?? {}),
          style: applyAppTypeface(getActiveLocale(), props?.style as never),
        },
        ...children,
      );
    }
    return original(type as typeof Text, props, ...children);
  }) as typeof React.createElement;
}

patchHostText();

/**
 * Loads KO Sans (Arabic) and Rubik (English / Hebrew) and applies the
 * matching regular face as the default Text / TextInput typeface —
 * covers raw `Text` that bypasses `AppText`.
 */
export function FontProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const [loaded, error] = useFonts({
    ...koSansFontSources,
    ...rubikFontSources,
  });

  useEffect(() => {
    if (!loaded && !error) return;
    const family = locale === 'ar' ? KO_SANS.regular : RUBIK.regular;
    applyDefaultTypeface(family);
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
