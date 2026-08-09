import { darkColors, lightColors } from './colors';
import { createElevation } from './elevation';
import { motion } from './motion';
import { radius } from './radius';
import { sizes } from './sizes';
import { spacing } from './spacing';
import type { ColorScheme, Theme } from './types';
import { typography } from './typography';

export function createTheme(colorScheme: ColorScheme): Theme {
  return {
    colorScheme,
    colors: colorScheme === 'dark' ? darkColors : lightColors,
    typography,
    spacing,
    radius,
    elevation: createElevation(colorScheme),
    motion,
    sizes,
  };
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
