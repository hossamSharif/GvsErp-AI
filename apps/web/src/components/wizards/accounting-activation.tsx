'use client';

/**
 * Accounting Module Activation Wizard
 *
 * Multi-step wizard to activate the accounting module and configure default settings.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActivateAccounting } from '@/hooks/use-accounting';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AccountingActivationWizardProps {
  open: boolean;
  onClose: () => void;
}

export function AccountingActivationWizard({
  open,
  onClose,
}: AccountingActivationWizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [importDefaultChart, setImportDefaultChart] = useState(true);
  const [fiscalYearStart, setFiscalYearStart] = useState('01-01');

  const activateMutation = useActivateAccounting();

  const handleActivate = async () => {
    try {
      await activateMutation.mutateAsync({
        fiscal_year_start: fiscalYearStart,
        default_accounts: {},
        import_default_chart: importDefaultChart,
      });

      toast({
        title: 'Success',
        description: 'Accounting module activated successfully',
      });

      setStep(3); // Success step
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error?.message || 'Failed to activate accounting module',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (step === 3) {
      router.push('/accounting/accounts');
    }
    onClose();
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Activate Accounting Module</DialogTitle>
          <DialogDescription>
            Set up double-entry accounting for your business
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Welcome to Accounting Module</CardTitle>
                <CardDescription>
                  Enable professional accounting features including:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 list-disc list-inside">
                  <li>Double-entry accounting system</li>
                  <li>Chart of accounts management</li>
                  <li>Journal entries</li>
                  <li>Financial statements (Trial Balance, Income Statement, Balance Sheet)</li>
                  <li>General ledger reports</li>
                  <li>Automatic journal entries from stock transactions</li>
                </ul>
              </CardContent>
            </Card>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                What happens next?
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                We'll import a standard chart of accounts and configure basic accounting settings.
                You can customize everything after activation.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>
                  Configure your accounting settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Fiscal Year Start (MM-DD)</Label>
                  <input
                    type="text"
                    value={fiscalYearStart}
                    onChange={(e) => setFiscalYearStart(e.target.value)}
                    placeholder="01-01"
                    pattern="\d{2}-\d{2}"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the month and day your fiscal year starts (e.g., 01-01 for January 1st)
                  </p>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="import-chart"
                    checked={importDefaultChart}
                    onCheckedChange={(checked) => setImportDefaultChart(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="import-chart"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Import default chart of accounts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Recommended for new setups. Includes standard accounts for Assets, Liabilities,
                      Equity, Revenue, and Expenses.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleActivate}
                disabled={activateMutation.isPending}
              >
                {activateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Activate Accounting
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Accounting Module Activated!</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Your accounting module is now ready to use. You can start managing your chart of
                accounts and creating journal entries.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 list-disc list-inside">
                  <li>Review and customize your chart of accounts</li>
                  <li>Configure default account mappings for auto-entries</li>
                  <li>Create your first journal entry</li>
                  <li>Generate financial statements</li>
                </ul>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button onClick={handleClose}>
                Go to Chart of Accounts
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Error State */}
        {activateMutation.isError && step === 2 && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
              <div>
                <h4 className="font-semibold text-red-900 dark:text-red-100">
                  Activation Failed
                </h4>
                <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                  {(activateMutation.error as any)?.response?.data?.error?.message ||
                    'An error occurred while activating the accounting module'}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
