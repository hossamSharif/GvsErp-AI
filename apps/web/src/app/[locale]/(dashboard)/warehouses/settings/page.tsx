'use client';

/**
 * Warehouse Settings Page
 *
 * Configuration page for warehouse-related settings including low stock alerts.
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { LowStockConfig } from '@/components/forms/low-stock-config';

export default function WarehouseSettingsPage() {
  const t = useTranslations('warehouses');
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/warehouses')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
          <p className="text-muted-foreground">{t('settingsDescription')}</p>
        </div>
      </div>

      {/* Low Stock Configuration */}
      <LowStockConfig />
    </div>
  );
}
