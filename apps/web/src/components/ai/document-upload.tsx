'use client';

/**
 * AI Document Upload Component
 * Handles drag-and-drop file upload with validation
 */

import React, { useState, useCallback } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export interface DocumentUploadProps {
  conversationId?: string;
  messageId?: string;
  onUploadSuccess?: (document: any) => void;
  onUploadError?: (error: string) => void;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  conversationId,
  messageId,
  onUploadSuccess,
  onUploadError,
  maxSizeMB = 10,
  allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
}) => {
  const t = useTranslations('ai');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      const allowed = allowedTypes
        .map((type) => type.split('/')[1].toUpperCase())
        .join(', ');
      return `Invalid file type. Allowed: ${allowed}`;
    }

    // Check file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    return null;
  };

  // Upload file
  const uploadFile = async (uploadedFile: UploadedFile) => {
    const formData = new FormData();
    formData.append('file', uploadedFile.file);

    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }
    if (messageId) {
      formData.append('message_id', messageId);
    }

    try {
      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.file === uploadedFile.file
            ? { ...f, status: 'uploading', progress: 0 }
            : f
        )
      );

      // Simulate progress updates (in real implementation, use xhr for progress tracking)
      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === uploadedFile.file && f.progress < 90
              ? { ...f, progress: f.progress + 10 }
              : f
          )
        );
      }, 200);

      const response = await fetch('/api/v1/ai/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const document = await response.json();

      // Update status to success
      setFiles((prev) =>
        prev.map((f) =>
          f.file === uploadedFile.file
            ? { ...f, status: 'success', progress: 100, documentId: document.id }
            : f
        )
      );

      onUploadSuccess?.(document);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed';

      // Update status to error
      setFiles((prev) =>
        prev.map((f) =>
          f.file === uploadedFile.file
            ? { ...f, status: 'error', error: errorMessage }
            : f
        )
      );

      onUploadError?.(errorMessage);
    }
  };

  // Handle file selection
  const handleFiles = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;

      const newFiles: UploadedFile[] = [];

      Array.from(selectedFiles).forEach((file) => {
        const error = validateFile(file);

        if (error) {
          // Add file with error status
          newFiles.push({
            file,
            status: 'error',
            progress: 0,
            error,
          });
          onUploadError?.(error);
        } else {
          // Add file with pending status
          const uploadedFile: UploadedFile = {
            file,
            status: 'pending',
            progress: 0,
          };
          newFiles.push(uploadedFile);

          // Start upload
          uploadFile(uploadedFile);
        }
      });

      setFiles((prev) => [...prev, ...newFiles]);
    },
    [validateFile, uploadFile]
  );

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    handleFiles(droppedFiles);
  };

  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  // Remove file
  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  // Get status icon
  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <Card
        className={cn(
          'border-2 border-dashed p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-gray-400'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-medium">
              {t('document_upload.drop_zone_title')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('document_upload.drop_zone_subtitle')}
            </p>
          </div>
          <div>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept={allowedTypes.join(',')}
              multiple
              onChange={handleFileInputChange}
            />
            <Button asChild variant="outline">
              <label htmlFor="file-upload" className="cursor-pointer">
                {t('document_upload.browse_button')}
              </label>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('document_upload.file_types')}: PDF, PNG, JPG • Max {maxSizeMB}
            MB
          </p>
        </div>
      </Card>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">
            {t('document_upload.uploaded_files')}
          </h4>
          {files.map((uploadedFile, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(uploadedFile.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {uploadedFile.file.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(uploadedFile.file.size)}</span>
                    {uploadedFile.status === 'uploading' && (
                      <span>• {uploadedFile.progress}%</span>
                    )}
                    {uploadedFile.error && (
                      <span className="text-red-500">• {uploadedFile.error}</span>
                    )}
                  </div>
                  {uploadedFile.status === 'uploading' && (
                    <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadedFile.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                {(uploadedFile.status === 'error' ||
                  uploadedFile.status === 'success') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadedFile.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
