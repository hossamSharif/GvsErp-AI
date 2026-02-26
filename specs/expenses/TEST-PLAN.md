# TEST-PLAN: Expenses Feature

Generated: 2026-01-11
Spec Source: Codebase analysis (apps/web/src/app/[locale]/(dashboard)/expenses/)
Database: Supabase
App URL: http://localhost:3000

---

## Feature Overview

The Expenses feature enables:
- Creating and managing business expenses
- Categorizing expenses with custom categories
- Filtering and searching expenses
- Editing and deleting expenses
- Multi-currency support with exchange rates

### Routes Covered:
- `/expenses` - List all expenses with filters
- `/expenses/new` - Create new expense
- `/expenses/[id]` - Edit existing expense
- `/expenses/categories` - Manage expense categories

---

## Pre-Test: Authentication

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUTH-1 | Login to Dashboard | 1. Navigate to http://localhost:3000/ar/login 2. Enter email: hossamsharif1990@gmail.com 3. Enter password: Hossam1990@ 4. Click login | Redirect to dashboard | Chrome MCP | [ ] |

### **HARD STOP** - Auth Checkpoint
- [ ] Successfully logged in
- [ ] Dashboard visible

---

## Page: /expenses (Expenses List)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-LIST-UI-1 | Page Loads | Navigate to /ar/expenses | Page title visible | Chrome MCP | [ ] |
| EXP-LIST-UI-2 | Header Buttons | Check header area | "Manage Categories" and "New Expense" buttons visible | Chrome MCP | [ ] |
| EXP-LIST-UI-3 | Search Box | Locate search input | Search input with placeholder visible | Chrome MCP | [ ] |
| EXP-LIST-UI-4 | Category Filter | Locate category dropdown | Category filter dropdown visible | Chrome MCP | [ ] |
| EXP-LIST-UI-5 | Export Button | Locate export button | Export Report button visible | Chrome MCP | [ ] |
| EXP-LIST-UI-6 | Table Headers | Locate table | Columns: Date, Description, Category, Amount, Created By, Actions | Chrome MCP | [ ] |
| EXP-LIST-UI-7 | Empty State | If no expenses exist | Empty state or table with no data | Chrome MCP | [ ] |

### i18n Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-LIST-i18n-1 | Page Title | Check h1 text | "المصروفات" (not "expenses.title") | Chrome MCP | [ ] |
| EXP-LIST-i18n-2 | Subtitle | Check subtitle text | "تتبع وإدارة مصروفات الأعمال" | Chrome MCP | [ ] |
| EXP-LIST-i18n-3 | New Button | Check new expense button | "مصروف جديد" | Chrome MCP | [ ] |
| EXP-LIST-i18n-4 | Categories Button | Check manage categories button | "إدارة الفئات" | Chrome MCP | [ ] |
| EXP-LIST-i18n-5 | Search Placeholder | Check search placeholder | "البحث في المصروفات..." | Chrome MCP | [ ] |
| EXP-LIST-i18n-6 | Table Headers | Check table headers | Arabic: التاريخ، الوصف، الفئة، المبلغ، أنشأ بواسطة | Chrome MCP | [ ] |
| EXP-LIST-i18n-7 | All Categories | Check filter default | "كل الفئات" | Chrome MCP | [ ] |
| EXP-LIST-i18n-8 | Export Button | Check export button | "تصدير التقرير" | Chrome MCP | [ ] |

### Navigation Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-NAV-1 | New Expense Link | Click "مصروف جديد" button | Navigate to /ar/expenses/new | Chrome MCP | [ ] |
| EXP-NAV-2 | Categories Link | Click "إدارة الفئات" button | Navigate to /ar/expenses/categories | Chrome MCP | [ ] |
| EXP-NAV-3 | Edit Expense Link | Click edit on expense row | Navigate to /ar/expenses/[id] | Chrome MCP | [ ] |

### **HARD STOP** - Expenses List Complete
- [ ] All UI elements render correctly
- [ ] All translations display correctly (no raw keys)
- [ ] Navigation works

---

