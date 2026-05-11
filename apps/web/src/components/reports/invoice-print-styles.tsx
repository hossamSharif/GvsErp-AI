/**
 * Invoice Print Styles
 *
 * Centralized print stylesheet injected once per InvoicePdf instance.
 * Lives outside globals.css so Tailwind's content-purge cannot touch it
 * and so the rules only apply where the invoice is mounted.
 */

export function InvoicePrintStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
@page { size: A4; margin: 12mm 14mm; }
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  .invoice-print-root, .invoice-print-root * { visibility: visible; }
  .invoice-print-root {
    position: absolute;
    inset: 0;
    box-shadow: none !important;
    margin: 0 !important;
  }
  .invoice-print-root, .invoice-print-root * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .invoice-print-root thead { display: table-header-group; }
  .invoice-print-root tfoot { display: table-footer-group; }
  .invoice-print-root tr,
  .invoice-print-root .avoid-break { page-break-inside: avoid; }
  .invoice-print-root .page-break { page-break-after: always; }
}
        `.trim(),
      }}
    />
  );
}
