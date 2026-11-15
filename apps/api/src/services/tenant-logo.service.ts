/**
 * Tenant Logo Service
 *
 * The company logo printed on invoices and POS receipts. The browser uploads
 * the image here (base64 JSON, like invoice shares); we store it in the public
 * `tenant-logos` bucket under the tenant's folder and save its public URL in
 * tenants.settings.logo_url. Every upload gets a new file name so browsers and
 * the CDN never serve a stale logo; the previous file is removed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type { TenantSettings } from '@erp/shared';
import { getAdminClient } from './auth-admin';
import { SettingsService } from './settings.service';
import { AppError } from '../middleware/error';
import { toPublicSupabaseUrl } from '../lib/deployment';

export const TENANT_LOGO_BUCKET = 'tenant-logos';
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type LogoType = { ext: 'png' | 'jpg' | 'webp'; contentType: string };

/** Detect the image type from its magic bytes; SVG and anything else is rejected. */
export function detectLogoType(bytes: Buffer): LogoType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

export class TenantLogoService {
  private readonly settings: SettingsService;

  constructor(
    supabase: SupabaseClient<Database>,
    private readonly tenantId: string
  ) {
    this.settings = new SettingsService(supabase, tenantId);
  }

  async uploadLogo(imageBase64: string): Promise<TenantSettings> {
    const image = Buffer.from(imageBase64, 'base64');
    if (image.length === 0 || image.length > MAX_LOGO_BYTES) {
      throw AppError.badRequest('Logo is empty or larger than 2 MB');
    }
    const type = detectLogoType(image);
    if (!type) {
      throw AppError.badRequest('Logo must be a PNG, JPEG or WebP image');
    }

    const previousPath = (await this.settings.getSettings()).logo_path;

    const admin = getAdminClient();
    const storagePath = `${this.tenantId}/logo-${Date.now()}.${type.ext}`;
    const { error: uploadError } = await admin.storage
      .from(TENANT_LOGO_BUCKET)
      .upload(storagePath, image, {
        contentType: type.contentType,
        cacheControl: '31536000',
        upsert: false,
      });
    if (uploadError) throw AppError.internal(`Logo upload failed: ${uploadError.message}`);

    const { data: publicUrl } = admin.storage.from(TENANT_LOGO_BUCKET).getPublicUrl(storagePath);

    let settings: TenantSettings;
    try {
      settings = await this.settings.updateSettings({
        logo_url: toPublicSupabaseUrl(publicUrl.publicUrl),
        logo_path: storagePath,
      });
    } catch (error) {
      await admin.storage.from(TENANT_LOGO_BUCKET).remove([storagePath]);
      throw error;
    }

    if (previousPath && previousPath !== storagePath) {
      await this.removeFile(previousPath);
    }
    return settings;
  }

  async removeLogo(): Promise<TenantSettings> {
    const { logo_path: path } = await this.settings.getSettings();
    const settings = await this.settings.unsetKeys(['logo_url', 'logo_path']);
    if (path) await this.removeFile(path);
    return settings;
  }

  /** Best effort: a leftover file is harmless, so never fail the request. */
  private async removeFile(path: string): Promise<void> {
    // Only ever touch this tenant's folder, whatever the settings say.
    if (!path.startsWith(`${this.tenantId}/`)) return;
    const { error } = await getAdminClient().storage.from(TENANT_LOGO_BUCKET).remove([path]);
    if (error) console.error('[tenant-logo] failed to remove old logo', error);
  }
}
