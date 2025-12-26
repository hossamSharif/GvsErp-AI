'use client';

/**
 * Usage Indicator Component
 * Displays AI usage limits and current consumption
 */

import { useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Sparkles } from 'lucide-react';
import { useUsageStats, useUpgradeRecommendation, useUsagePercentage } from '@/hooks/use-ai-usage';

export function UsageIndicator() {
  const t = useTranslations('ai');
  const { data: usage, isLoading } = useUsageStats();
  const { data: upgradeRec } = useUpgradeRecommendation();
  const percentage = useUsagePercentage();

  if (isLoading || !usage) {
    return (
      <div className="p-3 border-b">
        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'bg-gray-500';
      case 'basic':
        return 'bg-blue-500';
      case 'professional':
        return 'bg-purple-500';
      case 'enterprise':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 100) return 'text-red-600';
    if (percent >= 80) return 'text-orange-600';
    return 'text-green-600';
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? '∞' : limit.toString();
  };

  return (
    <div className="p-3 border-b space-y-3">
      {/* Tier Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('usage.title')}</span>
        </div>
        <Badge className={getTierBadgeColor(usage.tier)}>
          {usage.tier.toUpperCase()}
        </Badge>
      </div>

      {/* Questions Usage */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t('usage.questions')}</span>
          <span className={getUsageColor(usage.percentages.questions_today)}>
            {usage.today.questions} / {formatLimit(usage.limits.questions_per_day)}
          </span>
        </div>
        {usage.limits.questions_per_day !== -1 && (
          <Progress
            value={usage.percentages.questions_today}
            className="h-1.5"
          />
        )}
      </div>

      {/* Documents Usage */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t('usage.documents')}</span>
          <span className={getUsageColor(usage.percentages.documents_today)}>
            {usage.today.documents} / {formatLimit(usage.limits.documents_per_day)}
          </span>
        </div>
        {usage.limits.documents_per_day !== -1 && (
          <Progress
            value={usage.percentages.documents_today}
            className="h-1.5"
          />
        )}
      </div>

      {/* Upgrade Recommendation */}
      {upgradeRec?.recommend && (
        <div className="p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-xs text-amber-900 dark:text-amber-100">
                {upgradeRec.reason}
              </p>
              {upgradeRec.suggestedTier && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs border-amber-300 dark:border-amber-700"
                >
                  {t('usage.upgrade', { tier: upgradeRec.suggestedTier })}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      {percentage.isNearLimit && (
        <div className="text-xs text-muted-foreground">
          {t('usage.monthly')}: {usage.month.questions} {t('usage.questionsLabel')}
        </div>
      )}
    </div>
  );
}
