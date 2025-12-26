'use client';

/**
 * AI Task Data Hook
 * Hook to retrieve and clear AI-generated task data from sessionStorage
 */

import { useEffect, useState } from 'react';
import { useMarkTaskExecuted } from './use-ai-tasks';

interface AITaskData {
  taskId: string;
  formData: Record<string, any>;
}

/**
 * Hook to get AI task data for form pre-filling
 * @returns AI task data if available, null otherwise
 */
export function useAITaskData() {
  const [taskData, setTaskData] = useState<AITaskData | null>(null);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const markExecuted = useMarkTaskExecuted();

  useEffect(() => {
    // Check sessionStorage for AI task data
    const data = sessionStorage.getItem('ai-task-data');
    if (data) {
      try {
        const parsed = JSON.parse(data) as AITaskData;
        setTaskData(parsed);
        setIsAIGenerated(true);
      } catch (error) {
        console.error('Error parsing AI task data:', error);
        sessionStorage.removeItem('ai-task-data');
      }
    }
  }, []);

  /**
   * Mark the task as executed after form submission
   * @param resultId - ID of the created transaction
   */
  const markTaskExecuted = async (resultId: string) => {
    if (taskData?.taskId) {
      try {
        await markExecuted.mutateAsync({
          taskId: taskData.taskId,
          resultId,
        });
      } catch (error) {
        console.error('Error marking task as executed:', error);
      }
    }
  };

  /**
   * Clear the AI task data from sessionStorage
   */
  const clearTaskData = () => {
    sessionStorage.removeItem('ai-task-data');
    setTaskData(null);
    setIsAIGenerated(false);
  };

  return {
    taskData,
    formData: taskData?.formData || null,
    isAIGenerated,
    markTaskExecuted,
    clearTaskData,
  };
}
