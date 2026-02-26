# TEST-PLAN: Payments Feature

Generated: 2026-01-11
Spec Source: specs/payments/
Database: supabase
App URL: http://localhost:3000

---

## Pre-Test: Authentication

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUTH-1 | Login | 1. Navigate to http://localhost:3000 2. Enter credentials 3. Submit | Dashboard loads | Chrome MCP | [ ] |

### Credentials (try in order)
1. hossamsharif1990@gmail.com / Hossam1990@
2. halabija@gmail.com / (same password pattern)
3. husameldeenh@gmail.com / (same password pattern)

### **HARD STOP** - Auth Checkpoint
- [ ] Successfully logged in
- [ ] Dashboard visible

---

## Page: /payments (Payments List)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-UI-1 | Page loads | Navigate to /en/payments | Page renders with title "Payments" | Chrome | [ ] |
| PAY-UI-2 | Title visible | Check page header | "Payments" heading visible | Chrome | [ ] |
| PAY-UI-3 | Description visible | Check subtitle | "Track all payments received and made" visible | Chrome | [ ] |
| PAY-UI-4 | Add button | Check for button | "Record Payment" button visible | Chrome | [ ] |
| PAY-UI-5 | Export button | Check for button | "Export Report" button visible | Chrome | [ ] |
| PAY-UI-6 | Data table | Check table presence | Data table with columns visible | Chrome | [ ] |
| PAY-UI-7 | Filter dropdown | Check filter controls | Type filter dropdown visible | Chrome | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-i18n-1 | No raw keys | Scan all visible text | No "payments." or "common." prefixes visible | Chrome | [ ] |
| PAY-i18n-2 | Title translated | Check page title | Not showing "payments.title" | Chrome | [ ] |
| PAY-i18n-3 | Buttons translated | Check all buttons | All buttons have proper labels | Chrome | [ ] |
| PAY-i18n-4 | Table headers translated | Check column headers | Headers like "Reference", "Type", "Party" visible | Chrome | [ ] |
| PAY-i18n-5 | Filter options translated | Click filter dropdown | Options show "All Payments", "Received Only", "Made Only" | Chrome | [ ] |

### Functional Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-FN-1 | Filter all | Select "All Payments" | Shows all payments | Chrome | [ ] |
| PAY-FN-2 | Filter received | Select "Received Only" | Only received payments shown | Chrome | [ ] |
| PAY-FN-3 | Filter made | Select "Made Only" | Only made payments shown | Chrome | [ ] |
| PAY-FN-4 | Navigate to new | Click "Record Payment" | Navigates to /payments/new | Chrome | [ ] |
| PAY-FN-5 | Navigate to report | Click "Export Report" | Navigates to /payments/report | Chrome | [ ] |
| PAY-FN-6 | Search works | Type in search box | Table filters by search term | Chrome | [ ] |
| PAY-FN-7 | Actions menu | Click row actions button | Dropdown shows View, Delete | Chrome | [ ] |

### Mobile Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-MOB-1 | Responsive layout | Set viewport 375x812 | Layout adapts, no horizontal scroll | Chrome | [ ] |
| PAY-MOB-2 | Table responsive | Set viewport 375x812 | Table scrollable or adapted | Chrome | [ ] |
| PAY-MOB-3 | Buttons visible | Set viewport 375x812 | Action buttons accessible | Chrome | [ ] |

### **HARD STOP** - Payments List Complete
- [ ] All UI tests pass
- [ ] All i18n tests pass
- [ ] All functional tests pass
- [ ] All mobile tests pass

---

