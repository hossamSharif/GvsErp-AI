/**
 * Payroll Summary Report PDF Template
 * PDF template for payroll summary using @react-pdf/renderer
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

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
  tableColEmpNo: {
    width: '15%',
  },
  tableColName: {
    width: '25%',
  },
  tableColDept: {
    width: '15%',
  },
  tableColDays: {
    width: '10%',
    textAlign: 'center',
  },
  tableColAmount: {
    width: '12%',
    textAlign: 'right',
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
    color: '#999',
    fontSize: 8,
  },
});

interface PayrollItem {
  employee_id: string;
  employee_number: string;
  employee_name: string;
  department?: string;
  work_days: number;
  work_hours: number;
  base_salary: number;
  overtime_pay: number;
  bonuses: number;
  gross_pay: number;
  deductions: number;
  net_pay: number;
}

interface PayrollReportProps {
  payrollRun: {
    id: string;
    period_start: string;
    period_end: string;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    status: string;
    created_at: string;
  };
  items: PayrollItem[];
  companyName?: string;
}

export function PayrollReport({
  payrollRun,
  items,
  companyName = 'Company Name',
}: PayrollReportProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Payroll Summary Report</Text>
          <Text style={styles.subtitle}>{companyName}</Text>
          <Text style={styles.subtitle}>
            Period: {formatDate(payrollRun.period_start)} -{' '}
            {formatDate(payrollRun.period_end)}
          </Text>
          <Text style={styles.subtitle}>
            Generated: {formatDate(payrollRun.created_at)}
          </Text>
        </View>

        {/* Payroll Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee Payroll Details</Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.tableColEmpNo}>Emp #</Text>
            <Text style={styles.tableColName}>Name</Text>
            <Text style={styles.tableColDept}>Department</Text>
            <Text style={styles.tableColDays}>Days</Text>
            <Text style={styles.tableColAmount}>Base</Text>
            <Text style={styles.tableColAmount}>Overtime</Text>
            <Text style={styles.tableColAmount}>Gross</Text>
            <Text style={styles.tableColAmount}>Deductions</Text>
            <Text style={styles.tableColAmount}>Net Pay</Text>
          </View>

          {/* Table Rows */}
          {items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableColEmpNo}>{item.employee_number}</Text>
              <Text style={styles.tableColName}>{item.employee_name}</Text>
              <Text style={styles.tableColDept}>{item.department || '-'}</Text>
              <Text style={styles.tableColDays}>{item.work_days}</Text>
              <Text style={styles.tableColAmount}>
                {formatCurrency(item.base_salary)}
              </Text>
              <Text style={styles.tableColAmount}>
                {formatCurrency(item.overtime_pay)}
              </Text>
              <Text style={styles.tableColAmount}>
                {formatCurrency(item.gross_pay)}
              </Text>
              <Text style={styles.tableColAmount}>
                {formatCurrency(item.deductions)}
              </Text>
              <Text style={styles.tableColAmount}>
                {formatCurrency(item.net_pay)}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text
            style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}
          >
            Summary
          </Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Employees:</Text>
            <Text style={styles.summaryValue}>{items.length}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Work Days:</Text>
            <Text style={styles.summaryValue}>
              {items.reduce((sum, item) => sum + item.work_days, 0)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Gross Pay:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(payrollRun.total_gross)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Deductions:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(payrollRun.total_deductions)}
            </Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Net Pay:</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(payrollRun.total_net)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This is a computer-generated document. No signature required.
        </Text>
      </Page>
    </Document>
  );
}
