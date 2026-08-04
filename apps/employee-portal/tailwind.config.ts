import type { Config } from 'tailwindcss';

/** Lets Tailwind opacity modifiers (e.g. border-border/60) work with CSS variable colors. */
const withAlpha = (cssVar: `--${string}`) =>
  `color-mix(in srgb, var(${cssVar}) calc(100% * <alpha-value>), transparent)`;

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: withAlpha('--maher-brand'),
        'brand-hover': withAlpha('--maher-brand-hover'),
        'brand-soft': withAlpha('--maher-brand-soft'),
        accent: withAlpha('--maher-accent'),
        background: withAlpha('--maher-background'),
        surface: withAlpha('--maher-surface'),
        'surface-muted': withAlpha('--maher-surface-muted'),
        'text-primary': withAlpha('--maher-text-primary'),
        'text-secondary': withAlpha('--maher-text-secondary'),
        'text-tertiary': withAlpha('--maher-text-tertiary'),
        border: withAlpha('--maher-border'),
        'border-strong': withAlpha('--maher-border-strong'),
      },
      borderRadius: {
        card: 'var(--maher-radius-lg)',
        xl2: 'var(--maher-radius-xl)',
      },
      boxShadow: {
        card: 'var(--maher-shadow-sm)',
        elevated: 'var(--maher-shadow-md)',
        float: 'var(--maher-shadow-lg)',
      },
      fontFamily: {
        sans: ['var(--font-primary)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
