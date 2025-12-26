'use client';

/**
 * AI Tasks Hooks
 * TanStack Query hooks for AI-generated tasks management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type {
  Task,
  TaskWithDetails,
  ListTasksParams,
  ListTasksResponse,
  ApprovalStatus,
} from '@erp-saas/shared';
import { apiClient } from '@/lib/api-client';

/**
 * Query key factory for AI tasks
 */
export const aiTasksKeys = {
  all: ['ai-tasks'] as const,
  lists: () => [...aiTasksKeys.all, 'list'] as const,
  list: (params: ListTasksParams) => [...aiTasksKeys.lists(), params] as const,
  details: () => [...aiTasksKeys.all, 'detail'] as const,
  detail: (id: string) => [...aiTasksKeys.details(), id] as const,
};

/**
 * Hook to fetch tasks list with filters
 */
export function useTasks(params: ListTasksParams = {}) {
  return useQuery<ListTasksResponse>({
    queryKey: aiTasksKeys.list(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      if (params.approvalStatus) {
        queryParams.append('approvalStatus', params.approvalStatus);
      }
      if (params.taskType) {
        queryParams.append('taskType', params.taskType);
      }
      if (params.limit) {
        queryParams.append('limit', params.limit.toString());
      }
      if (params.offset) {
        queryParams.append('offset', params.offset.toString());
      }

      const response = await apiClient.get(
        `/api/v1/ai/tasks?${queryParams.toString()}`
      );
      return response.data;
    },
  });
}

/**
 * Hook to fetch a single task by ID
 */
export function useTask(taskId: string | null) {
  return useQuery<TaskWithDetails>({
    queryKey: aiTasksKeys.detail(taskId || ''),
    queryFn: async () => {
      if (!taskId) {
        throw new Error('Task ID is required');
      }
      const response = await apiClient.get(`/api/v1/ai/tasks/${taskId}`);
      return response.data;
    },
    enabled: !!taskId,
  });
}

/**
 * Hook to update task approval status
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { taskId: string; approvalStatus: ApprovalStatus }>({
    mutationFn: async ({ taskId, approvalStatus }) => {
      const response = await apiClient.patch(`/api/v1/ai/tasks/${taskId}`, {
        approvalStatus,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate tasks list queries
      queryClient.invalidateQueries({ queryKey: aiTasksKeys.lists() });

      // Invalidate specific task detail
      queryClient.invalidateQueries({ queryKey: aiTasksKeys.detail(variables.taskId) });

      // Update the task in the cache optimistically
      queryClient.setQueryData<TaskWithDetails>(
        aiTasksKeys.detail(variables.taskId),
        (old) => {
          if (old) {
            return { ...old, approvalStatus: variables.approvalStatus };
          }
          return old;
        }
      );
    },
  });
}

/**
 * Hook to execute an approved task
 */
export function useExecuteTask() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<
    { task: Task; redirectUrl: string; formData: Record<string, any> },
    Error,
    string
  >({
    mutationFn: async (taskId: string) => {
      const response = await apiClient.post(`/api/v1/ai/tasks/${taskId}/execute`);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: aiTasksKeys.lists() });

      // Navigate to the form page with pre-filled data
      // Store the form data in sessionStorage for the form to pick up
      sessionStorage.setItem('ai-task-data', JSON.stringify({
        taskId: data.task.id,
        formData: data.formData,
      }));

      // Navigate to the form
      router.push(data.redirectUrl);
    },
  });
}

/**
 * Hook to mark task as executed after form submission
 */
export function useMarkTaskExecuted() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { taskId: string; resultId: string }>({
    mutationFn: async ({ taskId, resultId }) => {
      const response = await apiClient.post(
        `/api/v1/ai/tasks/${taskId}/mark-executed`,
        { resultId }
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: aiTasksKeys.lists() });

      // Invalidate specific task
      queryClient.invalidateQueries({ queryKey: aiTasksKeys.detail(variables.taskId) });

      // Clear sessionStorage
      sessionStorage.removeItem('ai-task-data');
    },
  });
}

/**
 * Hook to get pending tasks count
 */
export function usePendingTasksCount() {
  const { data } = useTasks({ approvalStatus: 'pending', limit: 1 });
  return data?.total || 0;
}

/**
 * Hook to approve a task
 */
export function useApproveTask() {
  const updateStatus = useUpdateTaskStatus();

  return useMutation<Task, Error, string>({
    mutationFn: async (taskId: string) => {
      return updateStatus.mutateAsync({
        taskId,
        approvalStatus: 'approved',
      });
    },
  });
}

/**
 * Hook to reject a task
 */
export function useRejectTask() {
  const updateStatus = useUpdateTaskStatus();

  return useMutation<Task, Error, string>({
    mutationFn: async (taskId: string) => {
      return updateStatus.mutateAsync({
        taskId,
        approvalStatus: 'rejected',
      });
    },
  });
}