## Page: /payments/new (New Payment)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-NEW-UI-1 | Page loads | Navigate to /en/payments/new | Page renders | Chrome | [ ] |
| PAY-NEW-UI-2 | Title visible | Check header | "Record Payment" heading visible | Chrome | [ ] |
| PAY-NEW-UI-3 | Back button | Check for back arrow | Back navigation button visible | Chrome | [ ] |
| PAY-NEW-UI-4 | Tabs visible | Check tab interface | "Received" and "Made" tabs visible | Chrome | [ ] |
| PAY-NEW-UI-5 | Form card | Check form container | Card with form fields visible | Chrome | [ ] |
| PAY-NEW-UI-6 | Party dropdown | Check form | Customer/Supplier dropdown visible | Chrome | [ ] |
| PAY-NEW-UI-7 | Amount field | Check form | Amount input with $ icon visible | Chrome | [ ] |
| PAY-NEW-UI-8 | Currency dropdown | Check form | Currency selector visible | Chrome | [ ] |
| PAY-NEW-UI-9 | Date picker | Check form | Payment date field visible | Chrome | [ ] |
| PAY-NEW-UI-10 | Method dropdown | Check form | Payment method selector visible | Chrome | [ ] |
| PAY-NEW-UI-11 | Submit button | Check form | "Record Payment" button visible | Chrome | [ ] |
| PAY-NEW-UI-12 | Cancel button | Check form | "Cancel" button visible | Chrome | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-NEW-i18n-1 | No raw keys | Scan all text | No translation keys visible | Chrome | [ ] |
| PAY-NEW-i18n-2 | Tab labels | Check tabs | "Received" and "Made" properly translated | Chrome | [ ] |
| PAY-NEW-i18n-3 | Form labels | Check all labels | Customer, Amount, Currency, etc. translated | Chrome | [ ] |
| PAY-NEW-i18n-4 | Placeholders | Check input placeholders | Proper placeholder text | Chrome | [ ] |
| PAY-NEW-i18n-5 | Button labels | Check buttons | Cancel and Record Payment translated | Chrome | [ ] |

### Functional Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-NEW-FN-1 | Tab switch | Click "Made" tab | Form switches to supplier selection | Chrome | [ ] |
| PAY-NEW-FN-2 | Tab switch back | Click "Received" tab | Form switches to customer selection | Chrome | [ ] |
| PAY-NEW-FN-3 | Cancel navigation | Click Cancel | Returns to payments list | Chrome | [ ] |
| PAY-NEW-FN-4 | Back navigation | Click back arrow | Returns to payments list | Chrome | [ ] |
| PAY-NEW-FN-5 | Validation - empty | Submit empty form | Shows validation errors | Chrome | [ ] |
| PAY-NEW-FN-6 | Party selection | Click party dropdown | Shows list of customers | Chrome | [ ] |
| PAY-NEW-FN-7 | Currency change | Change currency | Updates form | Chrome | [ ] |
| PAY-NEW-FN-8 | Method selection | Select payment method | Method selected properly | Chrome | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-NEW-CRUD-1 | Create received | 1. Select customer 2. Enter 100 3. Select Cash 4. Submit | Payment created, redirects to list | Chrome+DB | [ ] |
| PAY-NEW-CRUD-2 | Verify in DB | Check payments table | New record exists with correct data | Supabase | [ ] |
| PAY-NEW-CRUD-3 | Balance updated | Check customer balance | Balance decreased by payment amount | Supabase | [ ] |
| PAY-NEW-CRUD-4 | Create made | 1. Switch to Made 2. Select supplier 3. Enter 50 4. Submit | Payment created | Chrome+DB | [ ] |

### Mobile Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-NEW-MOB-1 | Form layout | Set viewport 375x812 | Form adapts to mobile | Chrome | [ ] |
| PAY-NEW-MOB-2 | Tabs usable | Set viewport 375x812 | Tabs tappable | Chrome | [ ] |
| PAY-NEW-MOB-3 | Inputs accessible | Set viewport 375x812 | All inputs reachable | Chrome | [ ] |

### **HARD STOP** - New Payment Complete
- [ ] All UI tests pass
- [ ] All i18n tests pass
- [ ] All functional tests pass
- [ ] All CRUD tests pass
- [ ] All mobile tests pass

---

