# Test Plan: User Story 6 - Manage Customers, Suppliers, and Payments

**Test Date**: 2025-12-16
**Tester**: Claude Code (Automated)
**Test Environment**: Local Development with Chrome DevTools MCP

---

## User Story Summary

**As a** business owner
**I need to** manage customer and supplier records with auto-updating balances and flexible payment recording
**So that** I can track who owes me and who I owe

---

## Acceptance Scenarios (from spec.md)

| ID | Scenario | Expected Outcome |
|----|----------|------------------|
| AC-1 | Create customer record and create sales invoices | Customer balance updates automatically |
| AC-2 | Record a payment received from customer | Payment can be linked to specific invoices or applied to account generally |
| AC-3 | Generate payments report | See all received and made payments with PDF export |
| AC-4 | View customer balances report | See outstanding amounts per customer |

---

## Functional Requirements Coverage

| FR | Description | Test Coverage |
|----|-------------|---------------|
| FR-026 | Manage customer and supplier records linked to transactions | TC-001 to TC-005 |
| FR-027 | Auto-update balances based on invoices and payments | TC-006 to TC-009 |
| FR-028 | Allow payments recorded anytime (linked or general) | TC-010 to TC-013 |
| FR-029 | Provide preview and edit functionality for payments | TC-014 to TC-016 |
| FR-030 | Generate balance and payment reports exportable to PDF | TC-017 to TC-020 |

---

## Test Cases

### Section 1: Party (Customer/Supplier) Management

#### TC-001: Navigate to Customers Page
- **Steps**: Navigate to /en/customers
- **Expected**: Customers list page loads with data table
- **Pass Criteria**: Page renders without errors, table is visible

#### TC-002: Create New Customer
- **Steps**:
  1. Click "Add Customer" button
  2. Fill in required fields (name, type=customer)
  3. Submit form
- **Expected**: Customer is created and appears in list
- **Pass Criteria**: Success toast, customer in list, initial balance = 0

#### TC-003: Edit Customer
- **Steps**:
  1. Click on existing customer
  2. Edit customer details
  3. Save changes
- **Expected**: Customer details are updated
- **Pass Criteria**: Success toast, updated data reflected

#### TC-004: Navigate to Suppliers Page
- **Steps**: Navigate to /en/suppliers
- **Expected**: Suppliers list page loads with data table
- **Pass Criteria**: Page renders without errors

#### TC-005: Create New Supplier
- **Steps**:
  1. Click "Add Supplier" button
  2. Fill in required fields (name, type=supplier)
  3. Submit form
- **Expected**: Supplier is created and appears in list
- **Pass Criteria**: Success toast, supplier in list

### Section 2: Balance Auto-Update

#### TC-006: Customer Balance After Sales Invoice
- **Steps**:
  1. Create customer
  2. Create sales invoice for customer
  3. Finalize invoice
- **Expected**: Customer balance increases by invoice total
- **Pass Criteria**: Balance reflects invoice amount

#### TC-007: Customer Balance After Payment
- **Steps**:
  1. Record payment from customer
- **Expected**: Customer balance decreases by payment amount
- **Pass Criteria**: Balance correctly reduced

#### TC-008: Supplier Balance After Purchase Invoice
- **Steps**:
  1. Create supplier
  2. Create purchase invoice from supplier
  3. Finalize invoice
- **Expected**: Supplier balance (what we owe) increases
- **Pass Criteria**: Balance reflects purchase amount

#### TC-009: Supplier Balance After Payment
- **Steps**:
  1. Record payment to supplier
- **Expected**: Supplier balance decreases
- **Pass Criteria**: Balance correctly reduced

### Section 3: Payment Recording

#### TC-010: Navigate to Payments Page
- **Steps**: Navigate to /en/payments
- **Expected**: Payments list page loads
- **Pass Criteria**: Page renders, table visible

#### TC-011: Create Payment (General - Not Linked)
- **Steps**:
  1. Click "Add Payment"
  2. Select customer/supplier
  3. Enter amount
  4. Submit without linking to invoice
- **Expected**: Payment recorded as general account payment
- **Pass Criteria**: Payment in list, balance updated

#### TC-012: Create Payment Linked to Invoice
- **Steps**:
  1. Click "Add Payment"
  2. Select customer with outstanding invoices
  3. Link to specific invoice(s)
  4. Submit
- **Expected**: Payment linked to invoice, invoice status updates
- **Pass Criteria**: Payment shows linked invoice

#### TC-013: Edit Payment
- **Steps**:
  1. Select existing payment
  2. Modify amount or details
  3. Save
- **Expected**: Payment updated, balances recalculated
- **Pass Criteria**: Updated data, correct balance

### Section 4: Payment Preview and Edit

#### TC-014: View Payment Details
- **Steps**: Click on payment in list
- **Expected**: Payment detail view shows all info
- **Pass Criteria**: Amount, date, party, links visible

#### TC-015: Payment Form Validation
- **Steps**: Try to submit empty payment form
- **Expected**: Validation errors shown
- **Pass Criteria**: Required field errors displayed

#### TC-016: Payment Type Selection
- **Steps**: Test both "received" and "made" payment types
- **Expected**: Form adapts to show customer/supplier appropriately
- **Pass Criteria**: Correct party type filter

### Section 5: Reports

#### TC-017: Customer Balances Report Page
- **Steps**: Navigate to customer balances report
- **Expected**: Report shows all customers with outstanding balances
- **Pass Criteria**: Data accurate, totals correct

#### TC-018: Customer Balances PDF Export
- **Steps**: Click PDF export button
- **Expected**: PDF downloads with customer balance data
- **Pass Criteria**: PDF generates successfully

#### TC-019: Payments Report Page
- **Steps**: Navigate to payments report
- **Expected**: Report shows all payments with filters
- **Pass Criteria**: Filter by date, party, type works

#### TC-020: Payments Report PDF Export
- **Steps**: Click PDF export button
- **Expected**: PDF downloads with payment data
- **Pass Criteria**: PDF generates successfully

---

## Test Data Requirements

### Pre-existing Data
- At least 1 user account (login required)
- At least 2-3 items in inventory (for invoice testing)
- Warehouse configured (for stock)

### Test Data to Create
- 2 customers (TestCustomer1, TestCustomer2)
- 2 suppliers (TestSupplier1, TestSupplier2)
- Sales invoices for balance testing
- Purchase invoices for balance testing
- Multiple payment records

---

## Test Execution Checklist

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001 | [ ] Pending | |
| TC-002 | [ ] Pending | |
| TC-003 | [ ] Pending | |
| TC-004 | [ ] Pending | |
| TC-005 | [ ] Pending | |
| TC-006 | [ ] Pending | |
| TC-007 | [ ] Pending | |
| TC-008 | [ ] Pending | |
| TC-009 | [ ] Pending | |
| TC-010 | [ ] Pending | |
| TC-011 | [ ] Pending | |
| TC-012 | [ ] Pending | |
| TC-013 | [ ] Pending | |
| TC-014 | [ ] Pending | |
| TC-015 | [ ] Pending | |
| TC-016 | [ ] Pending | |
| TC-017 | [ ] Pending | |
| TC-018 | [ ] Pending | |
| TC-019 | [ ] Pending | |
| TC-020 | [ ] Pending | |

---

## Issues Found

| Issue ID | Test Case | Description | Severity | Status |
|----------|-----------|-------------|----------|--------|
| | | | | |

---

## Test Environment

- **Frontend**: Next.js (localhost:3000)
- **Backend**: Express API (localhost:3001)
- **Database**: Supabase
- **Browser**: Chrome with DevTools MCP
