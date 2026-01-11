# TEST-PLAN: Parties Feature

Generated: 2026-01-11
Spec Source: specs/parties/
Database: supabase
App URL: http://localhost:3000

---

## Pre-Test: Authentication

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUTH-1 | Login to app | 1. Navigate to http://localhost:3000/ar/login 2. Enter email: hossamsharif1990@gmail.com 3. Enter password: Hossam1990@ 4. Click login button | Redirect to dashboard | Chrome | [ ] |

### **HARD STOP** - Auth Checkpoint
- [ ] Logged in successfully
- [ ] Can see dashboard

---

## Page: /ar/parties (Main Parties Page)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAR-UI-1 | Page loads | Navigate to /ar/parties | Page renders with tabs | Chrome | [ ] |
| PAR-UI-2 | Customers tab visible | Check tabs section | "العملاء" tab with count badge | Chrome | [ ] |
| PAR-UI-3 | Suppliers tab visible | Check tabs section | "الموردين" tab with count badge | Chrome | [ ] |
| PAR-UI-4 | Data table renders | Check main content | Table with columns: name, phone, balance, tax, status, actions | Chrome | [ ] |
| PAR-UI-5 | Header actions | Check header | Export button and Add button visible | Chrome | [ ] |
| PAR-UI-6 | Tab switching | Click on Suppliers tab | Table shows supplier data | Chrome | [ ] |
| PAR-UI-7 | Actions dropdown | Click 3-dot menu on a row | Menu shows: View, Edit, Payment, Delete | Chrome | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAR-i18n-1 | Page title | Check page header | "العملاء" or "الموردين" (Arabic) | Chrome | [ ] |
| PAR-i18n-2 | Tab labels | Check tab buttons | "العملاء" and "الموردين" | Chrome | [ ] |
| PAR-i18n-3 | Add button | Check add button text | "إضافة عميل" or "إضافة مورد" | Chrome | [ ] |
| PAR-i18n-4 | Column headers | Check table headers | Arabic translations | Chrome | [ ] |
| PAR-i18n-5 | Status badges | Check status column | "نشط" or "غير نشط" | Chrome | [ ] |
| PAR-i18n-6 | Actions menu | Open dropdown | Arabic labels for all actions | Chrome | [ ] |
| PAR-i18n-7 | Export button | Check export button | "تصدير" | Chrome | [ ] |
| PAR-i18n-8 | No raw keys | Scan all visible text | No "parties." or "common." keys showing | Chrome | [ ] |

### RTL Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| PAR-RTL-1 | Page direction | Check body/html dir | dir="rtl" | Chrome | [ ] |
| PAR-RTL-2 | Tabs alignment | Check tabs layout | Tabs aligned right | Chrome | [ ] |
| PAR-RTL-3 | Dropdown alignment | Open actions menu | Menu opens to the left | Chrome | [ ] |

### **HARD STOP** - Parties Page Complete
- [ ] All UI tests pass
- [ ] All i18n tests pass
- [ ] All RTL tests pass

---

## Page: /ar/customers/new (Create Customer)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUS-NEW-UI-1 | Page loads | Navigate to /ar/customers/new | Form renders | Chrome | [ ] |
| CUS-NEW-UI-2 | Form fields | Check form | Name, Email, Phone, Address, Tax Number, Notes fields | Chrome | [ ] |
| CUS-NEW-UI-3 | Required indicator | Check Name field | Red asterisk visible | Chrome | [ ] |
| CUS-NEW-UI-4 | Back button | Check header | Back arrow button visible | Chrome | [ ] |
| CUS-NEW-UI-5 | Submit button | Check form footer | "Create Customer" button | Chrome | [ ] |
| CUS-NEW-UI-6 | Cancel button | Check form footer | Cancel button visible | Chrome | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUS-NEW-i18n-1 | Page title | Check header | "New Customer" - should check if Arabic | Chrome | [ ] |
| CUS-NEW-i18n-2 | Form labels | Check all labels | Arabic translations | Chrome | [ ] |
| CUS-NEW-i18n-3 | Card headers | Check card titles | Arabic translations | Chrome | [ ] |
| CUS-NEW-i18n-4 | Placeholders | Check input placeholders | Arabic or proper English | Chrome | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUS-NEW-CRUD-1 | Create with all fields | Fill all fields, submit | Success toast, redirect to detail page | Chrome | [ ] |
| CUS-NEW-CRUD-2 | Create with required only | Fill only name, submit | Success toast, redirect | Chrome | [ ] |
| CUS-NEW-CRUD-3 | Validation - empty name | Leave name empty, submit | Error message appears | Chrome | [ ] |
| CUS-NEW-CRUD-4 | Validation - invalid email | Enter "invalid-email", submit | Email validation error | Chrome | [ ] |
| CUS-NEW-CRUD-5 | Cancel button | Click cancel | Navigate back to customers list | Chrome | [ ] |

