'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCurrencies } from '@/hooks/use-currencies';

interface CurrencySelectProps {
  value: string | undefined;
  onValueChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const EMPTY_SENTINEL = '__empty__';

export function CurrencySelect({
  value,
  onValueChange,
  placeholder,
  disabled,
  className,
}: CurrencySelectProps) {
  const t = useTranslations('currency');
  const { data, isLoading } = useCurrencies({
    limit: 100,
    sortBy: 'code',
    sortDir: 'asc',
  });

  const currencies = data?.data ?? [];
  const isEmpty = !isLoading && currencies.length === 0;

  return (
    <Select
      value={value || undefined}
      onValueChange={(next) => {
        if (next === EMPTY_SENTINEL) return;
        onValueChange(next);
      }}
      disabled={disabled || isLoading || isEmpty}
    >
      <SelectTrigger className={cn(className)}>
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </span>
        ) : (
          <SelectValue placeholder={placeholder ?? t('placeholder')} />
        )}
      </SelectTrigger>
      <SelectContent>
        {isEmpty ? (
          <SelectItem value={EMPTY_SENTINEL} disabled>
            {t('empty')}
          </SelectItem>
        ) : (
          currencies.map((currency) => (
            <SelectItem key={currency.id} value={currency.code}>
              {currency.code} — {currency.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
