# TEST-PLAN: Settings Feature

Generated: 2026-01-11
Spec Source: specs/settings/
Database: Supabase
App URL: http://localhost:3000

---

## Pre-Test: Authentication

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUTH-1 | Login | Navigate to /en/login → Enter hossamsharif1990@gmail.com / Hossam1990@ → Submit | Redirect to dashboard | Chrome MCP | [ ] |

### **HARD STOP** - Auth Checkpoint
- [ ] Logged in successfully
- [ ] Dashboard visible

---

## Section 1: Settings Dashboard

**Route**: `/en/settings`

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SET-UI-1 | Page Load | Navigate to /en/settings | Page loads with title "Settings" | Chrome MCP | [ ] |
| SET-UI-2 | Cards Display | Check for 6 navigation cards | All cards visible: General, Users, Roles, Currencies, Exchange Rates, Subscription | Chrome MCP | [ ] |
| SET-UI-3 | Card Icons | Check each card has icon | Icons displayed correctly | Chrome MCP | [ ] |
| SET-UI-4 | Card Descriptions | Check each card has description text | Descriptions visible and translated | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SET-i18n-1 | English | Load /en/settings | All text in English | Chrome MCP | [ ] |
| SET-i18n-2 | Arabic | Load /ar/settings | All text in Arabic, RTL layout | Chrome MCP | [ ] |
| SET-i18n-3 | No Raw Keys | Scan page | No translation keys like "settings.title" visible | Chrome MCP | [ ] |

### Navigation Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SET-NAV-1 | General Link | Click General Settings card | Navigate to /en/settings/general | Chrome MCP | [ ] |
| SET-NAV-2 | Users Link | Click Users card | Navigate to /en/settings/users | Chrome MCP | [ ] |
| SET-NAV-3 | Roles Link | Click Roles card | Navigate to /en/settings/roles | Chrome MCP | [ ] |
| SET-NAV-4 | Currencies Link | Click Currencies card | Navigate to /en/settings/currencies | Chrome MCP | [ ] |
| SET-NAV-5 | Exchange Rates Link | Click Exchange Rates card | Navigate to /en/settings/exchange-rates | Chrome MCP | [ ] |
| SET-NAV-6 | Subscription Link | Click Subscription card | Navigate to /en/settings/subscription | Chrome MCP | [ ] |

### **HARD STOP** - Settings Dashboard Complete
- [ ] All 6 cards visible
- [ ] All navigation works
- [ ] i18n verified

---

## Section 2: General Settings

**Route**: `/en/settings/general`

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| GEN-UI-1 | Page Load | Navigate to /en/settings/general | Page loads with 4 sections | Chrome MCP | [ ] |
| GEN-UI-2 | Back Button | Check for back arrow | Back button visible | Chrome MCP | [ ] |
| GEN-UI-3 | Preferences Card | Verify Preferences section | Card with language, theme, currency, date format | Chrome MCP | [ ] |
| GEN-UI-4 | Company Card | Verify Company Info section | Card with logo, name, email, phone, address, tax | Chrome MCP | [ ] |
| GEN-UI-5 | Business Card | Verify Business Preferences | Card with fiscal year, timezone | Chrome MCP | [ ] |
| GEN-UI-6 | Modules Card | Verify Module Activation | Card with Accounting and HR toggles | Chrome MCP | [ ] |

### Form Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| GEN-FORM-1 | Language Dropdown | Click language dropdown | Shows English and Arabic options | Chrome MCP | [ ] |
| GEN-FORM-2 | Theme Dropdown | Click theme dropdown | Shows Light and Dark options | Chrome MCP | [ ] |
| GEN-FORM-3 | Currency Dropdown | Click currency dropdown | Shows available currencies | Chrome MCP | [ ] |
| GEN-FORM-4 | Date Format | Click date format dropdown | Shows DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD | Chrome MCP | [ ] |
| GEN-FORM-5 | Company Name | Enter company name | Accepts input | Chrome MCP | [ ] |
| GEN-FORM-6 | Email Validation | Enter invalid email | Shows validation error | Chrome MCP | [ ] |
| GEN-FORM-7 | Email Valid | Enter valid email | Accepts email | Chrome MCP | [ ] |
| GEN-FORM-8 | Accounting Toggle | Toggle Accounting Module | Switch state changes | Chrome MCP | [ ] |
| GEN-FORM-9 | HR Toggle | Toggle HR Module | Switch state changes | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| GEN-CRUD-1 | Save Settings | Fill form → Click Save | Success toast appears | Chrome MCP | [ ] |
| GEN-CRUD-2 | Persist Changes | Reload page | Values persist | Chrome MCP | [ ] |
| GEN-CRUD-3 | Cancel Button | Click Cancel | Returns to /en/settings | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| GEN-i18n-1 | Arabic Labels | Load /ar/settings/general | All labels in Arabic | Chrome MCP | [ ] |
| GEN-i18n-2 | No Raw Keys | Scan page | No translation keys visible | Chrome MCP | [ ] |

