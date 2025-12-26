'use client';

/**
 * Logo Upload Component
 *
 * Single-image upload for company logo:
 * - Drag-and-drop support
 * - Preview with remove functionality
 * - Supabase Storage integration
 * - 2MB max file size
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
  Loader2,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface LogoUploadProps {
  /** Current logo URL */
  value: string | null;
  /** Callback when logo changes */
  onChange: (url: string | null) => void;
  /** Maximum file size in MB */
  maxSizeMB?: number;
  /** Whether upload is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_SIZE_MB = 2;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
const BUCKET = 'company-logos';

// =============================================================================
// COMPONENT
// =============================================================================

export function LogoUpload({
  value,
  onChange,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  disabled = false,
  className,
}: LogoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Generate unique file name with tenant prefix
  const generateFileName = useCallback((file: File) => {
    const ext = file.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `logo-${timestamp}-${random}.${ext}`;
  }, []);

  // Delete existing logo from storage
  const deleteExistingLogo = useCallback(
    async (url: string) => {
      try {
        // Extract path from URL
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/company-logos\/(.+)/);
        if (pathMatch && pathMatch[1]) {
          await supabase.storage.from(BUCKET).remove([pathMatch[1]]);
        }
      } catch (err) {
        console.error('Failed to delete old logo:', err);
      }
    },
    [supabase]
  );

  // Upload file
  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      const fileName = generateFileName(file);

      try {
        // Delete existing logo first if present
        if (value) {
          await deleteExistingLogo(value);
        }

        const { data, error } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          throw error;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(data.path);

        return urlData.publicUrl;
      } catch (err) {
        console.error('Upload error:', err);
        return null;
      }
    },
    [supabase, generateFileName, value, deleteExistingLogo]
  );

  // Handle file selection
  const handleFile = useCallback(
    async (file: File) => {
      if (disabled) return;

      setError(null);

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Validate file size
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        setError(`File size must be less than ${maxSizeMB}MB`);
        return;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate progress (Supabase doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 150);

      const url = await uploadFile(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Small delay before completing
      await new Promise((resolve) => setTimeout(resolve, 300));

      setIsUploading(false);
      setUploadProgress(0);
      URL.revokeObjectURL(preview);
      setPreviewUrl(null);

      if (url) {
        onChange(url);
      } else {
        setError('Upload failed. Please try again.');
      }
    },
    [disabled, maxSizeMB, uploadFile, onChange]
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
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  // Handle file input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
      // Reset input
      e.target.value = '';
    },
    [handleFile]
  );

  // Remove logo
  const handleRemove = useCallback(async () => {
    if (value) {
      await deleteExistingLogo(value);
    }
    onChange(null);
  }, [value, deleteExistingLogo, onChange]);

  // Displayed image (either current value, preview during upload, or none)
  const displayedImage = isUploading ? previewUrl : value;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Logo Preview */}
      {displayedImage ? (
        <div className="relative w-32 h-32">
          <div className="w-full h-full rounded-lg border-2 border-muted overflow-hidden bg-muted">
            <img
              src={displayedImage}
              alt="Company logo"
              className={cn(
                'w-full h-full object-contain',
                isUploading && 'opacity-50'
              )}
            />
          </div>

          {/* Upload Progress Overlay */}
          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-white mb-2" />
              <Progress value={uploadProgress} className="w-3/4 h-1" />
            </div>
          )}

          {/* Remove Button */}
          {!isUploading && !disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
              title="Remove logo"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ) : (
        /* Drop Zone */
        <div
          className={cn(
            'w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled}
          />
          <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground text-center px-2">
            Drop logo or click
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-muted-foreground">
        Max {maxSizeMB}MB. Supported: JPEG, PNG, WebP, GIF
      </p>
    </div>
  );
}
