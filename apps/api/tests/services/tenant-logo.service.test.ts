import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage = {
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
};

vi.mock('../../src/services/auth-admin', () => ({
  getAdminClient: () => ({ storage: { from: () => storage } }),
}));

import { TenantLogoService, detectLogoType, MAX_LOGO_BYTES } from '../../src/services/tenant-logo.service';
import { SettingsService } from '../../src/services/settings.service';

const TENANT = 'tenant-1';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function makeService(current: Record<string, unknown> = {}) {
  const service = new TenantLogoService(null as any, TENANT);
  const getSettings = vi.spyOn(SettingsService.prototype, 'getSettings').mockResolvedValue(current as any);
  const updateSettings = vi
    .spyOn(SettingsService.prototype, 'updateSettings')
    .mockImplementation(async (input) => ({ ...current, ...input }) as any);
  const unsetKeys = vi.spyOn(SettingsService.prototype, 'unsetKeys').mockResolvedValue({} as any);
  return { service, getSettings, updateSettings, unsetKeys };
}

beforeEach(() => {
  vi.restoreAllMocks();
  storage.upload.mockReset().mockResolvedValue({ error: null });
  storage.remove.mockReset().mockResolvedValue({ error: null });
  storage.getPublicUrl.mockReset().mockImplementation((path: string) => ({
    data: { publicUrl: `https://cdn.test/tenant-logos/${path}` },
  }));
});

describe('detectLogoType', () => {
  it('recognizes PNG, JPEG and WebP', () => {
    expect(detectLogoType(PNG)?.ext).toBe('png');
    expect(detectLogoType(JPEG)?.ext).toBe('jpg');
    expect(detectLogoType(WEBP)?.ext).toBe('webp');
  });

  it('rejects SVG and unknown bytes', () => {
    expect(detectLogoType(SVG)).toBeNull();
    expect(detectLogoType(Buffer.from('%PDF-1.4'))).toBeNull();
  });
});

describe('TenantLogoService.uploadLogo', () => {
  it('rejects an empty or oversized image', async () => {
    const { service } = makeService();
    await expect(service.uploadLogo('')).rejects.toThrow(/2 MB/);
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_LOGO_BYTES)]).toString('base64');
    await expect(service.uploadLogo(big)).rejects.toThrow(/2 MB/);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects non-image bytes such as SVG', async () => {
    const { service } = makeService();
    await expect(service.uploadLogo(SVG.toString('base64'))).rejects.toThrow(/PNG, JPEG or WebP/);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('uploads under the tenant folder and saves the public URL', async () => {
    const { service, updateSettings } = makeService();
    const settings = await service.uploadLogo(PNG.toString('base64'));

    const [path, , options] = storage.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${TENANT}/logo-\\d+\\.png$`));
    expect(options.contentType).toBe('image/png');
    expect(updateSettings).toHaveBeenCalledWith({
      logo_url: `https://cdn.test/tenant-logos/${path}`,
      logo_path: path,
    });
    expect(settings.logo_path).toBe(path);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('removes the previous logo after a replace', async () => {
    const { service } = makeService({ logo_path: `${TENANT}/logo-1.png` });
    await service.uploadLogo(JPEG.toString('base64'));
    expect(storage.remove).toHaveBeenCalledWith([`${TENANT}/logo-1.png`]);
  });

  it('never removes a file outside the tenant folder', async () => {
    const { service } = makeService({ logo_path: 'other-tenant/logo-1.png' });
    await service.uploadLogo(PNG.toString('base64'));
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('cleans up the uploaded file when saving settings fails', async () => {
    const { service, updateSettings } = makeService();
    updateSettings.mockRejectedValue(new Error('db down'));
    await expect(service.uploadLogo(PNG.toString('base64'))).rejects.toThrow('db down');
    const [path] = storage.upload.mock.calls[0];
    expect(storage.remove).toHaveBeenCalledWith([path]);
  });

  it('fails when storage rejects the upload', async () => {
    const { service, updateSettings } = makeService();
    storage.upload.mockResolvedValue({ error: { message: 'bucket missing' } });
    await expect(service.uploadLogo(PNG.toString('base64'))).rejects.toThrow(/bucket missing/);
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe('TenantLogoService.removeLogo', () => {
  it('clears both keys and deletes the file', async () => {
    const { service, unsetKeys } = makeService({ logo_url: 'x', logo_path: `${TENANT}/logo-1.png` });
    await service.removeLogo();
    expect(unsetKeys).toHaveBeenCalledWith(['logo_url', 'logo_path']);
    expect(storage.remove).toHaveBeenCalledWith([`${TENANT}/logo-1.png`]);
  });

  it('clears a URL-only logo without touching storage', async () => {
    const { service, unsetKeys } = makeService({ logo_url: 'https://elsewhere/logo.png' });
    await service.removeLogo();
    expect(unsetKeys).toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
