/**
 * Short invoice share link: /s/<token>
 *
 * The link sent over WhatsApp. It stays on the app's domain and forwards to
 * the API, which resolves the token to a short-lived signed PDF download.
 * Lives outside [locale] so the i18n middleware leaves it alone.
 */

import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export function GET(_request: Request, { params }: { params: { token: string } }) {
  const token = /^[0-9A-Za-z]{8,32}$/.test(params.token) ? params.token : 'invalid';
  return NextResponse.redirect(`${API_BASE_URL}/public/shares/${token}`, 302);
}
