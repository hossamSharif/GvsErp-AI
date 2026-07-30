'use client';

/**
 * Item Movement Print Styles
 *
 * Scoped print CSS for the per-item movement report, mirroring
 * UserDailySummaryPrintStyles: hide the app chrome and filter bar, print only
 * the report root, and keep table headers/footers repeating across pages.
 */

export function ItemMovementPrintStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  .item-movement-print-root, .item-movement-print-root * { visibility: visible; }
  .item-movement-print-root {
    position: absolute;
    inset: 0;
    box-shadow: none !important;
    margin: 0 !important;
  }
  .item-movement-print-root, .item-movement-print-root * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .item-movement-print-root thead { display: table-header-group; }
  .item-movement-print-root tfoot { display: table-footer-group; }
  .item-movement-print-root tr { page-break-inside: avoid; }
}
        `.trim(),
      }}
    />
  );
}
