'use client';

/**
 * Accounting Settings Page
 *
 * Lets the user map the semantic auto-posting roles (cash_in_hand,
 * accounts_receivable, sales_revenue, ...) to ledger accounts in the chart
 * of accounts. Backed by /accounting/defaults.
 */

import { useTranslations } from 'next-intl';
import {
  useAccountingDefaults,
  useSetAccountingDefault,
  useAccountingStatus,
  useCogsFlag,
  useSetCogsFlag,
  type AccountingDefaultRole,
} from '@/hooks/use-accounting';
import { useAccounts } from '@/hooks/use-accounts';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Account } from '@erp/shared';

const SENTINEL_UNSET = '__unset__';

export default function AccountingSettingsPage() {
  const t = useTranslations('accounting');
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useAccountingStatus();
  const { data: defaultsData, isLoading: defaultsLoading } = useAccountingDefaults();
  const { data: accounts, isLoading: accountsLoading } = useAccounts({ tree: false });
  const setDefault = useSetAccountingDefault();
  const { data: cogsFlag } = useCogsFlag();
  const setCogsMutation = useSetCogsFlag();

  const isActivated = status?.is_activated ?? false;

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isActivated) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t('notActivated.title')}</CardTitle>
            <CardDescription>{t('notActivated.description')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSelect = async (role: AccountingDefaultRole, accountId: string) => {
    if (accountId === SENTINEL_UNSET) return;
    try {
      await setDefault.mutateAsync({ role, accountId });
      toast({ title: t('settings.defaults.updateSuccess') });
    } catch (error) {
      toast({
        title: t('settings.defaults.updateError'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const accountList: Account[] = accounts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.cogs.title')}</CardTitle>
          <CardDescription>{t('settings.cogs.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('settings.cogs.toggleLabel')}</p>
              <p className="text-xs text-muted-foreground">
                {t('settings.cogs.toggleHint')}
              </p>
            </div>
            <Switch
              checked={cogsFlag?.enabled ?? false}
              disabled={setCogsMutation.isPending}
              onCheckedChange={async (checked) => {
                try {
                  await setCogsMutation.mutateAsync(checked);
                  toast({
                    title: checked
                      ? t('settings.cogs.enabledToast')
                      : t('settings.cogs.disabledToast'),
                  });
                } catch (error) {
                  toast({
                    title: t('settings.cogs.errorToast'),
                    description:
                      error instanceof Error ? error.message : undefined,
                    variant: 'destructive',
                  });
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.defaults.title')}</CardTitle>
          <CardDescription>{t('settings.defaults.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {defaultsLoading || accountsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="divide-y">
              {(defaultsData?.roles ?? []).map((role) => {
                const currentId = defaultsData?.mapping?.[role];
                return (
                  <div
                    key={role}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {t(`settings.roles.${role}`)}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{role}</div>
                    </div>
                    <div className="w-72">
                      <Select
                        value={currentId ?? SENTINEL_UNSET}
                        onValueChange={(value) => handleSelect(role, value)}
                        disabled={setDefault.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('settings.defaults.selectAccount')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SENTINEL_UNSET} disabled>
                            {t('settings.defaults.notSet')}
                          </SelectItem>
                          {accountList.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              <span className="font-mono text-xs mr-2">{account.code}</span>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
