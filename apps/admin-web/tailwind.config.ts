import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--maher-brand)',
        'brand-hover': 'var(--maher-brand-hover)',
        'brand-soft': 'var(--maher-brand-soft)',
        accent: 'var(--maher-accent)',
        background: 'var(--maher-background)',
        surface: 'var(--maher-surface)',
        'surface-muted': 'var(--maher-surface-muted)',
        'text-primary': 'var(--maher-text-primary)',
        'text-secondary': 'var(--maher-text-secondary)',
        'text-tertiary': 'var(--maher-text-tertiary)',
        border: 'var(--maher-border)',
        'border-strong': 'var(--maher-border-strong)',
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
