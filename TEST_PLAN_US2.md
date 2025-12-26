# Test Plan: User Story 2 - Create and Manage Sales Invoices

## Overview
**Feature**: Sales Invoice Management for ERP SaaS Platform
**Priority**: P1 (MVP Core Feature)
**Goal**: Create sales invoices with real-time stock preview, customer selection, item search, and flexible pricing

## User Story
As a sales person or business owner, I need to create sales invoices with real-time stock preview, customer selection, item search, and flexible pricing so that I can process sales transactions efficiently and maintain accurate records.

---

## Test Scenarios

### Scenario 1: Create Invoice with Real-Time Stock Preview
**Acceptance Criteria**: Given I am creating a new invoice, When I search and select items to add, Then I see real-time stock availability before confirming quantities

**Test Steps**:
1. Navigate to Sales page
2. Click "New Sale" button
3. Select a warehouse
4. Add an item using the item selector
5. Verify stock availability is displayed
6. Try to add more than available stock
7. Verify stock warning appears

**Expected Results**:
- Item search works correctly
- Stock availability is shown for each item
- Warning displayed when quantity exceeds stock
- Items can still be added (backorder support)

---

### Scenario 2: Excel-like Item List Interface
**Acceptance Criteria**: Given I am adding items to an invoice, When I use the item list interface, Then I can sort columns, hide/show columns, reorder items via drag-and-drop, and search within the list

**Test Steps**:
1. Add multiple items to an invoice
2. Test drag-and-drop reordering
3. Test inline editing of quantity/price/discount
4. Verify calculations update in real-time
5. Test column visibility (if implemented)

**Expected Results**:
- Drag-and-drop reordering works
- Inline editing updates values correctly
- Line totals recalculate automatically
- Invoice total updates in real-time

---

### Scenario 3: Customer Selection with Balance Preview
**Acceptance Criteria**: Given I select a customer via searchable dropdown, When customer is selected, Then their balance and relevant details are displayed

**Test Steps**:
1. Navigate to new invoice page
2. Open customer dropdown
3. Search for a customer
4. Select the customer
5. Verify balance and details are shown

**Expected Results**:
- Customer dropdown is searchable
- Customer balance is displayed after selection
- Customer contact info shown if available
- Walk-in option available (no customer required)

---

### Scenario 4: Local Autosave Draft Recovery
**Acceptance Criteria**: Given I am working on an invoice and close the browser unexpectedly, When I return to the invoice page, Then my draft data is restored from local autosave

**Test Steps**:
1. Start creating a new invoice
2. Add customer and items
3. Note the draft data
4. Navigate away or simulate browser close
5. Return to the invoice page
6. Verify draft data is restored

**Expected Results**:
- Draft is saved to localStorage automatically
- Draft persists across page navigation
- Draft can be restored after returning
- Draft data matches what was entered

---

### Scenario 5: Create Return Invoice from Finalized Invoice
**Acceptance Criteria**: Given I have a finalized invoice, When I need to process a return, Then I can create a returned invoice linked to the original

**Test Steps**:
1. Find a finalized invoice in the sales list
2. Open the invoice details
3. Click "Create Return" option
4. Select items to return
5. Complete the return
6. Verify stock is restored

**Expected Results**:
- Return option only available for finalized invoices
- Return invoice created and linked to original
- Stock levels updated (restored)
- Original invoice shows return reference

---

## Test Environment
- Browser: Chrome (via MCP DevTools)
- Frontend URL: http://localhost:3000
- Backend API: http://localhost:3001/api/v1
- Database: Supabase

## Test Data
- Test items with known stock levels
- Test customer with existing balance
- Test warehouse for stock tracking

## Pass/Fail Criteria
- All 5 acceptance scenarios must pass
- No critical bugs blocking core functionality
- Performance within acceptable limits (< 2s page load)

---

## Test Execution Results

**Test Date**: 2025-12-15
**Tester**: Automated testing via Chrome MCP DevTools
**Status**: In Progress

### Scenario 1: Create Invoice with Real-Time Stock Preview
**Status**: PENDING

### Scenario 2: Excel-like Item List Interface
**Status**: PENDING

### Scenario 3: Customer Selection with Balance Preview
**Status**: PENDING

### Scenario 4: Local Autosave Draft Recovery
**Status**: PENDING

### Scenario 5: Create Return Invoice from Finalized Invoice
**Status**: PENDING

---

## Summary

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Real-Time Stock Preview | PENDING | - |
| 2. Excel-like Item List | PENDING | - |
| 3. Customer Selection | PENDING | - |
| 4. Autosave Recovery | PENDING | - |
| 5. Return Invoice | PENDING | - |

### Bugs Found
(To be updated during testing)

### Overall Result: IN PROGRESS
