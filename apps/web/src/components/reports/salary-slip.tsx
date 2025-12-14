/**
 * Salary Slip PDF Template
 * Individual salary slip for employees using @react-pdf/renderer
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
    borderBottom: '2pt solid #000',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  employeeInfo: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    width: '40%',
    fontWeight: 'bold',
  },
  infoValue: {
    width: '60%',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    backgroundColor: '#e0e0e0',
    padding: 5,
  },
  detailsGrid: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottom: '1pt solid #e0e0e0',
  },
  detailLabel: {
    flex: 1,
  },
  detailValue: {
    width: '30%',
    textAlign: 'right',
  },
  summary: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
  },
  summaryValue: {
    fontSize: 11,
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
    borderTop: '1pt solid #ddd',
    paddingTop: 10,
  },
});

interface SalarySlipProps {
  employee: {
    employee_number: string;
    full_name: string;
    department?: string;
    position?: string;
  };
  payrollRun: {
    period_start: string;
    period_end: string;
    created_at: string;
  };
  payrollItem: {
    work_days: number;
    work_hours: number;
    overtime_hours: number;
    base_salary: number;
    overtime_pay: number;
    bonuses: number;
    gross_pay: number;
    deductions: number;
    net_pay: number;
    currency: string;
  };
  companyName?: string;
}

export function SalarySlip({
  employee,
  payrollRun,
  payrollItem,
  companyName = 'Company Name',
}: SalarySlipProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `${payrollItem.currency} ${amount.toFixed(2)}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.title}>SALARY SLIP</Text>
          <Text style={{ textAlign: 'center', fontSize: 10, marginTop: 5 }}>
            {formatDate(payrollRun.period_start)} -{' '}
            {formatDate(payrollRun.period_end)}
          </Text>
        </View>

        {/* Employee Information */}
        <View style={styles.employeeInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Employee Number:</Text>
            <Text style={styles.infoValue}>{employee.employee_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Employee Name:</Text>
            <Text style={styles.infoValue}>{employee.full_name}</Text>
          </View>
          {employee.department && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Department:</Text>
              <Text style={styles.infoValue}>{employee.department}</Text>
            </View>
          )}
          {employee.position && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Position:</Text>
              <Text style={styles.infoValue}>{employee.position}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Pay Period:</Text>
            <Text style={styles.infoValue}>
              {formatDate(payrollRun.period_start)} -{' '}
              {formatDate(payrollRun.period_end)}
            </Text>
          </View>
        </View>

        {/* Attendance Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Working Days</Text>
              <Text style={styles.detailValue}>{payrollItem.work_days}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Regular Hours</Text>
              <Text style={styles.detailValue}>
                {payrollItem.work_hours.toFixed(2)}h
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Overtime Hours</Text>
              <Text style={styles.detailValue}>
                {payrollItem.overtime_hours.toFixed(2)}h
              </Text>
            </View>
          </View>
        </View>

        {/* Earnings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Base Salary</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(payrollItem.base_salary)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Overtime Pay</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(payrollItem.overtime_pay)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bonuses / Allowances</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(payrollItem.bonuses)}
              </Text>
            </View>
            <View
              style={[
                styles.detailRow,
                { fontWeight: 'bold', borderTop: '1pt solid #000' },
              ]}
            >
              <Text style={styles.detailLabel}>Total Gross Pay</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(payrollItem.gross_pay)}
              </Text>
            </View>
          </View>
        </View>

        {/* Deductions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deductions</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Deductions</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(payrollItem.deductions)}
              </Text>
            </View>
          </View>
        </View>

        {/* Net Pay Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Gross Pay:</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(payrollItem.gross_pay)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Deductions:</Text>
            <Text style={styles.summaryValue}>
              ({formatCurrency(payrollItem.deductions)})
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Pay:</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(payrollItem.net_pay)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This is a computer-generated salary slip and does not require a
          signature.
          {'\n'}
          Generated on {formatDate(payrollRun.created_at)}
        </Text>
      </Page>
    </Document>
  );
}
