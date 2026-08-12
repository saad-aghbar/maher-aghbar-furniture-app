import { createElement, useMemo, type ReactNode } from 'react';
import {
  employeeIndustrialColorsFor,
  employeeIndustrialElevationFor,
  employeeIndustrialRadius,
} from './employeeIndustrial';
import { ThemeCanvas, ThemeContext, useThemeContext } from './ThemeProvider';
import type { ThemeContextValue } from './types';

/**
 * Nested theme for the employee (worker) surface only.
 * Switches industrial light/dark with the shared ThemeSwitcher preference,
 * without touching admin/dealer parchment/liquorice palettes.
 */
export function EmployeeThemeOverride({ children }: { children: ReactNode }) {
  const parent = useThemeContext();

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = parent.colorScheme;
    const colors = employeeIndustrialColorsFor(scheme);
    const elevation = employeeIndustrialElevationFor(scheme);
    const theme = {
      ...parent.theme,
      colorScheme: scheme,
      colors,
      elevation,
      radius: employeeIndustrialRadius,
    };
    return {
      ...parent,
      theme,
      colors,
      colorScheme: scheme,
      mode: parent.mode,
      setMode: parent.setMode,
    };
  }, [parent]);

  return createElement(
    ThemeContext.Provider,
    { value },
    createElement(ThemeCanvas, null, children),
  );
}
