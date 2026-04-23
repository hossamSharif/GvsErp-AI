'use client';

/**
 * Items Report PDF Template
 *
 * PDF report generation for inventory items using @react-pdf/renderer.
 * Supports filtering by category and active status.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { ItemReportEntry } from '@erp/shared';

// =============================================================================
// FONT REGISTRATION (Optional - for Arabic support)
// =============================================================================

// Register fonts if needed for RTL/Arabic support
// Font.register({
//   family: 'Noto Sans Arabic',
//   src: '/fonts/NotoSansArabic-Regular.ttf',
// });

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#24543A', // Primary brand color
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  metaItem: {
    fontSize: 9,
    color: '#888',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#24543A',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: '#f9f9f9',
  },
  tableCell: {
    fontSize: 9,
  },
  // Column widths
  colName: { width: '22%' },
  colSku: { width: '12%' },
  colBarcode: { width: '14%' },
  colCategory: { width: '14%' },
  colUnit: { width: '8%' },
  colRetail: { width: '10%', textAlign: 'right' },
  colWholesale: { width: '10%', textAlign: 'right' },
  colStatus: { width: '10%', textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#888',
  },
  pageNumber: {
    fontSize: 8,
    color: '#888',
  },
  summary: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#666',
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    fontSize: 8,
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  badgeInactive: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
});

// =============================================================================
// TYPES
// =============================================================================

export interface ItemsReportLabels {
  filter: string;
  generated: string;
  totalItems: string;
  columnName: string;
  columnSku: string;
  columnBarcode: string;
  columnCategory: string;
  columnUnit: string;
  columnRetail: string;
  columnWholesale: string;
  columnStatus: string;
  summary: string;
  activeItems: string;
  inactiveItems: string;
  itemsWithRetailPrice: string;
  avgRetailPrice: string;
  footerLabel: string;
  pageNumberTemplate: string;
  statusActive: string;
  statusInactive: string;
  locale?: string;
}

const DEFAULT_LABELS: ItemsReportLabels = {
  filter: 'Filter',
  generated: 'Generated',
  totalItems: 'Total Items',
  columnName: 'Name',
  columnSku: 'SKU',
  columnBarcode: 'Barcode',
  columnCategory: 'Category',
  columnUnit: 'Unit',
  columnRetail: 'Retail',
  columnWholesale: 'Wholesale',
  columnStatus: 'Status',
  summary: 'Summary',
  activeItems: 'Active Items',
  inactiveItems: 'Inactive Items',
  itemsWithRetailPrice: 'Items with Retail Price',
  avgRetailPrice: 'Average Retail Price',
  footerLabel: 'Inventory Report',
  pageNumberTemplate: 'Page {current} of {total}',
  statusActive: 'Active',
  statusInactive: 'Inactive',
  locale: 'en-US',
};

interface ItemsReportProps {
  /** Report title */
  title?: string;
  /** Company/tenant name */
  companyName?: string;
  /** Items data */
  items: ItemReportEntry[];
  /** Currency symbol for prices */
  currencySymbol?: string;
  /** Filter description */
  filterDescription?: string;
  /** Generation timestamp */
  generatedAt?: Date;
  /** Localized labels (overrides English defaults) */
  labels?: Partial<ItemsReportLabels>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatPrice(price: number | null, symbol: string): string {
  if (price === null) return '-';
  return `${symbol}${price.toFixed(2)}`;
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderPageNumber(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total));
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ItemsReportDocument({
  title = 'Inventory Items Report',
  companyName = 'Company Name',
  items,
  currencySymbol = '$',
  filterDescription,
  generatedAt = new Date(),
  labels,
}: ItemsReportProps) {
  const L: ItemsReportLabels = { ...DEFAULT_LABELS, ...labels };
  const dateLocale = L.locale === 'ar' ? 'ar-EG' : 'en-US';
  // Calculate summary stats
  const totalItems = items.length;
  const activeItems = items.filter((i) => i.isActive).length;
  const inactiveItems = totalItems - activeItems;
  const itemsWithRetailPrice = items.filter((i) => i.retailPrice !== null).length;
  const avgRetailPrice =
    itemsWithRetailPrice > 0
      ? items.reduce((sum, i) => sum + (i.retailPrice || 0), 0) / itemsWithRetailPrice
      : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{companyName}</Text>
          {filterDescription && (
            <Text style={styles.subtitle}>{L.filter}: {filterDescription}</Text>
          )}
          <View style={styles.metadata}>
            <Text style={styles.metaItem}>
              {L.generated}: {formatDate(generatedAt, dateLocale)}
            </Text>
            <Text style={styles.metaItem}>{L.totalItems}: {totalItems}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colName]}>{L.columnName}</Text>
            <Text style={[styles.tableHeaderCell, styles.colSku]}>{L.columnSku}</Text>
            <Text style={[styles.tableHeaderCell, styles.colBarcode]}>{L.columnBarcode}</Text>
            <Text style={[styles.tableHeaderCell, styles.colCategory]}>{L.columnCategory}</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit]}>{L.columnUnit}</Text>
            <Text style={[styles.tableHeaderCell, styles.colRetail]}>{L.columnRetail}</Text>
            <Text style={[styles.tableHeaderCell, styles.colWholesale]}>{L.columnWholesale}</Text>
            <Text style={[styles.tableHeaderCell, styles.colStatus]}>{L.columnStatus}</Text>
          </View>

          {/* Table Rows */}
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}
            >
              <Text style={[styles.tableCell, styles.colName]}>
                {item.name}
              </Text>
              <Text style={[styles.tableCell, styles.colSku]}>{item.sku || '-'}</Text>
              <Text style={[styles.tableCell, styles.colBarcode]}>
                {item.barcode || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.colCategory]}>
                {item.category || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.colUnit]}>
                {item.unitOfMeasure}
              </Text>
              <Text style={[styles.tableCell, styles.colRetail]}>
                {formatPrice(item.retailPrice, currencySymbol)}
              </Text>
              <Text style={[styles.tableCell, styles.colWholesale]}>
                {formatPrice(item.wholesalePrice, currencySymbol)}
              </Text>
              <View style={[styles.colStatus, { alignItems: 'center' }]}>
                <Text
                  style={[
                    styles.badge,
                    item.isActive ? styles.badgeActive : styles.badgeInactive,
                  ]}
                >
                  {item.isActive ? L.statusActive : L.statusInactive}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{L.summary}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{L.totalItems}</Text>
            <Text style={styles.summaryValue}>{totalItems}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{L.activeItems}</Text>
            <Text style={styles.summaryValue}>{activeItems}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{L.inactiveItems}</Text>
            <Text style={styles.summaryValue}>{inactiveItems}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{L.itemsWithRetailPrice}</Text>
            <Text style={styles.summaryValue}>{itemsWithRetailPrice}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{L.avgRetailPrice}</Text>
            <Text style={styles.summaryValue}>
              {formatPrice(avgRetailPrice, currencySymbol)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {companyName} - {L.footerLabel}
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              renderPageNumber(L.pageNumberTemplate, pageNumber, totalPages)
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// =============================================================================
// EXPORT HELPERS
// =============================================================================

/**
 * Generate PDF blob from items data
 */
export async function generateItemsReportBlob(
  props: ItemsReportProps
): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(<ItemsReportDocument {...props} />).toBlob();
  return blob;
}

/**
 * Download items report as PDF
 */
export async function downloadItemsReport(
  props: ItemsReportProps,
  filename = 'items-report.pdf'
): Promise<void> {
  const blob = await generateItemsReportBlob(props);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
