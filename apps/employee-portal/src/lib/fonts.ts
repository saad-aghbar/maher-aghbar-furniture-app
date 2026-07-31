import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Heebo } from 'next/font/google';

export const ibmSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-sans',
  display: 'swap',
});

export const ibmSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-arabic',
  display: 'swap',
});

export const heebo = Heebo({
  subsets: ['hebrew'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

export function getFontClass(locale: string): string {
  if (locale === 'he') return `${heebo.variable} ${ibmSans.variable}`;
  if (locale === 'ar') return `${ibmSansArabic.variable} ${ibmSans.variable}`;
  return `${ibmSans.variable} ${ibmSansArabic.variable}`;
}

export function getPrimaryFontFamily(locale: string): string {
  if (locale === 'he') return 'var(--font-heebo), var(--font-ibm-sans), sans-serif';
  if (locale === 'ar') return 'var(--font-ibm-arabic), var(--font-ibm-sans), sans-serif';
  return 'var(--font-ibm-sans), var(--font-ibm-arabic), sans-serif';
}
