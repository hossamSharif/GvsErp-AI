'use client';

/**
 * Expenses Report PDF Template
 *
 * PDF report generation for expenses using @react-pdf/renderer.
 * Shows itemized expenses with summary by category and method.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ExpenseReportEntry, ExpenseReportSummary } from '@erp/shared';

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
    color: '#24543A',
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
  table: { marginTop: 10 },
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
  tableRowAlt: { backgroundColor: '#f9f9f9' },
  tableCell: { fontSize: 9 },
  colDate: { width: '15%' },
  colCategory: { width: '15%' },
  colDescription: { width: '30%' },
  colMethod: { width: '12%' },
  colReference: { width: '13%' },
  colAmount: { width: '15%', textAlign: 'right' },
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
  summaryLabel: { fontSize: 9, color: '#666' },
  summaryValue: { fontSize: 9, fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
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
  footerText: { fontSize: 8, color: '#888' },
  pageNumber: { fontSize: 8, color: '#888' },
});

interface ExpensesReportProps {
  title?: string;
  companyName?: string;
  entries: ExpenseReportEntry[];
  summary?: ExpenseReportSummary;
  currencySymbol?: string;
  filterDescription?: string;
  generatedAt?: Date;
}

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

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ExpensesReportDocument({
  title = 'Expenses Report',
  companyName = 'Company Name',
  entries,
  summary,
  currencySymbol = '$',
  filterDescription,
  generatedAt = new Date(),
}: ExpensesReportProps) {
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
            <Text style={styles.metaItem}>Generated: {formatDate(generatedAt)}</Text>
            <Text style={styles.metaItem}>Total Entries: {entries.length}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
            <Text style={[styles.tableHeaderCell, styles.colCategory]}>Category</Text>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colMethod]}>Method</Text>
            <Text style={[styles.tableHeaderCell, styles.colReference]}>Reference</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>

          {entries.map((entry, idx) => (
            <View
              key={entry.id}
              style={[styles.tableRow, ...(idx % 2 === 1 ? [styles.tableRowAlt] : [])]}
            >
              <Text style={[styles.tableCell, styles.colDate]}>
                {formatShortDate(entry.expenseDate)}
              </Text>
              <Text style={[styles.tableCell, styles.colCategory]}>{entry.category}</Text>
              <Text style={[styles.tableCell, styles.colDescription]}>
                {entry.description || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.colMethod]}>
                {entry.paymentMethod || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.colReference]}>
                {entry.reference || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.colAmount]}>
                {formatCurrency(entry.amount, currencySymbol)}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        {summary && (
          <View style={styles.summary} wrap={false}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryValue}>{summary.totalCount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.totalAmount, currencySymbol)}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>By Category</Text>
            {Object.entries(summary.byCategory).map(([cat, info]) => (
              <View key={cat} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {cat} ({info.count})
                </Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(info.total, currencySymbol)}
                </Text>
              </View>
            ))}

            <Text style={styles.sectionTitle}>By Payment Method</Text>
            {Object.entries(summary.byMethod).map(([method, info]) => (
              <View key={method} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {method} ({info.count})
                </Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(info.total, currencySymbol)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{companyName} - Expenses Report</Text>
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

export async function generateExpensesReportBlob(props: ExpensesReportProps): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(<ExpensesReportDocument {...props} />).toBlob();
  return blob;
}

export async function downloadExpensesReport(
  props: ExpensesReportProps,
  filename = 'expenses-report.pdf'
): Promise<void> {
  const blob = await generateExpensesReportBlob(props);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
