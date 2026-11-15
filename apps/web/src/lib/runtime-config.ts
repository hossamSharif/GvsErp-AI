/**
 * Runtime configuration.
 *
 * Cloud (Vercel): values come from the build-time NEXT_PUBLIC_* env vars,
 * exactly as before.
 *
 * Local edition (on-premise, one PC): every install has its own keys, so the
 * web image can't bake them in at build time. The root layout reads the server
 * env at request time and injects `window.__GVS_CONFIG__` (see
 * RuntimeConfigScript). The local gateway serves the web app, the API and
 * Supabase on ONE origin, so URLs are derived from window.location.
 */

export type DeploymentMode = 'cloud' | 'local';

export interface PublicRuntimeConfig {
  mode: DeploymentMode;
  supabaseAnonKey: string;
}

declare global {
  interface Window {
    __GVS_CONFIG__?: PublicRuntimeConfig;
  }
}

function injected(): PublicRuntimeConfig | undefined {
  return typeof window === 'undefined' ? undefined : window.__GVS_CONFIG__;
}

/**
 * True when running the local (on-premise) edition.
 * Server side reads DEPLOYMENT_MODE; browser side reads the injected config.
 */
export function isLocalMode(): boolean {
  if (typeof window === 'undefined') return process.env.DEPLOYMENT_MODE === 'local';
  return injected()?.mode === 'local';
}

/**
 * Origin of the local gateway. In the browser it's the page's own origin.
 * During server-side rendering of client components there is no window; no
 * request is made from there, so any valid absolute URL will do.
 */
function localOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

export function getSupabaseUrl(): string {
  if (isLocalMode()) return localOrigin();
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

export function getSupabaseAnonKey(): string {
  if (isLocalMode()) {
    return typeof window === 'undefined'
      ? process.env.SUPABASE_ANON_KEY ?? ''
      : injected()?.supabaseAnonKey ?? '';
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

/** Absolute base URL of the GVS API, including the /api/v1 suffix. */
export function getApiBaseUrl(): string {
  if (isLocalMode()) return `${localOrigin()}/api/v1`;
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
}

/**
 * Server-only: the config to inject into the page, or null in the cloud.
 * Reads plain (non-NEXT_PUBLIC) env vars at request time.
 */
export function getServerRuntimeConfig(): PublicRuntimeConfig | null {
  if (process.env.DEPLOYMENT_MODE !== 'local') return null;
  return {
    mode: 'local',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  };
}
