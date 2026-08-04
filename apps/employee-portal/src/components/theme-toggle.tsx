'use client';

import { ThemeToggle, type ThemeToggleProps } from '@maher/ui';
import { useTranslations } from 'next-intl';

export function AppThemeToggle(props: Omit<ThemeToggleProps, 'labelToDark' | 'labelToLight'>) {
  const t = useTranslations('navigation');
  return (
    <ThemeToggle
      {...props}
      labelToDark={t('themeToDark')}
      labelToLight={t('themeToLight')}
    />
  );
}
