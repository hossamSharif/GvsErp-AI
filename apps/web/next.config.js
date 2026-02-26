const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@erp/shared', '@erp/database', '@erp/ui'],
  experimental: {},
};

module.exports = withNextIntl(nextConfig);
