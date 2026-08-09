import type { ColorScheme, ThemeElevation } from './types';

const none = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
} as const;

/**
 * Soft, diffuse elevation for paper boards and floating chrome.
 * Soft enough to feel warm — obvious enough that cards never read flat.
 */
export function createElevation(scheme: ColorScheme): ThemeElevation {
  if (scheme === 'dark') {
    return {
      none,
      rest: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.32,
        shadowRadius: 10,
        elevation: 2,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 18,
        elevation: 5,
      },
      raised: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.42,
        shadowRadius: 20,
        elevation: 6,
      },
    };
  }

  return {
    none,
    rest: {
      shadowColor: '#1E1A1B',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    card: {
      shadowColor: '#1E1A1B',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 4,
    },
    raised: {
      shadowColor: '#1E1A1B',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 5,
    },
  };
}
