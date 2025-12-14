'use client';

/**
 * Customer Balances Report PDF Template
 *
 * PDF report generation for customer balances using @react-pdf/renderer.
 * Shows current balances for all customers with summary totals.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { PartyBalanceSummary } from '@erp/shared';

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
  colName: { width: '30%' },
  colEmail: { width: '25%' },
  colPhone: { width: '15%' },
  colBalance: { width: '15%', textAlign: 'right' },
  colStatus: { width: '15%', textAlign: 'center' },
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
  balancePositive: {
    color: '#dc2626', // Red for amounts owed to us
  },
  balanceNegative: {
    color: '#16a34a', // Green for overpayments
  },
  balanceZero: {
    color: '#6b7280', // Gray for zero balance
  },
});

// =============================================================================
// TYPES
// =============================================================================

interface CustomerBalancesReportProps {
  /** Report title */
  title?: string;
  /** Company/tenant name */
  companyName?: string;
  /** Customer balances data */
  customers: PartyBalanceSummary[];
  /** Currency symbol */
  currencySymbol?: string;
  /** Filter description */
  filterDescription?: string;
  /** Generation timestamp */
  generatedAt?: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(amount: number, symbol: string): string {
  return `${symbol}${Math.abs(amount).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getBalanceStyle(balance: number) {
  if (balance > 0) return styles.balancePositive;
  if (balance < 0) return styles.balanceNegative;
  return styles.balanceZero;
}

function getBalanceLabel(balance: number): string {
  if (balance > 0) return 'Receivable';
  if (balance < 0) return 'Overpaid';
  return 'Settled';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CustomerBalancesReportDocument({
  title = 'Customer Balances Report',
  companyName = 'Company Name',
  customers,
  currencySymbol = '$',
  filterDescription,
  generatedAt = new Date(),
}: CustomerBalancesReportProps) {
  // Calculate summary stats
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.isActive).length;
  const inactiveCustomers = totalCustomers - activeCustomers;
  const totalReceivable = customers.reduce(
    (sum, c) => sum + (c.balance > 0 ? c.balance : 0),
    0
  );
  const totalOverpaid = customers.reduce(
    (sum, c) => sum + (c.balance < 0 ? Math.abs(c.balance) : 0),
    0
  );
  const netBalance = customers.reduce((sum, c) => sum + c.balance, 0);
  const customersWithBalance = customers.filter((c) => c.balance !== 0).length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{companyName}</Text>
          {filterDescription && (
            <Text style={styles.subtitle}>Filter: {filterDescription}</Text>
          )}
          <View style={styles.metadata}>
            <Text style={styles.metaItem}>
              Generated: {formatDate(generatedAt)}
            </Text>
            <Text style={styles.metaItem}>Total Customers: {totalCustomers}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colName]}>Customer Name</Text>
            <Text style={[styles.tableHeaderCell, styles.colEmail]}>Email</Text>
            <Text style={[styles.tableHeaderCell, styles.colPhone]}>Phone</Text>
            <Text style={[styles.tableHeaderCell, styles.colBalance]}>Balance</Text>
            <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
          </View>

          {/* Table Rows */}
          {customers.map((customer, index) => (
            <View
              key={customer.id}
              style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
            >
              <Text style={[styles.tableCell, styles.colName]} numberOfLines={1}>
                {customer.name}
              </Text>
              <Text style={[styles.tableCell, styles.colEmail]} numberOfLines={1}>
                {customer.email || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.colPhone]}>
                {customer.phone || '-'}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  styles.colBalance,
                  getBalanceStyle(customer.balance),
                ]}
              >
                {formatCurrency(customer.balance, currencySymbol)}
                {customer.balance !== 0 && (
                  <Text style={{ fontSize: 7, color: '#888' }}>
                    {' '}({getBalanceLabel(customer.balance)})
                  </Text>
                )}
              </Text>
              <View style={[styles.colStatus, { alignItems: 'center' }]}>
                <Text
                  style={[
                    styles.badge,
                    customer.isActive ? styles.badgeActive : styles.badgeInactive,
                  ]}
                >
                  {customer.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Customers</Text>
            <Text style={styles.summaryValue}>{totalCustomers}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Active Customers</Text>
            <Text style={styles.summaryValue}>{activeCustomers}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Inactive Customers</Text>
            <Text style={styles.summaryValue}>{inactiveCustomers}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Customers with Outstanding Balance</Text>
            <Text style={styles.summaryValue}>{customersWithBalance}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Receivable</Text>
            <Text style={[styles.summaryValue, styles.balancePositive]}>
              {formatCurrency(totalReceivable, currencySymbol)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Overpaid</Text>
            <Text style={[styles.summaryValue, styles.balanceNegative]}>
              {formatCurrency(totalOverpaid, currencySymbol)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Net Balance</Text>
            <Text style={[styles.summaryValue, getBalanceStyle(netBalance)]}>
              {formatCurrency(netBalance, currencySymbol)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {companyName} - Customer Balances Report
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
 * Generate PDF blob from customer balances data
 */
export async function generateCustomerBalancesReportBlob(
  props: CustomerBalancesReportProps
): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(<CustomerBalancesReportDocument {...props} />).toBlob();
  return blob;
}

/**
 * Download customer balances report as PDF
 */
export async function downloadCustomerBalancesReport(
  props: CustomerBalancesReportProps,
  filename = 'customer-balances-report.pdf'
): Promise<void> {
  const blob = await generateCustomerBalancesReportBlob(props);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
