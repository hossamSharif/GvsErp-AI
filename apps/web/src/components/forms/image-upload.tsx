'use client';

/**
 * Image Upload Component
 *
 * Drag-and-drop image upload with:
 * - Multiple file support
 * - Preview thumbnails
 * - Supabase Storage integration
 * - Reordering capability
 */

import { useState, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Upload,
  X,
  Image as ImageIcon,
  GripVertical,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface ImageUploadProps {
  /** Current image URLs */
  value: string[];
  /** Callback when images change */
  onChange: (urls: string[]) => void;
  /** Maximum number of images */
  maxImages?: number;
  /** Maximum file size in MB */
  maxSizeMB?: number;
  /** Accepted file types */
  accept?: string;
  /** Storage bucket name */
  bucket?: string;
  /** Storage path prefix */
  pathPrefix?: string;
  /** Whether upload is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  error?: string;
  previewUrl: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_IMAGES = 10;
const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const DEFAULT_BUCKET = 'item-images';

// =============================================================================
// COMPONENT
// =============================================================================

export function ImageUpload({
  value = [],
  onChange,
  maxImages = DEFAULT_MAX_IMAGES,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  accept = DEFAULT_ACCEPT,
  bucket = DEFAULT_BUCKET,
  pathPrefix = '',
  disabled = false,
  className,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Generate unique file name
  const generateFileName = useCallback((file: File) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const prefix = pathPrefix ? `${pathPrefix}/` : '';
    return `${prefix}${timestamp}-${random}.${ext}`;
  }, [pathPrefix]);

  // Upload a single file
  const uploadFile = useCallback(
    async (file: File, uploadId: string): Promise<string | null> => {
      const fileName = generateFileName(file);

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

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(data.path);

        return urlData.publicUrl;
      } catch (error) {
        console.error('Upload error:', error);
        return null;
      }
    },
    [supabase, bucket, generateFileName]
  );

  // Handle file selection
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;

      const fileArray = Array.from(files);
      const remainingSlots = maxImages - value.length;

      if (remainingSlots <= 0) {
        return;
      }

      // Filter and validate files
      const validFiles: File[] = [];
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      for (const file of fileArray.slice(0, remainingSlots)) {
        if (!file.type.startsWith('image/')) {
          continue;
        }
        if (file.size > maxSizeBytes) {
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) return;

      // Create upload entries with previews
      const newUploading: UploadingFile[] = validFiles.map((file) => ({
        id: Math.random().toString(36).substring(2),
        file,
        progress: 0,
        previewUrl: URL.createObjectURL(file),
      }));

      setUploading((prev) => [...prev, ...newUploading]);

      // Upload files
      const uploadPromises = newUploading.map(async (upload) => {
        // Simulate progress (Supabase doesn't provide upload progress)
        const progressInterval = setInterval(() => {
          setUploading((prev) =>
            prev.map((u) =>
              u.id === upload.id && u.progress < 90
                ? { ...u, progress: u.progress + 10 }
                : u
            )
          );
        }, 200);

        const url = await uploadFile(upload.file, upload.id);

        clearInterval(progressInterval);

        if (url) {
          setUploading((prev) =>
            prev.map((u) =>
              u.id === upload.id ? { ...u, progress: 100 } : u
            )
          );

          // Small delay before removing from uploading
          await new Promise((resolve) => setTimeout(resolve, 500));

          return url;
        } else {
          setUploading((prev) =>
            prev.map((u) =>
              u.id === upload.id ? { ...u, error: 'Upload failed' } : u
            )
          );
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUrls = results.filter((url): url is string => url !== null);

      // Update value with new URLs
      if (successfulUrls.length > 0) {
        onChange([...value, ...successfulUrls]);
      }

      // Clean up completed uploads
      setUploading((prev) =>
        prev.filter((u) => !newUploading.some((n) => n.id === u.id && !u.error))
      );

      // Revoke preview URLs
      newUploading.forEach((u) => URL.revokeObjectURL(u.previewUrl));
    },
    [disabled, maxImages, maxSizeMB, value, onChange, uploadFile]
  );

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  // Handle file input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      // Reset input
      e.target.value = '';
    },
    [handleFiles]
  );

  // Remove an image
  const handleRemove = useCallback(
    (index: number) => {
      const newValue = [...value];
      newValue.splice(index, 1);
      onChange(newValue);
    },
    [value, onChange]
  );

  // Reorder images via drag
  const handleImageDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleImageDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      const newValue = [...value];
      const [removed] = newValue.splice(draggedIndex, 1);
      newValue.splice(index, 0, removed);
      onChange(newValue);
      setDraggedIndex(index);
    },
    [draggedIndex, value, onChange]
  );

  const handleImageDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  // Remove failed upload
  const handleRemoveUpload = useCallback((id: string) => {
    setUploading((prev) => {
      const upload = prev.find((u) => u.id === id);
      if (upload) {
        URL.revokeObjectURL(upload.previewUrl);
      }
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const canAddMore = value.length + uploading.length < maxImages;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      {canAddMore && (
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled}
          />
          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop images here, or{' '}
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              browse
            </Button>
          </p>
          <p className="text-xs text-muted-foreground">
            Max {maxSizeMB}MB per file. {maxImages - value.length - uploading.length} slots
            remaining.
          </p>
        </div>
      )}

      {/* Uploading Files */}
      {uploading.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {uploading.map((upload) => (
            <div
              key={upload.id}
              className="relative aspect-square rounded-lg overflow-hidden border bg-muted"
            >
              <img
                src={upload.previewUrl}
                alt="Uploading"
                className="w-full h-full object-cover opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {upload.error ? (
                  <div className="text-center p-2">
                    <AlertCircle className="mx-auto h-6 w-6 text-destructive mb-1" />
                    <p className="text-xs text-destructive">{upload.error}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveUpload(upload.id)}
                      className="mt-1"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="w-3/4">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                    <Progress value={upload.progress} className="h-1" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Images */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {value.map((url, index) => (
            <div
              key={url}
              className={cn(
                'relative aspect-square rounded-lg overflow-hidden border bg-muted group',
                draggedIndex === index && 'opacity-50'
              )}
              draggable
              onDragStart={() => handleImageDragStart(index)}
              onDragOver={(e) => handleImageDragOver(e, index)}
              onDragEnd={handleImageDragEnd}
            >
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Primary Badge */}
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                  Primary
                </div>
              )}

              {/* Actions Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 cursor-grab active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemove(index)}
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {value.length === 0 && uploading.length === 0 && !canAddMore && (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="mx-auto h-10 w-10 opacity-50 mb-2" />
          <p>No images uploaded</p>
        </div>
      )}
    </div>
  );
}