### **HARD STOP** - General Settings Complete
- [ ] All form fields work
- [ ] Save works
- [ ] Cancel works
- [ ] i18n verified

---

## Section 3: Users Management

**Route**: `/en/settings/users`

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| USR-UI-1 | Page Load | Navigate to /en/settings/users | Page loads with data table | Chrome MCP | [ ] |
| USR-UI-2 | Back Button | Check for back arrow | Back button visible | Chrome MCP | [ ] |
| USR-UI-3 | Add Button | Check for Add User button | Button visible | Chrome MCP | [ ] |
| USR-UI-4 | Table Headers | Check table columns | Name, Role, Status, Language, Actions visible | Chrome MCP | [ ] |
| USR-UI-5 | Search Field | Check for search input | Search placeholder visible | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| USR-CRUD-1 | Open Add Dialog | Click Add User button | Dialog opens with form | Chrome MCP | [ ] |
| USR-CRUD-2 | Create User | Fill form → Submit | User created, toast appears | Chrome MCP | [ ] |
| USR-CRUD-3 | Search User | Type in search box | Table filters results | Chrome MCP | [ ] |
| USR-CRUD-4 | Edit User | Click Edit from actions menu | Edit dialog opens with data | Chrome MCP | [ ] |
| USR-CRUD-5 | Update User | Modify user → Submit | User updated, toast appears | Chrome MCP | [ ] |
| USR-CRUD-6 | Deactivate User | Click Deactivate from actions | Status changes to Inactive | Chrome MCP | [ ] |
| USR-CRUD-7 | Delete User | Click Delete → Confirm | User deleted, removed from table | Chrome MCP | [ ] |

### Validation Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| USR-VAL-1 | Empty Name | Submit with empty name | Validation error shown | Chrome MCP | [ ] |
| USR-VAL-2 | Invalid Email | Enter invalid email format | Validation error shown | Chrome MCP | [ ] |
| USR-VAL-3 | Short Password | Enter <8 char password | Validation error shown | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| USR-i18n-1 | Arabic | Load /ar/settings/users | All text in Arabic | Chrome MCP | [ ] |
| USR-i18n-2 | No Raw Keys | Scan page | No translation keys visible | Chrome MCP | [ ] |

### **HARD STOP** - Users Complete
- [ ] CRUD operations work
- [ ] Validation works
- [ ] i18n verified

---

## Section 4: Roles & Permissions

**Route**: `/en/settings/roles`

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ROL-UI-1 | Page Load | Navigate to /en/settings/roles | Page loads with data table | Chrome MCP | [ ] |
| ROL-UI-2 | Add Button | Check for Add Role button | Button visible | Chrome MCP | [ ] |
| ROL-UI-3 | Table Headers | Check table columns | Role Name, Permissions, Actions | Chrome MCP | [ ] |
| ROL-UI-4 | System Badge | Check system roles | System badge on system roles | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ROL-CRUD-1 | Open Add Dialog | Click Add Role button | Dialog with permissions grid | Chrome MCP | [ ] |
| ROL-CRUD-2 | Permission Groups | Scroll permissions | All 14 groups visible | Chrome MCP | [ ] |
| ROL-CRUD-3 | Create Role | Name + permissions → Submit | Role created | Chrome MCP | [ ] |
| ROL-CRUD-4 | Edit Role | Click Edit from actions | Edit dialog opens | Chrome MCP | [ ] |
| ROL-CRUD-5 | Update Role | Modify role → Submit | Role updated | Chrome MCP | [ ] |
| ROL-CRUD-6 | Delete Role | Click Delete → Confirm | Role deleted | Chrome MCP | [ ] |

### Protection Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ROL-PROT-1 | System Role | Check system role actions | Delete option hidden | Chrome MCP | [ ] |

### Validation Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ROL-VAL-1 | Empty Name | Submit without name | Validation error | Chrome MCP | [ ] |
| ROL-VAL-2 | No Permissions | Submit without permissions | Validation error | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ROL-i18n-1 | Arabic | Load /ar/settings/roles | All text in Arabic | Chrome MCP | [ ] |
| ROL-i18n-2 | No Raw Keys | Scan page | No translation keys visible | Chrome MCP | [ ] |

### **HARD STOP** - Roles Complete
- [ ] CRUD operations work
- [ ] System roles protected
- [ ] i18n verified

---

## Section 5: Currencies