## Page: /payments/report (Payments Report)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-RPT-UI-1 | Page loads | Navigate to /en/payments/report | Page renders | Chrome | [ ] |
| PAY-RPT-UI-2 | Title visible | Check header | "Payments Report" heading visible | Chrome | [ ] |
| PAY-RPT-UI-3 | Filter card | Check left panel | Report Options card visible | Chrome | [ ] |
| PAY-RPT-UI-4 | Preview card | Check right panel | Preview card visible | Chrome | [ ] |
| PAY-RPT-UI-5 | Type filter | Check filters | Payment type dropdown visible | Chrome | [ ] |
| PAY-RPT-UI-6 | Party filter | Check filters | Party filter dropdown visible | Chrome | [ ] |
| PAY-RPT-UI-7 | Method filter | Check filters | Payment method dropdown visible | Chrome | [ ] |
| PAY-RPT-UI-8 | Date from | Check filters | Date from input visible | Chrome | [ ] |
| PAY-RPT-UI-9 | Date to | Check filters | Date to input visible | Chrome | [ ] |
| PAY-RPT-UI-10 | Preview button | Check buttons | "Preview Report" button visible | Chrome | [ ] |
| PAY-RPT-UI-11 | Download button | Check buttons | "Download PDF" button visible | Chrome | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-RPT-i18n-1 | No raw keys | Scan all text | No translation keys visible | Chrome | [ ] |
| PAY-RPT-i18n-2 | Labels translated | Check all labels | Type, Party, Method, Date labels translated | Chrome | [ ] |
| PAY-RPT-i18n-3 | Button labels | Check buttons | Preview and Download buttons translated | Chrome | [ ] |

### Functional Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-RPT-FN-1 | Preview generate | Click Preview | PDF preview appears in iframe | Chrome | [ ] |
| PAY-RPT-FN-2 | Filter by type | Select "Received Only" then Preview | Preview shows only received | Chrome | [ ] |
| PAY-RPT-FN-3 | Filter by party | Select specific party then Preview | Preview filtered by party | Chrome | [ ] |
| PAY-RPT-FN-4 | Date range | Set date range then Preview | Preview shows filtered data | Chrome | [ ] |
| PAY-RPT-FN-5 | Download PDF | Click Download PDF | PDF file downloads | Chrome | [ ] |
| PAY-RPT-FN-6 | Back navigation | Click back arrow | Returns to payments list | Chrome | [ ] |

### Mobile Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-RPT-MOB-1 | Layout stacks | Set viewport 375x812 | Cards stack vertically | Chrome | [ ] |
| PAY-RPT-MOB-2 | Filters usable | Set viewport 375x812 | All filter controls accessible | Chrome | [ ] |

### **HARD STOP** - Payments Report Complete
- [ ] All UI tests pass
- [ ] All i18n tests pass
- [ ] All functional tests pass
- [ ] All mobile tests pass

---

## Delete Payment Flow

### Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-DEL-1 | Open dialog | Click actions > Delete | Confirmation dialog appears | Chrome | [ ] |
| PAY-DEL-2 | Dialog text | Read dialog | Shows proper warning message | Chrome | [ ] |
| PAY-DEL-3 | Cancel delete | Click Cancel | Dialog closes, payment remains | Chrome | [ ] |
| PAY-DEL-4 | Confirm delete | Click Delete button | Payment removed from list | Chrome | [ ] |
| PAY-DEL-5 | DB verified | Check payments table | Record deleted | Supabase | [ ] |
| PAY-DEL-6 | Balance reversed | Check party balance | Balance increased by deleted amount | Supabase | [ ] |
| PAY-DEL-7 | Toast shown | After delete | Success toast appears | Chrome | [ ] |

### **HARD STOP** - Delete Flow Complete
- [ ] Delete flow works correctly
- [ ] Balance properly reversed

---

## Cross-Browser Console Errors

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAY-ERR-1 | No console errors on list | Navigate to /payments, check console | No JS errors | Chrome | [ ] |
| PAY-ERR-2 | No console errors on new | Navigate to /payments/new, check console | No JS errors | Chrome | [ ] |
| PAY-ERR-3 | No console errors on report | Navigate to /payments/report, check console | No JS errors | Chrome | [ ] |

---

## Success Criteria

- All [ ] marked as [x]
- All fixes committed with format: `fix(payments): [description]`
- No console errors in TEST-REPORT.md
- All screenshots saved to specs/payments/screenshots/

Output: `<promise>ALL_TESTS_COMPLETE</promise>` when done

If >50% tests blocked: Output `<promise>BLOCKED</promise>`
