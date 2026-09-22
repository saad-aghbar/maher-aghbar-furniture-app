import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

const nextConfig = {
  /** Lets a production build run beside `next dev` (`NEXT_DIST_DIR=.next-build pnpm build`). */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@maher/ui', '@maher/i18n', '@shadergradient/react'],
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API}/api/v1/:path*` }];
  },
};

export default withNextIntl(nextConfig);
