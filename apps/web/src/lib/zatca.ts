/**
 * ZATCA Phase 1 (Generation) — Simplified Tax Invoice TLV builder
 *
 * Encodes the five mandatory tags as a base64 string suitable for
 * embedding in a QR code on Saudi tax invoices. Reference:
 * https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/default.aspx
 *
 * Tag layout (Type-Length-Value):
 *   1: Seller name
 *   2: VAT registration number
 *   3: Timestamp (ISO-8601)
 *   4: Invoice total (with VAT)
 *   5: VAT total
 */

export interface ZatcaInvoiceData {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  invoiceTotal: number;
  vatTotal: number;
}

function tlv(tag: number, value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  const out = new Uint8Array(bytes.length + 2);
  out[0] = tag;
  out[1] = bytes.length;
  out.set(bytes, 2);
  return out;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

export function buildZatcaTlvBase64(data: ZatcaInvoiceData): string {
  const chunks = [
    tlv(1, data.sellerName),
    tlv(2, data.vatNumber),
    tlv(3, data.timestamp),
    tlv(4, data.invoiceTotal.toFixed(2)),
    tlv(5, data.vatTotal.toFixed(2)),
  ];
  return bytesToBase64(concatBytes(chunks));
}
