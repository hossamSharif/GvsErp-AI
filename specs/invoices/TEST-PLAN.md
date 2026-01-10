# TEST-PLAN: Invoices Feature (Sales & Purchases)

Generated: 2026-01-10
Spec Source: specs/001-modular-erp-saas/ (User Story 2 & 3)
Database: Supabase
App URL: http://localhost:3000

---

## Pre-Test: Authentication

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUTH-1 | Login to application | Navigate to /en/login -> Enter credentials -> Submit | Dashboard loads | Chrome MCP | [ ] |

**Authentication Credentials (in order of priority):**
1. hossamsharif1990@gmail.com / Hossam1990@
2. halabija@gmail.com / Hossam1990@
3. husameldeenh@gmail.com / Hossam1990@

### **HARD STOP** - Auth Checkpoint
- [ ] Successfully logged into the application
- [ ] Dashboard is visible

---

## Section 1: Invoices List Page (/invoices)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| INV-UI-1 | Page Load | Navigate to /en/invoices | Page renders with tabs (Sales/Purchases) | Chrome MCP | [ ] |
| INV-UI-2 | Sales Tab Active | Click Sales tab | Sales invoices table displayed | Chrome MCP | [ ] |
| INV-UI-3 | Purchases Tab | Click Purchases tab | Purchase orders table displayed | Chrome MCP | [ ] |
| INV-UI-4 | Stats Cards | View page | 4 stat cards visible (Total, Drafts, Finalized, This Page Total) | Chrome MCP | [ ] |
| INV-UI-5 | Search Input | Locate search input | Search input with placeholder exists | Chrome MCP | [ ] |
| INV-UI-6 | Status Filter | Locate status dropdown | Filter dropdown with All/Draft/Final/Returned/Canceled options | Chrome MCP | [ ] |
| INV-UI-7 | Add Button | Click "New Sale" button | Navigates to /en/sales/new | Chrome MCP | [ ] |
| INV-UI-8 | Export Button | Locate Export button | Export button is visible | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| INV-i18n-1 | English Labels | Navigate to /en/invoices | All labels in English: "Invoices", "Sales Invoices", "Purchase Orders" | Chrome MCP | [ ] |
| INV-i18n-2 | Arabic Labels | Navigate to /ar/invoices | All labels in Arabic: "الفواتير", "فواتير المبيعات", "أوامر الشراء" | Chrome MCP | [ ] |
| INV-i18n-3 | RTL Layout | View Arabic page | Layout is RTL, text aligned correctly | Chrome MCP | [ ] |
| INV-i18n-4 | Status Translations EN | View English status badges | Draft, Finalized, Returned, Canceled | Chrome MCP | [ ] |
| INV-i18n-5 | Status Translations AR | View Arabic status badges | مسودة، معتمد، مرتجع، ملغي | Chrome MCP | [ ] |
| INV-i18n-6 | No Raw Keys | Scan page | No translation keys like "invoices.title" visible | Chrome MCP | [ ] |

### **HARD STOP** - Invoices List Page Complete
- [ ] All UI tests pass
- [ ] All i18n tests pass

---

## Section 2: Sales Invoice - Create New (/sales/new)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-NEW-UI-1 | Page Load | Navigate to /en/sales/new | New sale form page loads | Chrome MCP | [ ] |
| SAL-NEW-UI-2 | Customer Select | Locate customer dropdown | Searchable customer dropdown exists | Chrome MCP | [ ] |
| SAL-NEW-UI-3 | Warehouse Select | Locate warehouse dropdown | Warehouse selection dropdown exists | Chrome MCP | [ ] |
| SAL-NEW-UI-4 | Items Table | Locate items section | Items table with add item button | Chrome MCP | [ ] |
| SAL-NEW-UI-5 | Add Item | Click add item | Item row appears or item selector opens | Chrome MCP | [ ] |
| SAL-NEW-UI-6 | Summary Section | View summary | Subtotal, Tax, Discount, Total fields visible | Chrome MCP | [ ] |
| SAL-NEW-UI-7 | Notes Field | Locate notes | Notes textarea exists | Chrome MCP | [ ] |
| SAL-NEW-UI-8 | Save Button | Locate save button | Save/Create button visible | Chrome MCP | [ ] |
| SAL-NEW-UI-9 | Autosave Indicator | Wait 3 seconds after changes | Autosave status indicator shows | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-CRUD-1 | Create Draft Invoice | Fill form -> Save | Draft invoice created, redirects to detail page | Chrome MCP + Supabase | [ ] |
| SAL-CRUD-2 | Verify in Database | Query invoices table | New record exists with status='draft', type='sale' | Supabase | [ ] |
| SAL-CRUD-3 | Invoice Number Generated | Check invoice number | Format SAL-YYYYMM-XXXX | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-NEW-i18n-1 | English Form | View /en/sales/new | All labels in English | Chrome MCP | [ ] |
| SAL-NEW-i18n-2 | Arabic Form | View /ar/sales/new | All labels in Arabic, RTL layout | Chrome MCP | [ ] |

