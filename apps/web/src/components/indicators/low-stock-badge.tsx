'use client';

/**
 * Low Stock Badge Component
 *
 * Reusable badge component for indicating low stock status with severity levels.
 */

import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type StockSeverity = 'critical' | 'warning' | 'low' | 'ok' | 'no-threshold';

interface LowStockBadgeProps {
  quantity: number;
  threshold: number | null;
  showTooltip?: boolean;
  compact?: boolean;
  className?: string;
}

export function getStockSeverity(
  quantity: number,
  threshold: number | null
): StockSeverity {
  if (!threshold) return 'no-threshold';

  const percentOfThreshold = (quantity / threshold) * 100;

  if (percentOfThreshold > 100) return 'ok';
  if (percentOfThreshold < 25) return 'critical';
  if (percentOfThreshold < 50) return 'warning';
  return 'low';
}

const severityConfig: Record<
  StockSeverity,
  {
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
  }
> = {
  critical: {
    label: 'Critical - Stock critically low',
    shortLabel: 'Critical',
    icon: AlertCircle,
    variant: 'destructive',
    className: 'bg-red-500/20 text-red-700 border-red-300',
  },
  warning: {
    label: 'Warning - Stock running low',
    shortLabel: 'Warning',
    icon: AlertTriangle,
    variant: 'default',
    className: 'bg-yellow-500/20 text-yellow-700 border-yellow-300',
  },
  low: {
    label: 'Low - Below threshold',
    shortLabel: 'Low',
    icon: AlertTriangle,
    variant: 'secondary',
    className: 'bg-orange-500/20 text-orange-700 border-orange-300',
  },
  ok: {
    label: 'In Stock',
    shortLabel: 'OK',
    icon: CheckCircle,
    variant: 'outline',
    className: 'bg-green-500/10 text-green-700 border-green-300',
  },
  'no-threshold': {
    label: 'No threshold set',
    shortLabel: 'No Threshold',
    icon: AlertTriangle,
    variant: 'secondary',
    className: 'bg-gray-500/10 text-gray-500 border-gray-300',
  },
};

export function LowStockBadge({
  quantity,
  threshold,
  showTooltip = true,
  compact = false,
  className,
}: LowStockBadgeProps) {
  const severity = getStockSeverity(quantity, threshold);
  const config = severityConfig[severity];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant={config.variant}
      className={cn('gap-1', config.className, className)}
    >
      <Icon className={cn('h-3 w-3', compact && 'h-2.5 w-2.5')} />
      {!compact && <span>{config.shortLabel}</span>}
    </Badge>
  );

  if (!showTooltip) return badge;

  const tooltipContent = threshold
    ? `${config.label}\nCurrent: ${quantity.toFixed(2)}\nThreshold: ${threshold.toFixed(2)}\nPercent: ${((quantity / threshold) * 100).toFixed(1)}%`
    : 'No low stock threshold configured';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="whitespace-pre-line">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Stock Level Indicator
 *
 * Visual progress bar showing stock level relative to threshold.
 */
interface StockLevelIndicatorProps {
  quantity: number;
  threshold: number | null;
  className?: string;
}

export function StockLevelIndicator({
  quantity,
  threshold,
  className,
}: StockLevelIndicatorProps) {
  if (!threshold) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No threshold
      </div>
    );
  }

  const percentage = Math.min((quantity / threshold) * 100, 150);
  const severity = getStockSeverity(quantity, threshold);

  const barColorClass = {
    critical: 'bg-red-500',
    warning: 'bg-yellow-500',
    low: 'bg-orange-500',
    ok: 'bg-green-500',
    'no-threshold': 'bg-gray-300',
  }[severity];

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{quantity.toFixed(2)}</span>
        <span>{threshold.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColorClass)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Aggregated Low Stock Summary Badge
 *
 * Shows the number of items with low stock for summary views.
 */
interface LowStockSummaryBadgeProps {
  lowStockCount: number;
  criticalCount?: number;
  className?: string;
}

export function LowStockSummaryBadge({
  lowStockCount,
  criticalCount = 0,
  className,
}: LowStockSummaryBadgeProps) {
  if (lowStockCount === 0) {
    return (
      <Badge variant="outline" className={cn('gap-1', className)}>
        <CheckCircle className="h-3 w-3 text-green-500" />
        All OK
      </Badge>
    );
  }

  if (criticalCount > 0) {
    return (
      <Badge variant="destructive" className={cn('gap-1', className)}>
        <AlertCircle className="h-3 w-3" />
        {criticalCount} Critical / {lowStockCount} Low
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={cn('gap-1 bg-yellow-500/20 text-yellow-700', className)}>
      <AlertTriangle className="h-3 w-3" />
      {lowStockCount} Low Stock
    </Badge>
  );
}
