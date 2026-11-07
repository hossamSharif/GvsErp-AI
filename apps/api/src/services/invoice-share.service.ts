/**
 * Invoice Share Service
 *
 * Short share links for invoice PDFs sent over WhatsApp. The browser renders
 * the PDF (same templates as printing) and uploads it here; we store it in the
 * private `invoice-shares` bucket and hand back a token for the /s/<token>
 * link. Resolving a token returns a short-lived signed download URL, so the
 * link in the chat stays short and can expire without exposing the bucket.
 */

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { getAdminClient } from './auth-admin';
import { AppError } from '../middleware/error';

export const INVOICE_SHARE_BUCKET = 'invoice-shares';
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const TOKEN_LENGTH = 10;
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const PURGE_BATCH_SIZE = 100;
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export interface CreateInvoiceShareInput {
  /** The rendered PDF, base64 encoded (no data: prefix) */
  pdfBase64: string;
  /** WhatsApp number the link is sent to (digits), for the share log */
  phone?: string;
}

export interface InvoiceShare {
  token: string;
  expiresAt: string;
}

export type ResolvedShare =
  | { status: 'ok'; url: string }
  | { status: 'not_found' | 'expired' };

function generateToken(): string {
  // Rejection sampling keeps every base62 character equally likely.
  let token = '';
  while (token.length < TOKEN_LENGTH) {
    for (const byte of randomBytes(TOKEN_LENGTH * 2)) {
      if (byte < 248 && token.length < TOKEN_LENGTH) token += BASE62[byte % 62];
    }
  }
  return token;
}

/** Keep the download name readable but safe for headers and storage. */
function safeFileName(invoiceType: string, invoiceNumber: string): string {
  const prefix = invoiceType === 'purchase' ? 'Purchase' : 'Sale';
  const cleaned = invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${prefix}-${cleaned || 'invoice'}.pdf`;
}

export class InvoiceShareService {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly tenantId: string,
    private readonly userId: string
  ) {}

  async createShare(invoiceId: string, input: CreateInvoiceShareInput): Promise<InvoiceShare> {
    // Tenant-scoped client: RLS guarantees the invoice belongs to this tenant.
    const { data: invoice, error: invoiceError } = await this.supabase
      .from('invoices')
      .select('id, invoice_number, type')
      .eq('id', invoiceId)
      .maybeSingle();
    if (invoiceError) throw AppError.internal(invoiceError.message);
    if (!invoice) throw AppError.notFound('Invoice not found');

    const pdf = Buffer.from(input.pdfBase64, 'base64');
    if (pdf.length === 0 || pdf.length > MAX_PDF_BYTES) {
      throw AppError.badRequest('PDF is empty or larger than 8 MB');
    }
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw AppError.badRequest('Uploaded file is not a PDF');
    }

    const admin = getAdminClient();
    const token = generateToken();
    const storagePath = `${this.tenantId}/${invoiceId}/${token}.pdf`;

    const { error: uploadError } = await admin.storage
      .from(INVOICE_SHARE_BUCKET)
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw AppError.internal(`PDF upload failed: ${uploadError.message}`);

    const { data: share, error: insertError } = await admin
      .from('invoice_shares')
      .insert({
        tenant_id: this.tenantId,
        invoice_id: invoiceId,
        token,
        storage_path: storagePath,
        file_name: safeFileName(invoice.type, invoice.invoice_number),
        phone: input.phone ?? null,
        created_by: this.userId,
      })
      .select('token, expires_at')
      .single();
    if (insertError || !share) {
      await admin.storage.from(INVOICE_SHARE_BUCKET).remove([storagePath]);
      throw AppError.internal(insertError?.message ?? 'Failed to save share link');
    }

    // Housekeeping off the request path: every new share clears expired PDFs,
    // so storage only ever holds the last week of shares.
    void purgeExpiredInvoiceShares().catch((error) =>
      console.error('[invoice-shares] purge failed', error)
    );

    return { token: share.token, expiresAt: share.expires_at };
  }
}

/**
 * Delete expired share PDFs and their rows (all tenants). Storage files can't
 * be removed with SQL, so this runs through the Storage API.
 */
export async function purgeExpiredInvoiceShares(): Promise<number> {
  const admin = getAdminClient();
  const { data: expired, error } = await admin
    .from('invoice_shares')
    .select('id, storage_path')
    .lt('expires_at', new Date().toISOString())
    .limit(PURGE_BATCH_SIZE);
  if (error) throw error;
  if (!expired?.length) return 0;

  const { error: removeError } = await admin.storage
    .from(INVOICE_SHARE_BUCKET)
    .remove(expired.map((share) => share.storage_path));
  if (removeError) throw removeError;

  const { error: deleteError } = await admin
    .from('invoice_shares')
    .delete()
    .in('id', expired.map((share) => share.id));
  if (deleteError) throw deleteError;

  return expired.length;
}

/** Public (unauthenticated) lookup of a share token. */
export async function resolveInvoiceShare(token: string): Promise<ResolvedShare> {
  if (!/^[0-9A-Za-z]{8,32}$/.test(token)) return { status: 'not_found' };

  const admin = getAdminClient();
  const { data: share, error } = await admin
    .from('invoice_shares')
    .select('storage_path, file_name, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (error) throw AppError.internal(error.message);
  if (!share) return { status: 'not_found' };
  if (new Date(share.expires_at).getTime() < Date.now()) return { status: 'expired' };

  const { data: signed, error: signError } = await admin.storage
    .from(INVOICE_SHARE_BUCKET)
    .createSignedUrl(share.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: share.file_name,
    });
  if (signError || !signed?.signedUrl) return { status: 'not_found' };

  return { status: 'ok', url: signed.signedUrl };
}
