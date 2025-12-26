'use client';

/**
 * Task Preview Component
 * Displays AI-generated tasks with approval workflow
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Task, TaskType } from '@erp-saas/shared';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import {
  FileText,
  ShoppingCart,
  DollarSign,
  BookOpen,
  Package,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

interface TaskPreviewProps {
  task: Task;
  onApprove?: (taskId: string) => void | Promise<void>;
  onReject?: (taskId: string) => void | Promise<void>;
  onExecute?: (task: Task) => void | Promise<void>;
  isLoading?: boolean;
}

/**
 * Get task type icon
 */
function getTaskIcon(taskType: TaskType): React.ReactNode {
  const iconProps = { className: 'w-5 h-5' };

  switch (taskType) {
    case 'invoice':
      return <FileText {...iconProps} />;
    case 'purchase_order':
      return <ShoppingCart {...iconProps} />;
    case 'sales_order':
      return <Package {...iconProps} />;
    case 'payment':
      return <DollarSign {...iconProps} />;
    case 'journal_entry':
      return <BookOpen {...iconProps} />;
    default:
      return <FileText {...iconProps} />;
  }
}

/**
 * Get task type label
 */
function getTaskTypeLabel(taskType: TaskType): string {
  const labels: Record<TaskType, string> = {
    invoice: 'Sales Invoice',
    purchase_order: 'Purchase Order',
    sales_order: 'Sales Order',
    payment: 'Payment',
    journal_entry: 'Journal Entry',
  };

  return labels[taskType];
}

/**
 * Format generated data for display
 */
function formatTaskData(taskType: TaskType, data: Record<string, any>): React.ReactNode {
  switch (taskType) {
    case 'invoice':
    case 'purchase_order':
    case 'sales_order':
      return (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Customer/Supplier:</span>
            <span className="font-medium">{data.party_name || data.customer_name || data.supplier_name}</span>
          </div>
          {data.invoice_date && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date:</span>
              <span>{data.invoice_date || data.order_date}</span>
            </div>
          )}
          {data.items && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground mb-2">Items ({data.items.length}):</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {data.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{item.item_name || item.name}</span>
                    <span className="font-medium">
                      {item.quantity} × {item.unit_price || item.price}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.notes && (
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Notes:</span>
              <p className="text-xs text-muted-foreground mt-1">{data.notes}</p>
            </div>
          )}
        </div>
      );

    case 'payment':
      return (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Party:</span>
            <span className="font-medium">{data.party_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-bold text-lg">{data.amount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Type:</span>
            <span className="capitalize">{data.payment_type}</span>
          </div>
          {data.payment_method && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Method:</span>
              <span className="capitalize">{data.payment_method.replace('_', ' ')}</span>
            </div>
          )}
          {data.payment_date && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date:</span>
              <span>{data.payment_date}</span>
            </div>
          )}
          {data.reference && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reference:</span>
              <span>{data.reference}</span>
            </div>
          )}
        </div>
      );

    case 'journal_entry':
      return (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Description:</span>
            <span className="font-medium">{data.description}</span>
          </div>
          {data.entry_date && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date:</span>
              <span>{data.entry_date}</span>
            </div>
          )}
          {data.lines && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground mb-2">Journal Lines:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {data.lines.map((line: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{line.account_code}</span>
                    <span className="font-medium">
                      {line.debit > 0 ? `Dr ${line.debit}` : `Cr ${line.credit}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    default:
      return <pre className="text-xs overflow-auto max-h-32">{JSON.stringify(data, null, 2)}</pre>;
  }
}

/**
 * Task Preview Component
 */
export function TaskPreview({
  task,
  onApprove,
  onReject,
  onExecute,
  isLoading = false,
}: TaskPreviewProps) {
  const router = useRouter();
  const t = useTranslations('ai');

  const handleApprove = async () => {
    if (onApprove) {
      await onApprove(task.id);
    }
  };

  const handleReject = async () => {
    if (onReject) {
      await onReject(task.id);
    }
  };

  const handleExecute = async () => {
    if (onExecute) {
      await onExecute(task);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTaskIcon(task.taskType)}
            <CardTitle className="text-base">{getTaskTypeLabel(task.taskType)}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {task.approvalStatus === 'pending' && (
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                Pending Approval
              </span>
            )}
            {task.approvalStatus === 'approved' && (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                Approved
              </span>
            )}
            {task.approvalStatus === 'rejected' && (
              <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                Rejected
              </span>
            )}
            {task.approvalStatus === 'executed' && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                Executed
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          AI-generated transaction • {new Date(task.createdAt).toLocaleString()}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {formatTaskData(task.taskType, task.generatedData)}
      </CardContent>

      <CardFooter className="flex justify-end gap-2 pt-3 border-t">
        {task.approvalStatus === 'pending' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Reject
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleApprove}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Approve
            </Button>
          </>
        )}

        {task.approvalStatus === 'approved' && (
          <Button
            variant="default"
            size="sm"
            onClick={handleExecute}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create {getTaskTypeLabel(task.taskType)}
          </Button>
        )}

        {task.approvalStatus === 'executed' && task.resultId && (
          <Button variant="link" size="sm" asChild>
            <a href={`#${task.resultId}`}>View Transaction</a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default TaskPreview;
