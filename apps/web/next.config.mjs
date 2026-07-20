import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // We register the SW manually AFTER the first online login (see
  // components/pwa/service-worker-registrar.tsx) so a brand-new user is never
  // trapped in an empty offline shell before any data has synced.
  register: false,
  // Precache the boot shell (PWA start_url) + the offline fallback document.
  // Both are static files in public/ that the build wouldn't otherwise precache.
  additionalPrecacheEntries: [
    { url: '/app-shell.html', revision: 'app-shell-v1' },
    { url: '/offline.html', revision: 'offline-v1' },
  ],
  // Avoid SW churn during local development.
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@erp/shared', '@erp/offline-engine', '@erp/database', '@erp/ui'],
  experimental: {},
  async rewrites() {
    const apiTarget =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1$/, '') || 'http://localhost:3001';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