### **HARD STOP** - Sales Create Complete
- [ ] Can create a new sales invoice
- [ ] Invoice number auto-generated
- [ ] Draft saved in database

---

## Section 3: Sales Invoice - View & Finalize (/sales/[id])

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-VIEW-UI-1 | View Invoice | Navigate to /en/sales/{id} | Invoice detail page loads | Chrome MCP | [ ] |
| SAL-VIEW-UI-2 | Invoice Header | View header | Invoice number, status badge, customer info displayed | Chrome MCP | [ ] |
| SAL-VIEW-UI-3 | Items List | View items section | All invoice items displayed with qty, price, total | Chrome MCP | [ ] |
| SAL-VIEW-UI-4 | Totals Summary | View totals | Subtotal, Tax, Discount, Grand Total correct | Chrome MCP | [ ] |
| SAL-VIEW-UI-5 | Action Buttons | Locate actions | Edit (if draft), Finalize, Print, Export PDF buttons | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-FIN-1 | Finalize Invoice | Click Finalize -> Confirm | Invoice status changes to 'final' | Chrome MCP + Supabase | [ ] |
| SAL-FIN-2 | Stock Updated | Check inventory | Stock levels decreased for sold items | Supabase | [ ] |
| SAL-FIN-3 | Customer Balance Updated | Check party balance | Customer balance increased by invoice total | Supabase | [ ] |
| SAL-FIN-4 | Cannot Edit Final | Try to edit finalized invoice | Edit button disabled or not visible | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-VIEW-i18n-1 | Finalize Dialog EN | Click Finalize in English | Dialog in English with proper text | Chrome MCP | [ ] |
| SAL-VIEW-i18n-2 | Finalize Dialog AR | Click Finalize in Arabic | Dialog in Arabic with proper text | Chrome MCP | [ ] |

### **HARD STOP** - Sales View & Finalize Complete
- [ ] Invoice detail page works
- [ ] Finalize flow works
- [ ] Stock and balances update correctly

---

## Section 4: Sales Invoice - Edit Draft (/sales/[id]/edit)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-EDIT-UI-1 | Edit Page Load | Navigate to /en/sales/{draft_id}/edit | Edit form loads with existing data | Chrome MCP | [ ] |
| SAL-EDIT-UI-2 | Pre-filled Data | Check form fields | Customer, items, totals pre-populated | Chrome MCP | [ ] |
| SAL-EDIT-UI-3 | Modify Item Qty | Change item quantity | Total recalculates | Chrome MCP | [ ] |
| SAL-EDIT-UI-4 | Add New Item | Add another item | Item added, totals update | Chrome MCP | [ ] |
| SAL-EDIT-UI-5 | Remove Item | Remove an item | Item removed, totals update | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-EDIT-CRUD-1 | Save Changes | Modify and save | Changes persisted in database | Chrome MCP + Supabase | [ ] |
| SAL-EDIT-CRUD-2 | Autosave Works | Make changes, wait | Changes auto-saved | Chrome MCP + Supabase | [ ] |

### **HARD STOP** - Sales Edit Complete
- [ ] Can edit draft invoices
- [ ] Changes save correctly
- [ ] Autosave working

---

## Section 5: Sales Invoice - Return (/sales/[id] with return)

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SAL-RET-1 | Create Return | Open final invoice -> Create Return | Return invoice created, linked to original | Chrome MCP + Supabase | [ ] |
| SAL-RET-2 | Return Status | Check return invoice | Status is 'returned' | Chrome MCP | [ ] |
| SAL-RET-3 | Stock Restored | Check inventory | Stock levels increased for returned items | Supabase | [ ] |
| SAL-RET-4 | Balance Adjusted | Check party balance | Customer balance decreased | Supabase | [ ] |

### **HARD STOP** - Sales Return Complete
- [ ] Return invoice creation works
- [ ] Stock and balances adjust correctly

---

## Section 6: Purchase Order - Create New (/purchases/new)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PUR-NEW-UI-1 | Page Load | Navigate to /en/purchases/new | New purchase form page loads | Chrome MCP | [ ] |
| PUR-NEW-UI-2 | Supplier Select | Locate supplier dropdown | Searchable supplier dropdown exists | Chrome MCP | [ ] |
| PUR-NEW-UI-3 | Warehouse Select | Locate warehouse dropdown | Warehouse selection dropdown exists | Chrome MCP | [ ] |
| PUR-NEW-UI-4 | Items Table | Locate items section | Items table with add item button | Chrome MCP | [ ] |
| PUR-NEW-UI-5 | Current Stock Display | Add item | Current stock level shown for reference | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PUR-CRUD-1 | Create Draft Purchase | Fill form -> Save | Draft purchase created | Chrome MCP + Supabase | [ ] |
| PUR-CRUD-2 | Verify in Database | Query invoices table | New record exists with status='draft', type='purchase' | Supabase | [ ] |
| PUR-CRUD-3 | Invoice Number Generated | Check invoice number | Format PUR-YYYYMM-XXXX | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PUR-NEW-i18n-1 | English Form | View /en/purchases/new | All labels in English | Chrome MCP | [ ] |
| PUR-NEW-i18n-2 | Arabic Form | View /ar/purchases/new | All labels in Arabic, RTL layout | Chrome MCP | [ ] |