### **HARD STOP** - Create Customer Complete
- [ ] Form validation works
- [ ] Create customer succeeds
- [ ] Navigation works

---

## Page: /ar/customers/[id] (Customer Detail)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUS-DET-UI-1 | Page loads | Navigate to customer detail | Page renders with 3 cards | Chrome | [ ] |
| CUS-DET-UI-2 | Contact info card | Check first card | Email, Phone, Address, Tax, Status visible | Chrome | [ ] |
| CUS-DET-UI-3 | Balance card | Check second card | Balance amount with status | Chrome | [ ] |
| CUS-DET-UI-4 | Summary card | Check third card | Total Invoiced, Total Paid, Transaction count | Chrome | [ ] |
| CUS-DET-UI-5 | Transaction history | Check table | Date, Type, Reference, Debit, Credit, Balance columns | Chrome | [ ] |
| CUS-DET-UI-6 | Edit button | Check header | Edit button visible | Chrome | [ ] |
| CUS-DET-UI-7 | Record Payment button | Check header | Record Payment button visible | Chrome | [ ] |
| CUS-DET-UI-8 | Recalculate button | Check balance card | Recalculate Balance button | Chrome | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUS-DET-i18n-1 | Card titles | Check all card headers | Arabic translations | Chrome | [ ] |
| CUS-DET-i18n-2 | Button labels | Check Edit, Payment buttons | Arabic or proper labels | Chrome | [ ] |
| CUS-DET-i18n-3 | Status label | Check status badge | "نشط" or "غير نشط" | Chrome | [ ] |
| CUS-DET-i18n-4 | Table headers | Check transaction table | Arabic column headers | Chrome | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUS-DET-CRUD-1 | Recalculate balance | Click recalculate button | Success toast with new balance | Chrome | [ ] |
| CUS-DET-CRUD-2 | Navigate to edit | Click edit button | Redirect to edit page | Chrome | [ ] |
| CUS-DET-CRUD-3 | Navigate to payment | Click payment button | Redirect to payment page with partyId | Chrome | [ ] |

### **HARD STOP** - Customer Detail Complete
- [ ] All cards render correctly
- [ ] Actions work properly

---

## Page: /ar/suppliers/new (Create Supplier)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SUP-NEW-UI-1 | Page loads | Navigate to /ar/suppliers/new | Form renders | Chrome | [ ] |
| SUP-NEW-UI-2 | Form identical | Compare with customer form | Same fields | Chrome | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SUP-NEW-CRUD-1 | Create supplier | Fill name "Test Supplier", submit | Success toast, redirect | Chrome | [ ] |
| SUP-NEW-CRUD-2 | Verify type | Check in DB/list | Type is "supplier" | Chrome | [ ] |

### **HARD STOP** - Create Supplier Complete
- [ ] Supplier created with correct type

---

## Page: Delete Party Flow

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DEL-CRUD-1 | Open delete dialog | Click delete from menu | Confirmation dialog opens | Chrome | [ ] |
| DEL-CRUD-2 | Dialog content | Check dialog | Shows party name, warning text | Chrome | [ ] |
| DEL-CRUD-3 | Cancel delete | Click cancel | Dialog closes, party still exists | Chrome | [ ] |
| DEL-CRUD-4 | Confirm delete | Click delete button | Success toast, party removed from list | Chrome | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DEL-i18n-1 | Dialog title | Check dialog header | Arabic "Are you sure?" | Chrome | [ ] |
| DEL-i18n-2 | Dialog buttons | Check buttons | Arabic Cancel/Delete | Chrome | [ ] |

### **HARD STOP** - Delete Flow Complete
- [ ] Delete confirmation works
- [ ] Delete action succeeds

---

## Mobile Responsive Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| MOB-1 | Parties page 375px | Set viewport 375x812 | Table scrollable, layout intact | Chrome | [ ] |
| MOB-2 | Create form 375px | Set viewport, view form | Form stacks vertically | Chrome | [ ] |
| MOB-3 | Detail page 375px | Set viewport, view detail | Cards stack vertically | Chrome | [ ] |

### **HARD STOP** - Mobile Complete
- [ ] All pages responsive

---

## Final Summary Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SUM-1 | Tab counts | Check both tabs | Counts match actual data | Chrome | [ ] |
| SUM-2 | Pagination | Navigate pages | Page navigation works | Chrome | [ ] |
| SUM-3 | Search | Enter search term | Results filter correctly | Chrome | [ ] |
| SUM-4 | Sort by name | Click name column | Sorting works | Chrome | [ ] |

---

## Success Criteria

- All [ ] marked as [x]
- All fixes committed
- Output `<promise>ALL_TESTS_COMPLETE</promise>`

## Blocked Criteria

- >50% tests cannot pass
- Output `<promise>BLOCKED</promise>`
