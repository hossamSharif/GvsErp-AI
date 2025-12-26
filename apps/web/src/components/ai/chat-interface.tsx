'use client';

/**
 * Chat Interface Component
 * Main chat UI with message display and streaming responses
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2, AlertCircle, Paperclip, File, CheckCircle, XCircle } from 'lucide-react';
import { useMessages, useSendMessage } from '@/hooks/use-ai-conversation';
import { useAIPanelStore } from '@/stores/ai-panel-store';
import { useTasks, useApproveTask, useRejectTask, useExecuteTask } from '@/hooks/use-ai-tasks';
import { useConversationDocuments } from '@/hooks/use-ai-documents';
import { TaskPreview } from './task-preview';
import { DocumentUpload } from './document-upload';
import { ReportDisplay, ReportData } from './report-display';
import { cn } from '@/lib/utils';
import type { Message, Task } from '@erp-saas/shared';

interface ChatInterfaceProps {
  conversationId: string;
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const t = useTranslations('ai.chat');
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<{
    isRetrying: boolean;
    attemptNumber: number;
    maxAttempts: number;
    nextRetryIn?: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messagesData, isLoading } = useMessages(conversationId);
  const { sendMessage } = useSendMessage(conversationId);
  const { isStreaming, setStreaming } = useAIPanelStore();

  // Fetch tasks for this conversation
  const { data: tasksData } = useTasks({ limit: 50 });
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();
  const executeTask = useExecuteTask();

  // Fetch documents for this conversation
  const { data: documents = [] } = useConversationDocuments(conversationId);

  const messages = messagesData?.data || [];
  const allTasks = tasksData?.tasks || [];

  // Group tasks by message ID for display
  const tasksByMessage = allTasks.reduce((acc, task) => {
    if (!acc[task.messageId]) {
      acc[task.messageId] = [];
    }
    acc[task.messageId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingText]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

    const messageContent = input.trim();
    setInput('');
    setStreamingText('');
    setStreaming(true);
    setError(null);
    setRetryStatus(null);

    sendMessage(
      { content: messageContent },
      (text) => {
        // Handle streaming chunk
        setStreamingText((prev) => prev + text);
        setError(null); // Clear any previous errors on success
      },
      () => {
        // Handle completion
        setStreaming(false);
        setStreamingText('');
        setRetryStatus(null);
      },
      (error: any) => {
        // Handle error
        console.error('Streaming error:', error);
        setStreaming(false);
        setStreamingText('');

        // Parse error response
        const errorData = error?.response?.data?.error || error;
        const errorMessage = errorData?.message || error?.message || 'An unexpected error occurred';
        const errorCode = errorData?.code;
        const isRetryable = errorData?.isRetryable || false;

        // Set user-friendly error message
        setError(getUserFriendlyError(errorCode, errorMessage));

        // Handle retry status if retryable
        if (isRetryable && errorData?.metadata?.attemptNumber) {
          setRetryStatus({
            isRetrying: true,
            attemptNumber: errorData.metadata.attemptNumber,
            maxAttempts: errorData.metadata.maxAttempts || 3,
            nextRetryIn: errorData.metadata.retryDelay,
          });
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      await approveTask.mutateAsync(taskId);
    } catch (error) {
      console.error('Error approving task:', error);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      await rejectTask.mutateAsync(taskId);
    } catch (error) {
      console.error('Error rejecting task:', error);
    }
  };

  const handleExecuteTask = async (task: Task) => {
    try {
      await executeTask.mutateAsync(task.id);
    } catch (error) {
      console.error('Error executing task:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && !streamingText && (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('welcome')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t('welcomeMessage')}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="space-y-3">
              <MessageBubble message={message} />

              {/* Display tasks associated with this message */}
              {tasksByMessage[message.id]?.map((task) => (
                <div key={task.id} className="ml-11">
                  <TaskPreview
                    task={task}
                    onApprove={handleApproveTask}
                    onReject={handleRejectTask}
                    onExecute={handleExecuteTask}
                    isLoading={
                      approveTask.isPending ||
                      rejectTask.isPending ||
                      executeTask.isPending
                    }
                  />
                </div>
              ))}
            </div>
          ))}

          {/* Error Notification */}
          {error && (
            <div className="flex gap-3 items-start p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  Error
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                {retryStatus && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    The system will automatically retry this request.
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="flex-shrink-0"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Retry Status Display */}
          {retryStatus && retryStatus.isRetrying && (
            <div className="flex gap-3 items-start p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Retrying...
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Attempt {retryStatus.attemptNumber} of {retryStatus.maxAttempts}
                </p>
                {retryStatus.nextRetryIn && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Next retry in {Math.round(retryStatus.nextRetryIn / 1000)} seconds
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Streaming message */}
          {streamingText && (
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {streamingText}
                  <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-1" />
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t space-y-3">
        {/* Document Upload Section */}
        {showDocumentUpload && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <DocumentUpload
              conversationId={conversationId}
              onUploadSuccess={(doc) => {
                console.log('Document uploaded:', doc);
              }}
              onUploadError={(error) => {
                console.error('Upload error:', error);
              }}
            />
          </div>
        )}

        {/* Documents Status */}
        {documents.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border',
                  doc.processing_status === 'completed' && 'bg-green-50 border-green-200 text-green-700',
                  doc.processing_status === 'failed' && 'bg-red-50 border-red-200 text-red-700',
                  (doc.processing_status === 'pending' || doc.processing_status === 'processing') &&
                    'bg-blue-50 border-blue-200 text-blue-700'
                )}
              >
                <File className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{doc.file_name}</span>
                {doc.processing_status === 'completed' && <CheckCircle className="h-3 w-3" />}
                {doc.processing_status === 'failed' && <XCircle className="h-3 w-3" />}
                {(doc.processing_status === 'pending' || doc.processing_status === 'processing') && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDocumentUpload(!showDocumentUpload)}
            className="flex-shrink-0"
            title={t('upload_document')}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            disabled={isStreaming}
            className="min-h-[60px] max-h-[120px] resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-[60px] w-[60px] flex-shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('hint')}
        </p>
      </div>
    </div>
  );
}

/**
 * Get user-friendly error message based on error code
 */
function getUserFriendlyError(errorCode?: string, defaultMessage?: string): string {
  const errorMessages: Record<string, string> = {
    MODEL_UNAVAILABLE: 'The AI service is temporarily unavailable. Please try again in a moment.',
    MODEL_OVERLOADED: 'The AI service is experiencing high demand. Please try again shortly.',
    RATE_LIMIT_EXCEEDED: 'You\'ve sent too many requests. Please wait a moment before trying again.',
    USAGE_LIMIT_EXCEEDED: 'You\'ve reached your usage limit. Upgrade to premium for unlimited access.',
    TIER_LIMIT_EXCEEDED: 'You\'ve reached your plan limit. Upgrade to continue using this feature.',
    PERMISSION_DENIED: 'You don\'t have permission to access this data.',
    CONTEXT_LENGTH_EXCEEDED: 'Your conversation is too long. Please start a new conversation.',
    INVALID_REQUEST: 'Invalid request. Please rephrase your question and try again.',
    CONTENT_FILTER: 'Your message was flagged by content filters. Please rephrase.',
    DATA_ACCESS_ERROR: 'Unable to access the requested data. Please try again.',
    TIMEOUT: 'Request timed out. Please try again.',
  };

  if (errorCode && errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }

  return defaultMessage || 'An unexpected error occurred. Please try again.';
}

/**
 * Check if message content is a report
 * Reports are detected by checking for markdown headings and tables
 */
function detectReport(content: string): ReportData | null {
  const lowerContent = content.toLowerCase();

  // Check if this looks like a report (has headings and possibly tables)
  const hasHeadings = /^#{1,3}\s+/m.test(content);
  const hasTables = /\|.*\|/m.test(content);

  if (!hasHeadings && !hasTables) {
    return null;
  }

  // Detect report type from content
  let type: ReportData['type'] = 'general';
  if (lowerContent.includes('sales') || lowerContent.includes('revenue')) {
    type = 'sales';
  } else if (lowerContent.includes('inventory') || lowerContent.includes('stock')) {
    type = 'inventory';
  } else if (lowerContent.includes('financial') || lowerContent.includes('balance sheet')) {
    type = 'financial';
  } else if (lowerContent.includes('customer')) {
    type = 'customer';
  }

  return {
    type,
    formattedReport: content,
    generatedAt: new Date().toISOString(),
  };
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const report = !isUser ? detectReport(message.content) : null;

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className="flex-shrink-0">
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center',
            isUser
              ? 'bg-muted'
              : 'bg-primary'
          )}
        >
          {isUser ? (
            <User className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Bot className="h-4 w-4 text-primary-foreground" />
          )}
        </div>
      </div>
      <div className={cn('flex-1 space-y-2', isUser && 'text-right')}>
        {report ? (
          <ReportDisplay report={report} />
        ) : (
          <div
            className={cn(
              'inline-block rounded-lg px-4 py-2',
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted prose prose-sm dark:prose-invert max-w-none'
            )}
          >
            {message.content}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
