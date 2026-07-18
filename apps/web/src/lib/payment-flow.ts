/**
 * Payment-flow preference (offline mirror)
 *
 * The per-tenant invoice payment workflow (`dialog` | `background` | `skip`) is
 * stored server-side in tenant settings, but `/settings` is NOT cached for
 * offline use. So we mirror the chosen value into `localStorage` whenever fresh
 * settings arrive online, and read from there (synchronously, offline-safe) when
 * the invoice form finalizes. Editing stays online-only; reading works anywhere.
 */

import type { InvoiceType, PaymentFlow, TenantSettings } from '@erp/shared';

export type { PaymentFlow };

export const PAYMENT_FLOW_DEFAULT: PaymentFlow = 'dialog';

const PAYMENT_FLOWS: PaymentFlow[] = ['dialog', 'background', 'skip'];

/** The `TenantSettings` field that holds the flow for a given invoice type. */
export function settingsFieldFor(
  type: InvoiceType
): 'sales_payment_flow' | 'purchase_payment_flow' {
  return type === 'sale' ? 'sales_payment_flow' : 'purchase_payment_flow';
}

function storageKey(type: InvoiceType): string {
  return `erp:paymentFlow:${type}`;
}

function isPaymentFlow(value: unknown): value is PaymentFlow {
  return typeof value === 'string' && PAYMENT_FLOWS.includes(value as PaymentFlow);
}

/** Synchronous, SSR-safe read of the mirrored flow. Falls back to the default. */
export function readPaymentFlow(type: InvoiceType): PaymentFlow {
  if (typeof window === 'undefined') return PAYMENT_FLOW_DEFAULT;
  try {
    const stored = window.localStorage.getItem(storageKey(type));
    return isPaymentFlow(stored) ? stored : PAYMENT_FLOW_DEFAULT;
  } catch {
    return PAYMENT_FLOW_DEFAULT;
  }
}

/** Mirror the chosen flow locally so it survives reloads while offline. */
export function writePaymentFlow(type: InvoiceType, value: PaymentFlow): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(type), value);
  } catch {
    // Best-effort mirror; ignore quota/availability errors.
  }
}

/** Pull the flow for `type` out of a settings payload (default when unset). */
export function paymentFlowFromSettings(
  settings: TenantSettings | undefined,
  type: InvoiceType
): PaymentFlow {
  const value = settings?.[settingsFieldFor(type)];
  return isPaymentFlow(value) ? value : PAYMENT_FLOW_DEFAULT;
}
