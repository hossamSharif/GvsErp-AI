'use client';

/**
 * TanStack Query hooks for AI document operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as apiClient } from '@/lib/api-client';

export interface Document {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  tenant_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_text: string | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error: string | null;
  created_at: string;
}

/**
 * Upload a document
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      conversationId,
      messageId,
    }: {
      file: File;
      conversationId?: string;
      messageId?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);

      const queryParams = new URLSearchParams();
      if (conversationId) {
        queryParams.append('conversation_id', conversationId);
      }
      if (messageId) {
        queryParams.append('message_id', messageId);
      }

      const url = `/ai/documents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      const response = await fetch(`${apiClient.defaults.baseURL}${url}`, {
        method: 'POST',
        headers: {
          Authorization: apiClient.defaults.headers.common.Authorization as string,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json() as Promise<Document>;
    },
    onSuccess: (data) => {
      // Invalidate conversation documents query
      if (data.conversation_id) {
        queryClient.invalidateQueries({
          queryKey: ['ai-documents', 'conversation', data.conversation_id],
        });
      }
    },
  });
}

/**
 * Get document by ID
 */
export function useDocument(documentId: string | null) {
  return useQuery({
    queryKey: ['ai-documents', documentId],
    queryFn: async () => {
      if (!documentId) return null;

      const response = await apiClient.get<Document>(
        `/ai/documents/${documentId}`
      );
      return response.data;
    },
    enabled: !!documentId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if document is still processing
      const data = query.state.data;
      if (
        data &&
        (data.processing_status === 'pending' ||
          data.processing_status === 'processing')
      ) {
        return 2000;
      }
      return false;
    },
  });
}

/**
 * Get documents by conversation
 */
export function useConversationDocuments(conversationId: string | null) {
  return useQuery({
    queryKey: ['ai-documents', 'conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const response = await apiClient.get<Document[]>('/ai/documents', {
        params: { conversation_id: conversationId },
      });
      return response.data;
    },
    enabled: !!conversationId,
  });
}

/**
 * Delete a document
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/ai/documents/${documentId}`);
    },
    onSuccess: (_, documentId) => {
      // Invalidate all document queries
      queryClient.invalidateQueries({
        queryKey: ['ai-documents'],
      });
    },
  });
}

/**
 * Get document processing status
 * Utility hook that polls for document status until complete
 */
export function useDocumentProcessingStatus(documentId: string | null) {
  const { data: document, isLoading } = useDocument(documentId);

  const isProcessing =
    document &&
    (document.processing_status === 'pending' ||
      document.processing_status === 'processing');

  const isComplete = document && document.processing_status === 'completed';
  const isFailed = document && document.processing_status === 'failed';

  return {
    document,
    isLoading,
    isProcessing,
    isComplete,
    isFailed,
    error: document?.processing_error,
  };
}
