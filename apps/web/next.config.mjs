import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

const nextConfig = {
  transpilePackages: ['@maher/ui', '@maher/i18n'],
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API}/api/v1/:path*` }];
  },
};

export default withNextIntl(nextConfig);
