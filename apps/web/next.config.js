const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@erp-saas/shared', '@erp-saas/database', '@erp-saas/ui'],
  experimental: {
    typedRoutes: true,
  },
};

module.exports = withNextIntl(nextConfig);
