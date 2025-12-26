/**
 * Expense Report PDF Template
 * PDF template for expense reports using @react-pdf/renderer
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import { ExpenseWithDetails } from '@erp-saas/shared/types/expenses';

// Register fonts if needed for multi-language support
// Font.register({ family: 'Roboto', src: '/fonts/Roboto-Regular.ttf' });

// PDF Styles
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottom: '1pt solid #000',
    paddingBottom: 5,
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #e0e0e0',
    padding: 8,
  },
  tableCol: {
    flex: 1,
  },
  tableColDate: {
    width: '15%',
  },
  tableColDescription: {
    width: '40%',
  },
  tableColCategory: {
    width: '20%',
  },
  tableColAmount: {
    width: '15%',
    textAlign: 'right',
  },
  tableColCurrency: {
    width: '10%',
  },
  summary: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  summaryValue: {
    fontSize: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTop: '2pt solid #000',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
});

interface ExpenseReportProps {
  expenses: ExpenseWithDetails[];
  startDate: string;
  endDate: string;
  currency?: string;
  tenantName?: string;
  tenantLogo?: string;
}

export function ExpenseReport({
  expenses,
  startDate,
  endDate,
  currency = 'USD',
  tenantName = 'My Company',
  tenantLogo,
}: ExpenseReportProps) {
  // Calculate totals
  const totalAmount = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  // Group expenses by category
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const categoryName = expense.category?.name || 'Uncategorized';
    if (!acc[categoryName]) {
      acc[categoryName] = {
        count: 0,
        total: 0,
      };
    }
    acc[categoryName].count += 1;
    acc[categoryName].total += Number(expense.amount);
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {tenantLogo && <Image src={tenantLogo} style={styles.logo} />}
          <Text style={styles.title}>Expense Report</Text>
          <Text style={styles.subtitle}>{tenantName}</Text>
          <Text style={styles.subtitle}>
            Period: {new Date(startDate).toLocaleDateString()} -{' '}
            {new Date(endDate).toLocaleDateString()}
          </Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString()}
          </Text>
        </View>

        {/* Expense Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expense Details</Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.tableColDate}>Date</Text>
            <Text style={styles.tableColDescription}>Description</Text>
            <Text style={styles.tableColCategory}>Category</Text>
            <Text style={styles.tableColAmount}>Amount</Text>
          </View>

          {/* Table Rows */}
          {expenses.map((expense, index) => (
            <View key={expense.id} style={styles.tableRow}>
              <Text style={styles.tableColDate}>
                {new Date(expense.expense_date).toLocaleDateString()}
              </Text>
              <Text style={styles.tableColDescription}>
                {expense.description || '-'}
              </Text>
              <Text style={styles.tableColCategory}>
                {expense.category?.name || 'Uncategorized'}
              </Text>
              <Text style={styles.tableColAmount}>
                {expense.currency} {Number(expense.amount).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.sectionTitle}>Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Expenses:</Text>
            <Text style={styles.summaryValue}>{expenses.length}</Text>
          </View>

          {/* Category Breakdown */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              marginTop: 10,
              marginBottom: 5,
            }}
          >
            By Category:
          </Text>

          {Object.entries(expensesByCategory).map(([category, stats]) => (
            <View key={category} style={styles.summaryRow}>
              <Text style={{ fontSize: 10 }}>
                {category} ({stats.count} expenses)
              </Text>
              <Text style={{ fontSize: 10 }}>
                {currency} {stats.total.toFixed(2)}
              </Text>
            </View>
          ))}

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>
              {currency} {totalAmount.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated with ERP System - Page 1 of 1
        </Text>
      </Page>
    </Document>
  );
}