**Route**: `/en/settings/currencies`

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUR-UI-1 | Page Load | Navigate to /en/settings/currencies | Page loads with data table | Chrome MCP | [ ] |
| CUR-UI-2 | Add Button | Check for Add Currency button | Button visible | Chrome MCP | [ ] |
| CUR-UI-3 | Table Headers | Check columns | Code, Name, Symbol, Status, Actions | Chrome MCP | [ ] |
| CUR-UI-4 | Default Star | Check default currency | Star icon on default | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUR-CRUD-1 | Open Add Dialog | Click Add Currency | Dialog opens | Chrome MCP | [ ] |
| CUR-CRUD-2 | Create Currency | Fill form → Submit | Currency created | Chrome MCP | [ ] |
| CUR-CRUD-3 | Edit Currency | Click Edit | Edit dialog opens | Chrome MCP | [ ] |
| CUR-CRUD-4 | Set Default | Click Set as Default | Currency becomes default | Chrome MCP | [ ] |
| CUR-CRUD-5 | Delete Currency | Click Delete → Confirm | Currency deleted | Chrome MCP | [ ] |

### Validation Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUR-VAL-1 | Code Length | Enter 2-char code | Validation error | Chrome MCP | [ ] |
| CUR-VAL-2 | Uppercase | Enter lowercase code | Auto-converts to uppercase | Chrome MCP | [ ] |
| CUR-VAL-3 | Delete Default | Try delete default currency | Action disabled | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CUR-i18n-1 | Arabic | Load /ar/settings/currencies | All text in Arabic | Chrome MCP | [ ] |

### **HARD STOP** - Currencies Complete
- [ ] CRUD works
- [ ] Default protection works
- [ ] i18n verified

---

## Section 6: Exchange Rates

**Route**: `/en/settings/exchange-rates`

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXR-UI-1 | Page Load | Navigate to /en/settings/exchange-rates | Page loads with data table | Chrome MCP | [ ] |
| EXR-UI-2 | Add Button | Check for Add Rate button | Button visible | Chrome MCP | [ ] |
| EXR-UI-3 | Table Headers | Check columns | From, To, Rate, Type, Effective Date, Actions | Chrome MCP | [ ] |
| EXR-UI-4 | Rate Type Badge | Check rate type display | Formal/Black Market badges | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXR-CRUD-1 | Open Add Dialog | Click Add Rate | Dialog with dropdowns | Chrome MCP | [ ] |
| EXR-CRUD-2 | Currency Dropdowns | Check from/to dropdowns | Currencies listed | Chrome MCP | [ ] |
| EXR-CRUD-3 | Create Rate | Fill form → Submit | Rate created | Chrome MCP | [ ] |
| EXR-CRUD-4 | Edit Rate | Click Edit | Edit dialog opens | Chrome MCP | [ ] |
| EXR-CRUD-5 | Delete Rate | Click Delete → Confirm | Rate deleted | Chrome MCP | [ ] |

### Validation Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXR-VAL-1 | Missing Currency | Submit without from_currency | Validation error | Chrome MCP | [ ] |
| EXR-VAL-2 | Negative Rate | Enter negative rate | Validation error | Chrome MCP | [ ] |
| EXR-VAL-3 | Missing Date | Submit without date | Validation error | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EXR-i18n-1 | Arabic | Load /ar/settings/exchange-rates | All text in Arabic | Chrome MCP | [ ] |

### **HARD STOP** - Exchange Rates Complete
- [ ] CRUD works
- [ ] Validation works
- [ ] i18n verified

---

## Section 7: Subscription & Billing

**Route**: `/en/settings/subscription`

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SUB-UI-1 | Page Load | Navigate to /en/settings/subscription | Page loads | Chrome MCP | [ ] |
| SUB-UI-2 | Current Plan | Check current plan card | Shows plan name and status | Chrome MCP | [ ] |
| SUB-UI-3 | Usage Section | Check usage limits | Shows Items, Users, Transactions with progress bars | Chrome MCP | [ ] |
| SUB-UI-4 | Plan Cards | Check available plans | Freemium and Premium cards | Chrome MCP | [ ] |
| SUB-UI-5 | Features List | Check plan features | Features listed with checkmarks | Chrome MCP | [ ] |
| SUB-UI-6 | Billing History | Check billing section | Shows history or "No billing history" | Chrome MCP | [ ] |

### Subscription Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SUB-SUB-1 | Current Badge | Check current plan badge | "Current" badge on active plan | Chrome MCP | [ ] |
| SUB-SUB-2 | Recommended Badge | Check premium card | "Recommended" badge if not premium | Chrome MCP | [ ] |
| SUB-SUB-3 | Upgrade Button | Check upgrade button | Visible for freemium users | Chrome MCP | [ ] |
| SUB-SUB-4 | Manage Billing | Check for premium | Manage Billing button visible | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| SUB-i18n-1 | Arabic | Load /ar/settings/subscription | All text in Arabic | Chrome MCP | [ ] |
| SUB-i18n-2 | No Raw Keys | Scan page | No translation keys visible | Chrome MCP | [ ] |

