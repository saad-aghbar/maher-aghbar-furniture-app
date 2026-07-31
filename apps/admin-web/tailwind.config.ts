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
        background: 'var(--maher-background)',
        surface: 'var(--maher-surface)',
        'text-primary': 'var(--maher-text-primary)',
        border: 'var(--maher-border)',
      },
      fontFamily: {
        sans: ['var(--font-primary)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