## Page: /expenses/new (New Expense)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-NEW-UI-1 | Page Loads | Navigate to /ar/expenses/new | Page title "New Expense" visible | Chrome MCP | [ ] |
| EXP-NEW-UI-2 | Back Button | Locate back button | Arrow left button visible | Chrome MCP | [ ] |
| EXP-NEW-UI-3 | Form Card | Locate form card | "Expense Details" card visible | Chrome MCP | [ ] |
| EXP-NEW-UI-4 | Date Field | Locate date input | Date picker visible | Chrome MCP | [ ] |
| EXP-NEW-UI-5 | Amount Field | Locate amount input | Amount input visible | Chrome MCP | [ ] |
| EXP-NEW-UI-6 | Currency Field | Locate currency input | Currency input visible (default USD) | Chrome MCP | [ ] |
| EXP-NEW-UI-7 | Exchange Rate | Locate exchange rate input | Exchange rate input visible | Chrome MCP | [ ] |
| EXP-NEW-UI-8 | Category Dropdown | Locate category selector | Category dropdown visible | Chrome MCP | [ ] |
| EXP-NEW-UI-9 | Description Field | Locate description textarea | Description textarea visible | Chrome MCP | [ ] |
| EXP-NEW-UI-10 | Submit Button | Locate submit button | "Create Expense" button visible | Chrome MCP | [ ] |

### i18n Tests (New Expense page uses hardcoded English - potential issue)
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-NEW-i18n-1 | Page Title | Check h1 text | Should be translated (currently "New Expense") | Chrome MCP | [ ] |
| EXP-NEW-i18n-2 | Subtitle | Check subtitle | Should be translated (currently "Create a new business expense") | Chrome MCP | [ ] |
| EXP-NEW-i18n-3 | Card Title | Check card header | Should be translated (currently "Expense Details") | Chrome MCP | [ ] |
| EXP-NEW-i18n-4 | Form Labels | Check form labels | Should be translated | Chrome MCP | [ ] |
| EXP-NEW-i18n-5 | Button Text | Check submit button | Should be translated (currently "Create Expense") | Chrome MCP | [ ] |

### Form Validation Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-FORM-1 | Empty Amount | Submit with amount = 0 | Validation error "Amount must be greater than 0" | Chrome MCP | [ ] |
| EXP-FORM-2 | Invalid Date | Submit with future date | Date picker should restrict future dates | Chrome MCP | [ ] |
| EXP-FORM-3 | Valid Submission | Fill all required fields, submit | Success toast, redirect to /expenses | Chrome MCP | [ ] |

### CRUD Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-CRUD-1 | Create Expense | 1. Fill date 2. Enter amount 100 3. Select category 4. Add description 5. Submit | New expense created, redirect to list | Chrome MCP + DB | [ ] |

### **HARD STOP** - New Expense Complete
- [ ] Form renders correctly
- [ ] Validation works
- [ ] Expense can be created

---

## Page: /expenses/[id] (Edit Expense)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-EDIT-UI-1 | Page Loads | Navigate to expense edit page | Page title "Edit Expense" visible | Chrome MCP | [ ] |
| EXP-EDIT-UI-2 | Back Button | Locate back button | Arrow left button visible | Chrome MCP | [ ] |
| EXP-EDIT-UI-3 | Form Prefilled | Check form fields | Fields populated with existing data | Chrome MCP | [ ] |
| EXP-EDIT-UI-4 | Update Button | Locate submit button | "Update Expense" button visible | Chrome MCP | [ ] |
| EXP-EDIT-UI-5 | Loading State | Navigate to edit page | Loading spinner during data fetch | Chrome MCP | [ ] |
| EXP-EDIT-UI-6 | Error State | Navigate with invalid ID | Error message displayed | Chrome MCP | [ ] |

### i18n Tests (Edit Expense page uses hardcoded English - potential issue)
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-EDIT-i18n-1 | Page Title | Check h1 text | Should be translated (currently "Edit Expense") | Chrome MCP | [ ] |
| EXP-EDIT-i18n-2 | Subtitle | Check subtitle | Should be translated (currently "Update expense details") | Chrome MCP | [ ] |
| EXP-EDIT-i18n-3 | Button Text | Check submit button | Should be translated (currently "Update Expense") | Chrome MCP | [ ] |

### CRUD Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-CRUD-2 | Update Expense | 1. Change amount 2. Update description 3. Submit | Expense updated, redirect to list | Chrome MCP + DB | [ ] |
| EXP-CRUD-3 | Delete Expense | 1. Go to list 2. Click delete on expense 3. Confirm | Expense deleted, removed from list | Chrome MCP + DB | [ ] |

### **HARD STOP** - Edit Expense Complete
- [ ] Form loads with existing data
- [ ] Update works
- [ ] Delete works

---

## Page: /expenses/categories (Expense Categories)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-CAT-UI-1 | Page Loads | Navigate to /ar/expenses/categories | Page title "Expense Categories" visible | Chrome MCP | [ ] |
| EXP-CAT-UI-2 | Back Button | Locate back button | Arrow left button visible | Chrome MCP | [ ] |
| EXP-CAT-UI-3 | New Category Button | Locate new button | "New Category" button visible | Chrome MCP | [ ] |
| EXP-CAT-UI-4 | Categories List | Locate categories | Categories card with list | Chrome MCP | [ ] |
| EXP-CAT-UI-5 | Category Actions | Check category row | Edit and Delete buttons visible | Chrome MCP | [ ] |
| EXP-CAT-UI-6 | Empty State | If no categories | "No categories yet" message | Chrome MCP | [ ] |

