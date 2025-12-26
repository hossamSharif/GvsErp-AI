/**
 * AI Conversation Hooks
 * TanStack Query hooks for managing AI conversations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Conversation,
  ConversationWithStats,
  CreateConversationRequest,
  UpdateConversationRequest,
  Message,
  SendMessageRequest,
  QueryResult,
  ConsultantRole,
  ConversationStatus,
} from '@erp-saas/shared';

const AI_CONVERSATIONS_KEY = 'ai-conversations';
const AI_MESSAGES_KEY = 'ai-messages';

/**
 * Fetch conversations list
 */
async function fetchConversations(params: {
  status?: ConversationStatus;
  role?: ConsultantRole;
  page?: number;
  limit?: number;
}): Promise<QueryResult<ConversationWithStats>> {
  const { data } = await apiClient.get('/ai/conversations', { params });
  return data;
}

/**
 * Fetch single conversation with stats
 */
async function fetchConversation(
  id: string
): Promise<ConversationWithStats> {
  const { data } = await apiClient.get(`/ai/conversations/${id}`);
  return data;
}

/**
 * Fetch conversation messages
 */
async function fetchMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<{ data: Message[] }> {
  const { data } = await apiClient.get(
    `/ai/conversations/${conversationId}/messages`,
    { params: { limit, before } }
  );
  return data;
}

/**
 * Create new conversation
 */
async function createConversation(
  request: CreateConversationRequest
): Promise<Conversation> {
  const { data } = await apiClient.post('/ai/conversations', request);
  return data;
}

/**
 * Update conversation
 */
async function updateConversation(
  id: string,
  request: UpdateConversationRequest
): Promise<Conversation> {
  const { data } = await apiClient.patch(`/ai/conversations/${id}`, request);
  return data;
}

/**
 * Delete conversation (soft delete)
 */
async function deleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/ai/conversations/${id}`);
}

/**
 * Archive conversation
 */
async function archiveConversation(id: string): Promise<Conversation> {
  const { data } = await apiClient.post(`/ai/conversations/${id}/archive`);
  return data;
}

/**
 * Restore conversation
 */
async function restoreConversation(id: string): Promise<Conversation> {
  const { data } = await apiClient.post(`/ai/conversations/${id}/restore`);
  return data;
}

/**
 * Hook: List conversations
 */
export function useConversations(params?: {
  status?: ConversationStatus;
  role?: ConsultantRole;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [AI_CONVERSATIONS_KEY, params],
    queryFn: () => fetchConversations(params || {}),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook: Get single conversation
 */
export function useConversation(id: string | null) {
  return useQuery({
    queryKey: [AI_CONVERSATIONS_KEY, id],
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
    staleTime: 30000,
  });
}

/**
 * Hook: Get conversation messages
 */
export function useMessages(conversationId: string | null, limit = 50) {
  return useQuery({
    queryKey: [AI_MESSAGES_KEY, conversationId, limit],
    queryFn: () => fetchMessages(conversationId!, limit),
    enabled: !!conversationId,
    staleTime: 10000, // 10 seconds
  });
}

/**
 * Hook: Create conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AI_CONVERSATIONS_KEY] });
    },
  });
}

/**
 * Hook: Update conversation
 */
export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateConversationRequest }) =>
      updateConversation(id, request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [AI_CONVERSATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [AI_CONVERSATIONS_KEY, variables.id] });
    },
  });
}

/**
 * Hook: Delete conversation
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AI_CONVERSATIONS_KEY] });
    },
  });
}

/**
 * Hook: Archive conversation
 */
export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AI_CONVERSATIONS_KEY] });
    },
  });
}

/**
 * Hook: Restore conversation
 */
export function useRestoreConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AI_CONVERSATIONS_KEY] });
    },
  });
}

/**
 * Hook: Send message with SSE streaming
 * Returns EventSource for streaming response
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return {
    sendMessage: (
      message: SendMessageRequest,
      onChunk: (text: string) => void,
      onComplete: () => void,
      onError: (error: Error) => void
    ) => {
      // Use fetch with streaming
      const token = localStorage.getItem('access_token');

      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(message),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No reader available');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.text) {
                    onChunk(data.text);
                  } else if (data.done) {
                    onComplete();
                    // Invalidate queries to refresh messages
                    queryClient.invalidateQueries({ queryKey: [AI_MESSAGES_KEY, conversationId] });
                    queryClient.invalidateQueries({ queryKey: [AI_CONVERSATIONS_KEY] });
                  } else if (data.error) {
                    onError(new Error(data.error));
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }
        })
        .catch(onError);
    },
  };
}
