'use client';

/**
 * Tenant Logo Field
 *
 * Upload / replace / remove the company logo printed on invoices and POS
 * receipts. Saves immediately (independent of the settings form): the image is
 * downscaled in the browser so PDFs stay light, then sent to POST /settings/logo.
 */

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useRemoveTenantLogo, useUploadTenantLogo } from '@/hooks/use-settings';
import { blobToBase64 } from '@/lib/invoice-pdf-blob';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
/** Longest side after downscaling; plenty for a printed A4 header. */
const MAX_DIMENSION = 600;

/** Downscale to MAX_DIMENSION, keeping transparency (PNG/WebP) or JPEG as-is. */
async function prepareLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 1024 * 1024) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), type, 0.9)
  );
}

interface TenantLogoFieldProps {
  logoUrl?: string;
}

export function TenantLogoField({ logoUrl }: TenantLogoFieldProps) {
  const t = useTranslations('settings.general.company.logo');
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const showError = (description: string) =>
    toast({ title: t('errorTitle'), description, variant: 'destructive' });

  const upload = useUploadTenantLogo({
    onSuccess: () => toast({ title: t('uploadedTitle'), description: t('uploadedDescription') }),
    onError: (error) => showError(error.message || t('failed')),
  });
  const remove = useRemoveTenantLogo({
    onSuccess: () => toast({ title: t('removedTitle') }),
    onError: (error) => showError(error.message || t('failed')),
  });

  const busy = preparing || upload.isPending || remove.isPending;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return showError(t('invalidType'));
    if (file.size > MAX_INPUT_BYTES) return showError(t('tooLarge'));

    setPreparing(true);
    try {
      const blob = await prepareLogo(file);
      upload.mutate(await blobToBase64(blob));
    } catch {
      showError(t('invalidType'));
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">{t('title')}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-md border bg-muted/40 p-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={t('alt')} className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {preparing || upload.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="me-2 h-4 w-4" />
            )}
            {logoUrl ? t('change') : t('upload')}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => setConfirmRemove(true)}
            >
              {remove.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="me-2 h-4 w-4" />
              )}
              {t('remove')}
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{t('hint')}</p>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('removeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>{t('remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
