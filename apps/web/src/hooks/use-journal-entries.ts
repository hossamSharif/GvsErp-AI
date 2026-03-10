/**
 * Journal Entries Hook
 *
 * React Query hooks for journal entry management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  JournalEntry,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  PaginationMeta,
} from '@erp/shared';
import { api } from '@/lib/api-client';

interface JournalEntryFilters {
  start_date?: string;
  end_date?: string;
  is_posted?: boolean;
  source_type?: string;
  account_id?: string;
  page?: number;
  limit?: number;
}

// Query keys
export const journalEntryKeys = {
  all: ['journal-entries'] as const,
  lists: () => [...journalEntryKeys.all, 'list'] as const,
  list: (filters: JournalEntryFilters) => [...journalEntryKeys.lists(), filters] as const,
  details: () => [...journalEntryKeys.all, 'detail'] as const,
  detail: (id: string) => [...journalEntryKeys.details(), id] as const,
};

/**
 * Fetch all journal entries with filters
 */
export function useJournalEntries(filters?: JournalEntryFilters) {
  return useQuery({
    queryKey: journalEntryKeys.list(filters || {}),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters?.start_date) queryParams.append('start_date', filters.start_date);
      if (filters?.end_date) queryParams.append('end_date', filters.end_date);
      if (filters?.is_posted !== undefined) queryParams.append('is_posted', String(filters.is_posted));
      if (filters?.source_type) queryParams.append('source_type', filters.source_type);
      if (filters?.account_id) queryParams.append('account_id', filters.account_id);
      if (filters?.page) queryParams.append('page', String(filters.page));
      if (filters?.limit) queryParams.append('limit', String(filters.limit));

      const response = await api.get<{ data: JournalEntry[]; meta: PaginationMeta }>(
        `/journal-entries?${queryParams.toString()}`
      );
      return response;
    },
  });
}

/**
 * Fetch journal entry by ID
 */
export function useJournalEntry(id: string) {
  return useQuery({
    queryKey: journalEntryKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: JournalEntry }>(
        `/journal-entries/${id}`
      );
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Create journal entry
 */
export function useCreateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateJournalEntryInput) => {
      const response = await api.post<{ data: JournalEntry }>(
        '/journal-entries',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.lists() });
    },
  });
}

/**
 * Update journal entry
 */
export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateJournalEntryInput;
    }) => {
      const response = await api.put<{ data: JournalEntry }>(
        `/journal-entries/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.detail(variables.id) });
    },
  });
}

/**
 * Post journal entry (finalize)
 */
export function usePostJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{ data: JournalEntry }>(
        `/journal-entries/${id}/post`
      );
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.detail(id) });
    },
  });
}

/**
 * Delete journal entry
 */
export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/journal-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalEntryKeys.lists() });
    },
  });
}
