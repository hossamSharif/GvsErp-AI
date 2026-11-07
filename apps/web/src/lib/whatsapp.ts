/**
 * WhatsApp helpers
 *
 * Phone numbers are stored as typed (e.g. "0912 345 678"); WhatsApp links need
 * the international form in digits only ("249912345678"). Local numbers get
 * the tenant's default dial code (settings → `default_dial_code`).
 */

/** Sudan; used until the tenant sets its own dial code. */
export const DEFAULT_DIAL_CODE = '249';

const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

/** Map Arabic-Indic / Persian digits to Latin so pasted numbers still parse. */
function latinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Normalize a phone number to WhatsApp's international digits-only form.
 * Returns '' when nothing usable was entered.
 *
 *   "0912345678"      → "249912345678"
 *   "+249 91 234 5678" → "249912345678"
 *   "00249912345678"  → "249912345678"
 *   "912345678"       → "249912345678"  (local number without the trunk 0)
 */
export function toWhatsAppNumber(
  raw: string | null | undefined,
  dialCode: string = DEFAULT_DIAL_CODE
): string {
  if (!raw) return '';
  const trimmed = latinDigits(raw).trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (hasPlus) return digits;
  if (digits.startsWith('00')) return digits.slice(2);

  const code = dialCode.replace(/\D/g, '') || DEFAULT_DIAL_CODE;
  if (digits.startsWith('0')) return code + digits.replace(/^0+/, '');
  if (digits.startsWith(code) && digits.length > code.length + 6) return digits;
  // Short local number typed without the leading 0.
  if (digits.length <= 10) digits = code + digits;
  return digits;
}

/** Whether a normalized number is a plausible E.164 number. */
export function isValidWhatsAppNumber(number: string): boolean {
  return /^\d+$/.test(number) && number.length >= MIN_DIGITS && number.length <= MAX_DIGITS;
}

/** Click-to-chat link that opens the chat with `number`, message pre-filled. */
export function buildWhatsAppUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
