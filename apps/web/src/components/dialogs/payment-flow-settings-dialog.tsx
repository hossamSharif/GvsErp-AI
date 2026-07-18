'use client';

/**
 * Payment Flow Settings Dialog
 *
 * Lets the user choose how the payment step behaves when a sales/purchase
 * invoice is finalized: show the payment dialog, record it automatically in the
 * background, or skip payment entirely. Each choice is illustrated with a small
 * flow diagram. Editing is online-only (the value lives in tenant settings); the
 * choice is mirrored to localStorage so it still applies offline.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText,
  CreditCard,
  Zap,
  Ban,
  CheckCircle2,
  ArrowRight,
  Check,
  WifiOff,
  Loader2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useOnline } from '@/hooks/use-online';
import { useTenantSettings, useUpdateTenantSettings } from '@/hooks/use-settings';
import {
  paymentFlowFromSettings,
  settingsFieldFor,
  writePaymentFlow,
  type PaymentFlow,
} from '@/lib/payment-flow';
import type { InvoiceType, UpdateTenantSettingsInput } from '@erp/shared';

interface PaymentFlowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: InvoiceType;
}

/** A single node in an option's mini flow diagram. */
function DiagramNode({
  icon: Icon,
  label,
  tone = 'muted',
}: {
  icon: React.ElementType;
  label: string;
  tone?: 'muted' | 'primary' | 'accent' | 'success' | 'off';
}) {
  const toneClasses: Record<string, string> = {
    muted: 'bg-muted text-muted-foreground border-border',
    primary: 'bg-primary/10 text-primary border-primary/30',
    accent: 'bg-amber-500/10 text-amber-600 border-amber-500/30 border-dashed',
    success: 'bg-green-500/10 text-green-600 border-green-500/30',
    off: 'bg-muted/50 text-muted-foreground/60 border-dashed border-border',
  };
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg border',
          toneClasses[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[10px] leading-tight text-muted-foreground max-w-[64px]">
        {label}
      </span>
    </div>
  );
}

function DiagramArrow() {
  return (
    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 rtl:rotate-180" />
  );
}

export function PaymentFlowSettingsDialog({
  open,
  onOpenChange,
  type,
}: PaymentFlowSettingsDialogProps) {
  const t = useTranslations('paymentFlow');
  const { toast } = useToast();
  const online = useOnline();

  const { data: settingsData, isLoading } = useTenantSettings({ retry: false });
  const currentFlow = paymentFlowFromSettings(settingsData?.data, type);

  const [selected, setSelected] = useState<PaymentFlow>(currentFlow);

  // Re-seed the selection from the saved value each time the dialog opens or the
  // fetched settings change, so it always reflects the current server state.
  useEffect(() => {
    if (open) setSelected(currentFlow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentFlow]);

  const updateMutation = useUpdateTenantSettings({
    onSuccess: () => {
      writePaymentFlow(type, selected);
      toast({ title: t('toastSaved'), description: t('toastSavedDesc') });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('toastError'),
        description: error instanceof Error ? error.message : t('toastErrorDesc'),
      });
    },
  });

  const handleSave = () => {
    if (!online) return;
    const payload = { [settingsFieldFor(type)]: selected } as UpdateTenantSettingsInput;
    updateMutation.mutate(payload);
  };

  const options: Array<{
    value: PaymentFlow;
    title: string;
    description: string;
    diagram: React.ReactNode;
  }> = [
    {
      value: 'dialog',
      title: t('options.dialog.title'),
      description: t('options.dialog.description'),
      diagram: (
        <>
          <DiagramNode icon={FileText} label={t('nodes.invoice')} />
          <DiagramArrow />
          <DiagramNode icon={CreditCard} label={t('nodes.paymentDialog')} tone="primary" />
          <DiagramArrow />
          <DiagramNode icon={CheckCircle2} label={t('nodes.done')} tone="success" />
        </>
      ),
    },
    {
      value: 'background',
      title: t('options.background.title'),
      description: t('options.background.description'),
      diagram: (
        <>
          <DiagramNode icon={FileText} label={t('nodes.invoice')} />
          <DiagramArrow />
          <DiagramNode icon={Zap} label={t('nodes.autoPaid')} tone="accent" />
          <DiagramArrow />
          <DiagramNode icon={CheckCircle2} label={t('nodes.done')} tone="success" />
        </>
      ),
    },
    {
      value: 'skip',
      title: t('options.skip.title'),
      description: t('options.skip.description'),
      diagram: (
        <>
          <DiagramNode icon={FileText} label={t('nodes.invoice')} />
          <DiagramArrow />
          <DiagramNode icon={Ban} label={t('nodes.noPayment')} tone="off" />
          <DiagramArrow />
          <DiagramNode icon={CheckCircle2} label={t('nodes.saved')} tone="success" />
        </>
      ),
    },
  ];

  const controlsDisabled = !online || isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {type === 'sale' ? t('titleSale') : t('titlePurchase')}
          </DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        {!online && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('offlineNotice')}</span>
          </div>
        )}

        <div className="space-y-3">
          {options.map((option) => {
            const isSelected = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={controlsDisabled}
                onClick={() => setSelected(option.value)}
                className={cn(
                  'relative flex w-full flex-col gap-3 rounded-xl border p-4 text-start transition-colors sm:flex-row sm:items-center sm:justify-between',
                  isSelected
                    ? 'border-primary ring-2 ring-primary'
                    : 'border-border hover:bg-accent',
                  controlsDisabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.title}</span>
                    {option.value === currentFlow && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t('currentBadge')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>

                {/* Mini flow diagram */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {option.diagram}
                </div>

                {isSelected && (
                  <span className="absolute end-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={controlsDisabled || updateMutation.isPending || selected === currentFlow}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
