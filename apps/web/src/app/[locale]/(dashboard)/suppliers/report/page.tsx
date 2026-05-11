'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useParties } from '@/hooks/use-parties';
import { downloadCustomerBalancesReport } from '@/components/reports/customer-balances-report';
import { useAuth } from '@/providers/auth-provider';
import type { CustomerBalanceReportEntry } from '@erp/shared';

export default function SuppliersReportPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const companyName = currentUser?.tenant?.name || 'Company';

  const [hasBalance, setHasBalance] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [minBalance, setMinBalance] = useState<number | undefined>(undefined);
  const [maxBalance, setMaxBalance] = useState<number | undefined>(undefined);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, error } = useParties({
    type: 'supplier',
    hasBalance: hasBalance || undefined,
    isActive: includeInactive ? undefined : true,
    limit: 100,
    page: 1,
  });

  const entries = useMemo<CustomerBalanceReportEntry[]>(() => {
    const all = (data?.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      isActive: p.isActive,
      totalInvoiced: 0,
      totalPaid: 0,
      balance: Number(p.balance ?? 0),
      lastInvoiceDate: null,
      lastPaymentDate: null,
    }));
    return all.filter((e) => {
      if (minBalance != null && e.balance < minBalance) return false;
      if (maxBalance != null && e.balance > maxBalance) return false;
      return true;
    });
  }, [data, minBalance, maxBalance]);

  const summary = useMemo(() => {
    const totalPayable = entries.filter((e) => e.balance < 0).reduce((s, e) => s + Math.abs(e.balance), 0);
    const totalOverpaid = entries.filter((e) => e.balance > 0).reduce((s, e) => s + e.balance, 0);
    return {
      total: entries.length,
      totalPayable,
      totalOverpaid,
      net: totalPayable - totalOverpaid,
    };
  }, [entries]);

  const handleBack = useCallback(() => {
    router.push(`/${locale}/suppliers`);
  }, [router, locale]);

  const handleDownload = useCallback(async () => {
    if (!entries.length) {
      toast({
        title: 'No data',
        description: 'No suppliers match the current filters.',
        variant: 'destructive',
      });
      return;
    }
    setIsDownloading(true);
    try {
      await downloadCustomerBalancesReport(
        {
          title: 'Supplier Balances Report',
          companyName,
          customers: entries,
          currencySymbol: '$',
          filterDescription: [
            hasBalance ? 'With balance only' : null,
            includeInactive ? 'Including inactive' : 'Active only',
            minBalance != null ? `Min ${minBalance}` : null,
            maxBalance != null ? `Max ${maxBalance}` : null,
          ].filter(Boolean).join(', ') || 'All suppliers',
          generatedAt: new Date(),
        },
        `supplier-balances-${new Date().toISOString().split('T')[0]}.pdf`
      );
      toast({ title: 'PDF downloaded', description: 'Supplier balances report downloaded.' });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [entries, hasBalance, includeInactive, minBalance, maxBalance, companyName, toast]);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Balances Report</h1>
          <p className="text-muted-foreground">Generate and export a supplier balances report</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Narrow down the report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="has-balance">With balance only</Label>
              <Switch
                id="has-balance"
                checked={hasBalance}
                onCheckedChange={setHasBalance}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="include-inactive">Include inactive</Label>
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-balance">Min balance</Label>
              <Input
                id="min-balance"
                type="number"
                placeholder="Any"
                value={minBalance ?? ''}
                onChange={(e) =>
                  setMinBalance(e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-balance">Max balance</Label>
              <Input
                id="max-balance"
                type="number"
                placeholder="Any"
                value={maxBalance ?? ''}
                onChange={(e) =>
                  setMaxBalance(e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
            </div>
            <Button
              onClick={handleDownload}
              disabled={isDownloading || isLoading}
              className="w-full"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {`${summary.total} suppliers • Net payable: $${summary.net.toFixed(2)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : error ? (
              <p className="text-destructive">{error.message || 'Failed to load report'}</p>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground">No suppliers match the current filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start py-2 px-2">Name</th>
                      <th className="text-start py-2 px-2">Email</th>
                      <th className="text-start py-2 px-2">Phone</th>
                      <th className="text-end py-2 px-2">Balance</th>
                      <th className="text-center py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b">
                        <td className="py-2 px-2 font-medium">{e.name}</td>
                        <td className="py-2 px-2 text-muted-foreground">{e.email || '-'}</td>
                        <td className="py-2 px-2 text-muted-foreground">{e.phone || '-'}</td>
                        <td
                          className={`py-2 px-2 text-end font-medium ${
                            e.balance > 0
                              ? 'text-red-600'
                              : e.balance < 0
                              ? 'text-green-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          ${e.balance.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {e.isActive ? 'Active' : 'Inactive'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
