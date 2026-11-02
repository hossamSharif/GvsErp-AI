/**
 * Invoice print-template preference
 *
 * Which printable layout an invoice uses by default (`standard` | `statement`),
 * stored per invoice type in tenant settings. `standard` — the original
 * invoice — stays the default until the user picks otherwise.
 */

import type { InvoicePrintTemplate, InvoiceType, TenantSettings } from '@erp/shared';

export type { InvoicePrintTemplate };

export const PRINT_TEMPLATE_DEFAULT: InvoicePrintTemplate = 'standard';

export const PRINT_TEMPLATES: InvoicePrintTemplate[] = ['standard', 'statement'];

function isPrintTemplate(value: unknown): value is InvoicePrintTemplate {
  return typeof value === 'string' && PRINT_TEMPLATES.includes(value as InvoicePrintTemplate);
}

/** Pull the default template for `type` out of a settings payload. */
export function printTemplateFromSettings(
  settings: TenantSettings | undefined,
  type: InvoiceType
): InvoicePrintTemplate {
  const value =
    type === 'sale' ? settings?.sales_print_template : settings?.purchase_print_template;
  return isPrintTemplate(value) ? value : PRINT_TEMPLATE_DEFAULT;
}
