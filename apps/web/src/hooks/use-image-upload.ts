'use client';

/**
 * Hook for uploading images to Supabase Storage.
 *
 * Extracts storage access out of the ImageUpload component
 * so that components remain purely presentational.
 */

import { useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface UseImageUploadOptions {
  bucket?: string;
  pathPrefix?: string;
}

const DEFAULT_BUCKET = 'item-images';

export function useImageUpload({
  bucket = DEFAULT_BUCKET,
  pathPrefix = '',
}: UseImageUploadOptions = {}) {
  const supabaseRef = useRef(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const generateFileName = useCallback(
    (file: File) => {
      const ext = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const prefix = pathPrefix ? `${pathPrefix}/` : '';
      return `${prefix}${timestamp}-${random}.${ext}`;
    },
    [pathPrefix]
  );

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      const fileName = generateFileName(file);
      const supabase = supabaseRef.current;

      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          throw error;
        }

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(data.path);

        return urlData.publicUrl;
      } catch (error) {
        console.error('Upload error:', error);
        return null;
      }
    },
    [bucket, generateFileName]
  );

  return { uploadFile };
}
