/**
 * Deployment mode helpers.
 *
 * Cloud (Fly.io + hosted Supabase) is the default. The Local Edition
 * (on-premise, one PC) sets DEPLOYMENT_MODE=local; see deploy/local/.
 * Everything gated here behaves exactly as before when the variable is unset.
 */

export function isLocalMode(): boolean {
  return process.env.DEPLOYMENT_MODE === 'local';
}

/**
 * Rewrite a Supabase-generated URL (public object URL, signed URL) so the
 * browser can open it.
 *
 * In the local edition the API reaches Supabase on the internal Docker
 * network (SUPABASE_URL=http://gateway:8080), so URLs built by supabase-js
 * point there. SUPABASE_PUBLIC_URL is the origin the browser uses
 * (http://localhost:8080). Unset (cloud): the URL is returned unchanged.
 */
export function toPublicSupabaseUrl(url: string): string {
  const internal = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const external = process.env.SUPABASE_PUBLIC_URL?.replace(/\/+$/, '');
  if (!internal || !external || internal === external) return url;
  return url.startsWith(internal) ? external + url.slice(internal.length) : url;
}
