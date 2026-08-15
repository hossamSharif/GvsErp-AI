'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type StatementRange = {
  dateFrom?: string;
  dateTo?: string;
};

export type StatementRangePreset = 'all' | 'thisMonth' | 'last90' | 'thisYear' | 'custom';

const iso = (d: Date) => d.toISOString().split('T')[0];

/**
 * All time deliberately sends nothing: the API widens an absent range to
 * 1900-01-01 / 2099-12-31, which is what makes the statement's closing balance
 * equal the party's stored balance exactly — future-dated documents included.
 */
export function rangeForPreset(preset: StatementRangePreset): StatementRange {
  const now = new Date();

  switch (preset) {
    case 'thisMonth':
      return {
        dateFrom: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        dateTo: iso(now),
      };
    case 'last90':
      return {
        dateFrom: iso(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
        dateTo: iso(now),
      };
    case 'thisYear':
      return { dateFrom: iso(new Date(now.getFullYear(), 0, 1)), dateTo: iso(now) };
    case 'all':
    case 'custom':
    default:
      return {};
  }
}

interface StatementDateRangeProps {
  preset: StatementRangePreset;
  range: StatementRange;
  onPresetChange: (preset: StatementRangePreset) => void;
  onRangeChange: (range: StatementRange) => void;
}

/**
 * Period picker for a party statement. Shared by the supplier and customer
 * detail pages, which are otherwise near-duplicates of each other.
 */
export function StatementDateRange({
  preset,
  range,
  onPresetChange,
  onRangeChange,
}: StatementDateRangeProps) {
  const t = useTranslations('parties.detail');

  const handlePreset = useCallback(
    (value: string) => {
      const next = value as StatementRangePreset;
      onPresetChange(next);
      if (next !== 'custom') {
        onRangeChange(rangeForPreset(next));
      }
    },
    [onPresetChange, onRangeChange]
  );

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label>{t('period')}</Label>
        <Select value={preset} onValueChange={handlePreset}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('rangeAllTime')}</SelectItem>
            <SelectItem value="thisMonth">{t('rangeThisMonth')}</SelectItem>
            <SelectItem value="last90">{t('rangeLast90')}</SelectItem>
            <SelectItem value="thisYear">{t('rangeThisYear')}</SelectItem>
            <SelectItem value="custom">{t('rangeCustom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {preset === 'custom' && (
        <>
          <div className="space-y-2">
            <Label>{t('rangeFrom')}</Label>
            <Input
              type="date"
              value={range.dateFrom ?? ''}
              onChange={(e) =>
                onRangeChange({ ...range, dateFrom: e.target.value || undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t('rangeTo')}</Label>
            <Input
              type="date"
              value={range.dateTo ?? ''}
              onChange={(e) => onRangeChange({ ...range, dateTo: e.target.value || undefined })}
            />
          </div>
        </>
      )}
    </div>
  );
}
