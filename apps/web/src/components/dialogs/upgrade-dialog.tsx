'use client';

/**
 * Upgrade Dialog Component (Placeholder)
 *
 * Placeholder dialog for prompting users to upgrade their plan.
 * Will be integrated with Stripe in future releases.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, ArrowRight, Info } from 'lucide-react';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  currentPlan?: string;
  targetPlan?: string;
}

export function UpgradeDialog({
  open,
  onOpenChange,
  feature = 'this feature',
  currentPlan = 'Starter',
  targetPlan = 'Professional',
}: UpgradeDialogProps) {
  const professionalFeatures = [
    'Up to 20 users',
    'Advanced invoicing',
    'Multi-warehouse management',
    '500 GB storage',
    'Priority support',
    'Custom reports',
    'API access',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="default">Upgrade Required</Badge>
          </div>
          <DialogTitle>Upgrade to {targetPlan}</DialogTitle>
          <DialogDescription>
            To use {feature}, you need to upgrade your plan from {currentPlan} to{' '}
            {targetPlan} or higher.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Feature Notice */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <h4 className="font-medium text-blue-900">Stripe Integration Coming Soon</h4>
                <p className="text-sm text-blue-700">
                  Plan upgrades will be available once we integrate with Stripe. Stay tuned!
                </p>
              </div>
            </div>
          </div>

          {/* Professional Plan Features */}
          <div>
            <h4 className="mb-3 font-semibold">What's included in {targetPlan}:</h4>
            <ul className="space-y-2">
              {professionalFeatures.map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <Check className="h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-sm">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing Preview */}
          <div className="rounded-lg border p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">$99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Billed monthly • Cancel anytime
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Maybe Later
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            disabled
          >
            Coming Soon
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