### **HARD STOP** - Purchase Create Complete
- [ ] Can create a new purchase order
- [ ] Invoice number auto-generated (PUR format)
- [ ] Draft saved in database

---

## Section 7: Purchase Order - View & Finalize (/purchases/[id])

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PUR-VIEW-UI-1 | View Purchase | Navigate to /en/purchases/{id} | Purchase detail page loads | Chrome MCP | [ ] |
| PUR-VIEW-UI-2 | Purchase Header | View header | Invoice number, status badge, supplier info displayed | Chrome MCP | [ ] |
| PUR-VIEW-UI-3 | Items List | View items section | All purchase items displayed | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PUR-FIN-1 | Finalize Purchase | Click Finalize -> Confirm | Purchase status changes to 'final' | Chrome MCP + Supabase | [ ] |
| PUR-FIN-2 | Stock Increased | Check inventory | Stock levels INCREASED for purchased items | Supabase | [ ] |
| PUR-FIN-3 | Supplier Balance Updated | Check party balance | Supplier balance increased (we owe them) | Supabase | [ ] |

### **HARD STOP** - Purchase View & Finalize Complete
- [ ] Purchase detail page works
- [ ] Finalize flow works
- [ ] Stock INCREASES on purchase finalize

---

## Section 8: Purchase Order - Edit & Return

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PUR-EDIT-1 | Edit Draft Purchase | Navigate to edit, modify, save | Changes saved | Chrome MCP + Supabase | [ ] |
| PUR-RET-1 | Create Purchase Return | Open final purchase -> Create Return | Return created | Chrome MCP + Supabase | [ ] |
| PUR-RET-2 | Stock Adjusted | Check inventory | Stock decreased for returned items | Supabase | [ ] |

### **HARD STOP** - Purchase Edit & Return Complete
- [ ] Can edit draft purchases
- [ ] Return flow works correctly

---

## Section 9: Mobile Responsive Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| INV-MOB-1 | Invoices List Mobile | Set viewport 375x812, view /en/invoices | Layout responsive, usable | Chrome MCP | [ ] |
| INV-MOB-2 | New Sale Mobile | Set viewport 375x812, view /en/sales/new | Form usable on mobile | Chrome MCP | [ ] |
| INV-MOB-3 | Invoice Detail Mobile | Set viewport 375x812, view invoice detail | Content readable, actions accessible | Chrome MCP | [ ] |
| INV-MOB-4 | Tabs Responsive | Mobile viewport, switch tabs | Tabs work correctly | Chrome MCP | [ ] |

### **HARD STOP** - Mobile Tests Complete
- [ ] All pages responsive on mobile viewport

---

## Section 10: Cross-Feature Integration Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| INT-1 | Sales Navigation from Dashboard | Dashboard -> Click Sales link | Navigates to invoices/sales | Chrome MCP | [ ] |
| INT-2 | Party Link from Invoice | View invoice -> Click customer name | Navigates to customer detail | Chrome MCP | [ ] |
| INT-3 | Item Stock in Invoice | Add item to invoice | Stock availability shown | Chrome MCP | [ ] |
| INT-4 | PDF Export | Click Export PDF on invoice | PDF generates and downloads | Chrome MCP | [ ] |

### **HARD STOP** - Integration Tests Complete
- [ ] Navigation between features works
- [ ] Data consistency across features

---

## Success Criteria

- All [ ] marked as [x]
- All fixes committed with message format: `fix(invoices): [description]`
- TEST-REPORT.md generated
- Output `<promise>ALL_TESTS_COMPLETE</promise>`

---

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| hossamsharif1990@gmail.com | Hossam1990@ | Admin |
| halabija@gmail.com | Hossam1990@ | User |
| husameldeenh@gmail.com | Hossam1990@ | User |

---

## Console Error Policy

- Log all console errors to TEST-REPORT.md
- DO NOT stop testing on console errors
- Only stop if application is completely broken/blocked

---

## Fix Protocol

For any failing test:
1. Screenshot to specs/invoices/screenshots/[TEST-ID]-fail.png
2. Analyze root cause
3. Fix code
4. Commit: `git commit -m "fix(invoices): [description]"`
5. Re-test (max 3 attempts)
6. If still fails after 3 attempts: Mark BLOCKED, continue to next test
