import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, unstable_setRequestLocale } from 'next-intl/server';
import { locales } from '@/i18n/request';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';
import { SyncManager } from '@/components/pwa/sync-manager';
import { getServerRuntimeConfig } from '@/lib/runtime-config';
import '@/styles/globals.css';

const inter = { className: 'font-sans' };

export const metadata: Metadata = {
  title: 'ERP SaaS',
  description: 'Modular ERP Platform',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ERP' },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  // Lets env(safe-area-inset-*) report real insets on notched phones.
  viewportFit: 'cover',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  unstable_setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  // Local edition only: per-install config read from the server env at request
  // time. Must run before any client code, so it is a blocking inline script.
  const runtimeConfig = getServerRuntimeConfig();

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      {runtimeConfig && (
        <head>
          <script
            // Inline + first in <head>: runs before any app bundle. '<' is
            // escaped so the JSON can't close the script tag.
            dangerouslySetInnerHTML={{
              __html: `window.__GVS_CONFIG__=${JSON.stringify(runtimeConfig).replace(/</g, '\\u003c')};`,
            }}
          />
        </head>
      )}
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <AuthProvider>
              {children}
              <ServiceWorkerRegistrar />
              <SyncManager />
            </AuthProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
