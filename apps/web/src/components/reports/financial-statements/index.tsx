/**
 * Financial Statements PDF Templates
 *
 * PDF export templates for:
 * - Trial Balance
 * - Income Statement
 * - Balance Sheet
 * - General Ledger
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type {
  TrialBalance,
  IncomeStatement,
  BalanceSheet,
  GeneralLedgerReport,
} from '@erp-saas/shared';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    paddingBottom: 10,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  table: {
    width: '100%',
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  tableCellRight: {
    flex: 1,
    paddingHorizontal: 4,
    textAlign: 'right',
  },
  totalRow: {
    fontWeight: 'bold',
    borderTopWidth: 2,
    borderTopColor: '#000',
    marginTop: 4,
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});

// Trial Balance PDF
export function TrialBalancePDF({ data, companyName, companyLogo }: { data: TrialBalance; companyName: string; companyLogo?: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {companyLogo && <Image src={companyLogo} style={styles.logo} />}
          <Text style={styles.title}>{companyName}</Text>
          <Text style={styles.subtitle}>Trial Balance</Text>
          <Text style={styles.subtitle}>As of {data.as_of_date}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Account Code</Text>
            <Text style={styles.tableCell}>Account Name</Text>
            <Text style={styles.tableCell}>Type</Text>
            <Text style={styles.tableCellRight}>Debit</Text>
            <Text style={styles.tableCellRight}>Credit</Text>
          </View>
          {data.rows.map((row, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.account_code}</Text>
              <Text style={styles.tableCell}>{row.account_name}</Text>
              <Text style={styles.tableCell}>{row.account_type}</Text>
              <Text style={styles.tableCellRight}>
                {row.debit > 0 ? row.debit.toFixed(2) : '-'}
              </Text>
              <Text style={styles.tableCellRight}>
                {row.credit > 0 ? row.credit.toFixed(2) : '-'}
              </Text>
            </View>
          ))}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={styles.tableCell}>Totals:</Text>
            <Text style={styles.tableCell}></Text>
            <Text style={styles.tableCell}></Text>
            <Text style={styles.tableCellRight}>{data.total_debits.toFixed(2)}</Text>
            <Text style={styles.tableCellRight}>{data.total_credits.toFixed(2)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// Income Statement PDF
export function IncomeStatementPDF({
  data,
  companyName,
  companyLogo,
}: {
  data: IncomeStatement;
  companyName: string;
  companyLogo?: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {companyLogo && <Image src={companyLogo} style={styles.logo} />}
          <Text style={styles.title}>{companyName}</Text>
          <Text style={styles.subtitle}>Income Statement</Text>
          <Text style={styles.subtitle}>
            {data.start_date} to {data.end_date}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue</Text>
          {data.revenues.map((row, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.account_code}</Text>
              <Text style={styles.tableCell}>{row.account_name}</Text>
              <Text style={styles.tableCellRight}>{row.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={styles.tableCell}>Total Revenue</Text>
            <Text style={styles.tableCell}></Text>
            <Text style={styles.tableCellRight}>{data.total_revenue.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          {data.expenses.map((row, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.account_code}</Text>
              <Text style={styles.tableCell}>{row.account_name}</Text>
              <Text style={styles.tableCellRight}>{row.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={styles.tableCell}>Total Expenses</Text>
            <Text style={styles.tableCell}></Text>
            <Text style={styles.tableCellRight}>{data.total_expenses.toFixed(2)}</Text>
          </View>
        </View>

        <View style={[styles.tableRow, styles.totalRow, { marginTop: 20 }]}>
          <Text style={styles.tableCell}>Net Income</Text>
          <Text style={styles.tableCell}></Text>
          <Text style={styles.tableCellRight}>{data.net_income.toFixed(2)}</Text>
        </View>
      </Page>
    </Document>
  );
}

// Balance Sheet PDF
export function BalanceSheetPDF({
  data,
  companyName,
  companyLogo,
}: {
  data: BalanceSheet;
  companyName: string;
  companyLogo?: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {companyLogo && <Image src={companyLogo} style={styles.logo} />}
          <Text style={styles.title}>{companyName}</Text>
          <Text style={styles.subtitle}>Balance Sheet</Text>
          <Text style={styles.subtitle}>As of {data.as_of_date}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assets</Text>
          {data.assets.map((row, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.account_code}</Text>
              <Text style={styles.tableCell}>{row.account_name}</Text>
              <Text style={styles.tableCellRight}>{row.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={styles.tableCell}>Total Assets</Text>
            <Text style={styles.tableCell}></Text>
            <Text style={styles.tableCellRight}>{data.total_assets.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liabilities</Text>
          {data.liabilities.map((row, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.account_code}</Text>
              <Text style={styles.tableCell}>{row.account_name}</Text>
              <Text style={styles.tableCellRight}>{row.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={styles.tableCell}>Total Liabilities</Text>
            <Text style={styles.tableCell}></Text>
            <Text style={styles.tableCellRight}>{data.total_liabilities.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equity</Text>
          {data.equity.map((row, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.account_code}</Text>
              <Text style={styles.tableCell}>{row.account_name}</Text>
              <Text style={styles.tableCellRight}>{row.amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={styles.tableCell}>Total Equity</Text>
            <Text style={styles.tableCell}></Text>
            <Text style={styles.tableCellRight}>{data.total_equity.toFixed(2)}</Text>
          </View>
        </View>

        <View style={[styles.tableRow, styles.totalRow, { marginTop: 20 }]}>
          <Text style={styles.tableCell}>Total Liabilities & Equity</Text>
          <Text style={styles.tableCell}></Text>
          <Text style={styles.tableCellRight}>
            {(data.total_liabilities + data.total_equity).toFixed(2)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// General Ledger PDF
export function GeneralLedgerPDF({
  data,
  companyName,
  companyLogo,
}: {
  data: GeneralLedgerReport;
  companyName: string;
  companyLogo?: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {companyLogo && <Image src={companyLogo} style={styles.logo} />}
          <Text style={styles.title}>{companyName}</Text>
          <Text style={styles.subtitle}>General Ledger</Text>
          <Text style={styles.subtitle}>
            {data.account_code} - {data.account_name}
          </Text>
          <Text style={styles.subtitle}>
            {data.start_date} to {data.end_date}
          </Text>
        </View>

        <View style={{ marginBottom: 10 }}>
          <Text>Beginning Balance: {data.beginning_balance.toFixed(2)}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Date</Text>
            <Text style={styles.tableCell}>Entry Number</Text>
            <Text style={styles.tableCell}>Description</Text>
            <Text style={styles.tableCellRight}>Debit</Text>
            <Text style={styles.tableCellRight}>Credit</Text>
            <Text style={styles.tableCellRight}>Balance</Text>
          </View>
          {data.entries.map((entry, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{entry.date}</Text>
              <Text style={styles.tableCell}>{entry.entry_number}</Text>
              <Text style={styles.tableCell}>{entry.description}</Text>
              <Text style={styles.tableCellRight}>
                {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
              </Text>
              <Text style={styles.tableCellRight}>
                {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
              </Text>
              <Text style={styles.tableCellRight}>{entry.balance.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>
            Ending Balance: {data.ending_balance.toFixed(2)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