### **HARD STOP** - Subscription Complete
- [ ] Plan display works
- [ ] Usage limits display
- [ ] i18n verified

---

## Section 8: Audit Logs

**Route**: `/en/settings/audit-logs`

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUD-UI-1 | Page Load | Navigate to /en/settings/audit-logs | Page loads with data table | Chrome MCP | [ ] |
| AUD-UI-2 | Table Headers | Check columns | Timestamp, User, Action, Entity Type, Entity ID, IP, Actions | Chrome MCP | [ ] |
| AUD-UI-3 | Filter Button | Check for Filters button | Button visible | Chrome MCP | [ ] |
| AUD-UI-4 | Export Button | Check for Export button | Button visible | Chrome MCP | [ ] |
| AUD-UI-5 | Action Badges | Check action badges | Color-coded badges | Chrome MCP | [ ] |

### Filter Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUD-FILT-1 | Open Filters | Click Filters button | Filter dialog opens | Chrome MCP | [ ] |
| AUD-FILT-2 | Action Filter | Select action filter | Action dropdown works | Chrome MCP | [ ] |
| AUD-FILT-3 | Entity Filter | Select entity type | Entity dropdown works | Chrome MCP | [ ] |
| AUD-FILT-4 | Date Range | Set date range | Date pickers work | Chrome MCP | [ ] |
| AUD-FILT-5 | Apply Filters | Click Apply | Filters applied, toast shown | Chrome MCP | [ ] |
| AUD-FILT-6 | Clear Filters | Click Clear All | Filters removed | Chrome MCP | [ ] |

### Details Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUD-DET-1 | View Details | Click View Details on row | Details dialog opens | Chrome MCP | [ ] |
| AUD-DET-2 | Old Values | Check old values | JSON displayed if available | Chrome MCP | [ ] |
| AUD-DET-3 | New Values | Check new values | JSON displayed if available | Chrome MCP | [ ] |

### i18n Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUD-i18n-1 | Arabic | Load /ar/settings/audit-logs | All text in Arabic | Chrome MCP | [ ] |

### **HARD STOP** - Audit Logs Complete
- [ ] Data table works
- [ ] Filters work
- [ ] Details dialog works
- [ ] i18n verified

---

## Mobile Responsive Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| MOB-1 | Dashboard 375px | Resize to 375x812 | Cards stack vertically | Chrome MCP | [ ] |
| MOB-2 | Forms 375px | Resize to 375x812 | Forms remain usable | Chrome MCP | [ ] |
| MOB-3 | Tables 375px | Resize to 375x812 | Tables scroll horizontally | Chrome MCP | [ ] |

---

## Console Error Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ERR-1 | Settings Dashboard | Check console | No JS errors | Chrome MCP | [ ] |
| ERR-2 | General Settings | Check console | No JS errors | Chrome MCP | [ ] |
| ERR-3 | Users Page | Check console | No JS errors | Chrome MCP | [ ] |
| ERR-4 | Roles Page | Check console | No JS errors | Chrome MCP | [ ] |
| ERR-5 | Currencies Page | Check console | No JS errors | Chrome MCP | [ ] |
| ERR-6 | Exchange Rates | Check console | No JS errors | Chrome MCP | [ ] |
| ERR-7 | Subscription | Check console | No JS errors | Chrome MCP | [ ] |
| ERR-8 | Audit Logs | Check console | No JS errors | Chrome MCP | [ ] |

---

## Test Execution Summary

| Section | Total Tests | Status |
|---------|-------------|--------|
| Authentication | 1 | Pending |
| Settings Dashboard | 13 | Pending |
| General Settings | 17 | Pending |
| Users Management | 14 | Pending |
| Roles & Permissions | 13 | Pending |
| Currencies | 12 | Pending |
| Exchange Rates | 11 | Pending |
| Subscription | 10 | Pending |
| Audit Logs | 13 | Pending |
| Mobile Responsive | 3 | Pending |
| Console Errors | 8 | Pending |
| **Total** | **115** | **Pending** |

---

## Success Criteria

- All [ ] marked as [x]
- All bug fixes committed
- TEST-REPORT.md generated
- Output: `<promise>ALL_TESTS_COMPLETE</promise>`

---

## Notes

- Test execution uses Chrome DevTools MCP
- Screenshots saved to specs/settings/screenshots/
- Bugs fixed and committed during execution
- i18n tested for both English and Arabic
