'use client';

/**
 * Payments Report PDF Template
 *
 * PDF report generation for payments using @react-pdf/renderer.
 * Shows all payments (received and made) with filtering and summary totals.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import type { PaymentWithParty } from '@erp-saas/shared';

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
  logo: {
    width: 60,
    height: 60,
    marginBottom: 8,
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
  colDate: { width: '12%' },
  colReference: { width: '15%' },
  colType: { width: '12%' },
  colParty: { width: '20%' },
  colMethod: { width: '13%' },
  colAmount: { width: '13%', textAlign: 'right' },
  colNotes: { width: '15%' },
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
  badgeReceived: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  badgeMade: {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
  },
  amountReceived: {
    color: '#16a34a', // Green for received
  },
  amountMade: {
    color: '#dc2626', // Red for made
  },
});

// =============================================================================
// TYPES
// =============================================================================

interface PaymentsReportProps {
  /** Report title */
  title?: string;
  /** Company/tenant name */
  companyName?: string;
  /** Company logo URL */
  companyLogo?: string;
  /** Payments data */
  payments: PaymentWithParty[];
  /** Currency symbol */
  currencySymbol?: string;
  /** Filter description */
  filterDescription?: string;
  /** Date range */
  dateRange?: {
    from: string;
    to: string;
  };
  /** Generation timestamp */
  generatedAt?: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(amount: number, currency: string, symbol: string): string {
  if (currency !== 'USD') {
    return `${amount.toFixed(2)} ${currency}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return '-';
  return method
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PaymentsReportDocument({
  title = 'Payments Report',
  companyName = 'Company Name',
  companyLogo,
  payments,
  currencySymbol = '$',
  filterDescription,
  dateRange,
  generatedAt = new Date(),
}: PaymentsReportProps) {
  // Calculate summary stats
  const totalPayments = payments.length;
  const receivedPayments = payments.filter((p) => p.type === 'received');
  const madePayments = payments.filter((p) => p.type === 'made');
  const totalReceived = receivedPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalMade = madePayments.reduce((sum, p) => sum + p.amount, 0);
  const netCashFlow = totalReceived - totalMade;

  // Payment methods breakdown
  const paymentMethods = payments.reduce((acc, p) => {
    const method = p.paymentMethod || 'Unknown';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {companyLogo && <Image src={companyLogo} style={styles.logo} />}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{companyName}</Text>
          {filterDescription && (
            <Text style={styles.subtitle}>Filter: {filterDescription}</Text>
          )}
          {dateRange && (
            <Text style={styles.subtitle}>
              Period: {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
            </Text>
          )}
          <View style={styles.metadata}>
            <Text style={styles.metaItem}>
              Generated: {formatDateTime(generatedAt)}
            </Text>
            <Text style={styles.metaItem}>Total Payments: {totalPayments}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.colReference]}>Reference</Text>
            <Text style={[styles.tableHeaderCell, styles.colType]}>Type</Text>
            <Text style={[styles.tableHeaderCell, styles.colParty]}>Party</Text>
            <Text style={[styles.tableHeaderCell, styles.colMethod]}>Method</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
            <Text style={[styles.tableHeaderCell, styles.colNotes]}>Notes</Text>
          </View>

          {/* Table Rows */}
          {payments.map((payment, index) => (
            <View
              key={payment.id}
              style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
            >
              <Text style={[styles.tableCell, styles.colDate]}>
                {formatDate(payment.paymentDate)}
              </Text>
              <Text style={[styles.tableCell, styles.colReference]} numberOfLines={1}>
                {payment.reference || '-'}
              </Text>
              <View style={styles.colType}>
                <Text
                  style={[
                    styles.badge,
                    payment.type === 'received'
                      ? styles.badgeReceived
                      : styles.badgeMade,
                  ]}
                >
                  {payment.type === 'received' ? 'Received' : 'Made'}
                </Text>
              </View>
              <Text style={[styles.tableCell, styles.colParty]} numberOfLines={1}>
                {payment.party.name}
              </Text>
              <Text style={[styles.tableCell, styles.colMethod]}>
                {formatPaymentMethod(payment.paymentMethod)}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.colAmount,
                  payment.type === 'received'
                    ? styles.amountReceived
                    : styles.amountMade,
                ]}
              >
                {formatCurrency(payment.amount, payment.currency, currencySymbol)}
              </Text>
              <Text style={[styles.tableCell, styles.colNotes]} numberOfLines={1}>
                {payment.notes || '-'}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={{ flexDirection: 'row', gap: 40 }}>
            {/* Left Column */}
            <View style={{ flex: 1 }}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Payments</Text>
                <Text style={styles.summaryValue}>{totalPayments}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payments Received</Text>
                <Text style={styles.summaryValue}>{receivedPayments.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payments Made</Text>
                <Text style={styles.summaryValue}>{madePayments.length}</Text>
              </View>
            </View>

            {/* Right Column */}
            <View style={{ flex: 1 }}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Received</Text>
                <Text style={[styles.summaryValue, styles.amountReceived]}>
                  {formatCurrency(totalReceived, 'USD', currencySymbol)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Made</Text>
                <Text style={[styles.summaryValue, styles.amountMade]}>
                  {formatCurrency(totalMade, 'USD', currencySymbol)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net Cash Flow</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    netCashFlow >= 0 ? styles.amountReceived : styles.amountMade,
                  ]}
                >
                  {formatCurrency(Math.abs(netCashFlow), 'USD', currencySymbol)}
                  {netCashFlow < 0 && ' (Outflow)'}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment Methods Breakdown */}
          {Object.keys(paymentMethods).length > 0 && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ddd' }}>
              <Text style={[styles.summaryLabel, { marginBottom: 6 }]}>
                Payment Methods:
              </Text>
              {Object.entries(paymentMethods).map(([method, count]) => (
                <View key={method} style={styles.summaryRow}>
                  <Text style={{ fontSize: 8, color: '#888' }}>
                    {formatPaymentMethod(method)}
                  </Text>
                  <Text style={{ fontSize: 8, color: '#666' }}>{count}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {companyName} - Payments Report
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
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
 * Generate PDF blob from payments data
 */
export async function generatePaymentsReportBlob(
  props: PaymentsReportProps
): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(<PaymentsReportDocument {...props} />).toBlob();
  return blob;
}

/**
 * Download payments report as PDF
 */
export async function downloadPaymentsReport(
  props: PaymentsReportProps,
  filename = 'payments-report.pdf'
): Promise<void> {
  const blob = await generatePaymentsReportBlob(props);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
