import { useThemeContext } from './ThemeProvider';
import type { ThemeContextValue } from './types';

/** Semantic theme access — prefer `colors.*` / `theme.spacing` over hardcoded values. */
export function useTheme(): ThemeContextValue {
  return useThemeContext();
}
