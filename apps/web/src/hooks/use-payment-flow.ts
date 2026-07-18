'use client';

/**
 * usePaymentFlow
 *
 * Returns the effective invoice payment workflow for a given invoice type,
 * respecting offline mode. Online, the value comes from tenant settings and is
 * mirrored to `localStorage`; offline, it reads the last mirrored value. See
 * `lib/payment-flow.ts`.
 */

import { useEffect, useState } from 'react';
import type { InvoiceType } from '@erp/shared';
import { useTenantSettings } from './use-settings';
import {
  readPaymentFlow,
  writePaymentFlow,
  paymentFlowFromSettings,
  type PaymentFlow,
} from '@/lib/payment-flow';

export function usePaymentFlow(type: InvoiceType): PaymentFlow {
  // Seed synchronously from the offline mirror so finalize has a value on first
  // render even before (or without) a settings fetch.
  const [flow, setFlow] = useState<PaymentFlow>(() => readPaymentFlow(type));

  // Settings fetch is network-only; it simply errors offline and we keep the
  // mirrored value. Guard the query's own retries to avoid noisy offline loops.
  const { data } = useTenantSettings({ retry: false });

  useEffect(() => {
    if (!data?.data) return;
    const next = paymentFlowFromSettings(data.data, type);
    writePaymentFlow(type, next);
    setFlow(next);
  }, [data, type]);

  return flow;
}
