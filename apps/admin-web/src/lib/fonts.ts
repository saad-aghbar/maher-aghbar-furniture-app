import { Outfit, Noto_Sans_Arabic, Heebo } from 'next/font/google';

/**
 * Brand typography (July 2026 guidelines):
 * - Latin target: Gendy — interim Outfit until licensed WOFF2 in packages/ui/fonts/gendy/
 * - Arabic target: KO Sans — interim Noto Sans Arabic until packages/ui/fonts/ko-sans/
 * - Hebrew: Heebo (not specified in brand book)
 *
 * See packages/ui/fonts/README.md for the licensed drop-in path.
 */

export const latinSans = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-latin-sans',
  display: 'swap',
});

export const arabicSans = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic-sans',
  display: 'swap',
});

export const heebo = Heebo({
  subsets: ['hebrew'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

/** @deprecated Prefer latinSans */
export const ibmSans = latinSans;
/** @deprecated Prefer arabicSans */
export const ibmSansArabic = arabicSans;

export function getFontClass(locale: string): string {
  if (locale === 'he') return `${heebo.variable} ${latinSans.variable}`;
  if (locale === 'ar') return `${arabicSans.variable} ${latinSans.variable}`;
  return `${latinSans.variable} ${arabicSans.variable}`;
}

export function getPrimaryFontFamily(locale: string): string {
  if (locale === 'he') return 'var(--font-heebo), var(--font-latin-sans), sans-serif';
  if (locale === 'ar') return 'var(--font-arabic-sans), var(--font-latin-sans), sans-serif';
  return 'var(--font-latin-sans), var(--font-arabic-sans), sans-serif';
}