### i18n Tests (Categories page uses hardcoded English - potential issue)
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-CAT-i18n-1 | Page Title | Check h1 text | Should be translated (currently "Expense Categories") | Chrome MCP | [ ] |
| EXP-CAT-i18n-2 | Subtitle | Check subtitle | Should be translated | Chrome MCP | [ ] |
| EXP-CAT-i18n-3 | New Button | Check new button | Should be translated (currently "New Category") | Chrome MCP | [ ] |
| EXP-CAT-i18n-4 | Dialog Titles | Check dialog titles | Should be translated | Chrome MCP | [ ] |

### CRUD Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-CAT-CRUD-1 | Open Create Dialog | Click "New Category" button | Create dialog opens | Chrome MCP | [ ] |
| EXP-CAT-CRUD-2 | Create Category | 1. Enter name "فئة اختبار" 2. Click create | New category appears in list | Chrome MCP + DB | [ ] |
| EXP-CAT-CRUD-3 | Edit Category | 1. Click edit on category 2. Change name 3. Save | Category updated | Chrome MCP + DB | [ ] |
| EXP-CAT-CRUD-4 | Delete Category | 1. Click delete on category 2. Confirm | Category removed from list | Chrome MCP + DB | [ ] |

### **HARD STOP** - Categories Complete
- [ ] Page renders correctly
- [ ] CRUD operations work

---

## Mobile Responsiveness Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-MOB-1 | Expenses List Mobile | Resize to 375x812 | Layout adjusts, no horizontal scroll | Chrome MCP | [ ] |
| EXP-MOB-2 | New Expense Mobile | Resize to 375x812 | Form usable on mobile | Chrome MCP | [ ] |
| EXP-MOB-3 | Edit Expense Mobile | Resize to 375x812 | Form usable on mobile | Chrome MCP | [ ] |
| EXP-MOB-4 | Categories Mobile | Resize to 375x812 | Layout adjusts correctly | Chrome MCP | [ ] |

### **HARD STOP** - Mobile Tests Complete
- [ ] All pages mobile-friendly

---

## RTL Layout Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-RTL-1 | Page Direction | Check html/body dir | dir="rtl" for Arabic locale | Chrome MCP | [ ] |
| EXP-RTL-2 | Table Alignment | Check table | Text aligned correctly for RTL | Chrome MCP | [ ] |
| EXP-RTL-3 | Icons Position | Check icon placement | Icons on correct side for RTL | Chrome MCP | [ ] |
| EXP-RTL-4 | Form Layout | Check form fields | Labels and inputs aligned for RTL | Chrome MCP | [ ] |

### **HARD STOP** - RTL Tests Complete
- [ ] RTL layout correct

---

## Console Error Checks

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXP-CONSOLE-1 | Expenses List | Check console on /expenses | No errors | Chrome MCP | [ ] |
| EXP-CONSOLE-2 | New Expense | Check console on /expenses/new | No errors | Chrome MCP | [ ] |
| EXP-CONSOLE-3 | Edit Expense | Check console on /expenses/[id] | No errors | Chrome MCP | [ ] |
| EXP-CONSOLE-4 | Categories | Check console on /expenses/categories | No errors | Chrome MCP | [ ] |

### **HARD STOP** - Console Check Complete
- [ ] No critical console errors

---

## Known Issues to Fix

Based on code analysis, these issues are expected:
1. **i18n Missing**: `/expenses/new` page has hardcoded English text
2. **i18n Missing**: `/expenses/[id]` page has hardcoded English text
3. **i18n Missing**: `/expenses/categories` page has hardcoded English text
4. **i18n Keys**: Form component labels may need translation

---

## Test Summary

| Section | Test Count |
|---------|------------|
| Authentication | 1 |
| Expenses List | 18 |
| New Expense | 18 |
| Edit Expense | 11 |
| Categories | 14 |
| Mobile Tests | 4 |
| RTL Tests | 4 |
| Console Tests | 4 |
| **TOTAL** | **74** |

---

## Success Criteria

- All [ ] marked as [x] or BLOCKED
- All bug fixes committed with proper messages
- TEST-REPORT.md generated with fix details
- Output: `<promise>ALL_TESTS_COMPLETE</promise>`

---

## Test Account

```yaml
primary:
  email: hossamsharif1990@gmail.com
  password: Hossam1990@
  role: admin
```
