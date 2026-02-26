# TEST-PLAN: Warehouses Feature

Generated: 2026-01-11
Spec Source: specs/001-modular-erp-saas/ (User Story 4)
Database: Supabase
App URL: http://localhost:3000

---

## Feature Overview

The Warehouses feature (User Story 4) enables:
- Creating and managing warehouses
- Viewing warehouse inventory with stock levels
- Transferring items between warehouses
- Low stock alerts and thresholds
- Inventory reporting

### Routes Covered:
- `/warehouses` - List all warehouses
- `/warehouses/[id]` - Warehouse detail with inventory
- `/warehouses/settings` - Low stock settings
- `/warehouses/report` - Inventory report
- `/warehouses/transfers` - List all transfers
- `/warehouses/transfers/new` - Create new transfer

---

## Pre-Test: Authentication

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUTH-1 | Login to Dashboard | 1. Navigate to http://localhost:3000/ar/login 2. Enter email: hossamsharif1990@gmail.com 3. Enter password: Hossam1990@ 4. Click login | Redirect to dashboard | Chrome MCP | [ ] |

### **HARD STOP** - Auth Checkpoint
- [ ] Successfully logged in
- [ ] Dashboard visible

---

## Page: /warehouses (Warehouses List)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-LIST-UI-1 | Page Loads | Navigate to /ar/warehouses | Page title "المستودعات" visible | Chrome MCP | [ ] |
| WH-LIST-UI-2 | Header Buttons | Check header area | Report, Settings, Transfers, Add Warehouse buttons visible | Chrome MCP | [ ] |
| WH-LIST-UI-3 | Stats Cards | Locate stats section | 4 cards: Total Warehouses, Low Stock Alerts, Total Items, Total Value | Chrome MCP | [ ] |
| WH-LIST-UI-4 | Search Box | Locate search input | Search input with placeholder visible | Chrome MCP | [ ] |
| WH-LIST-UI-5 | Table Headers | Locate table | Columns: Name, Address, Status, Actions | Chrome MCP | [ ] |
| WH-LIST-UI-6 | Empty State | If no warehouses exist | "لا توجد مستودعات بعد" message displayed | Chrome MCP | [ ] |

### i18n Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-LIST-i18n-1 | Page Title | Check h1 text | "المستودعات" (not "warehouses.title") | Chrome MCP | [ ] |
| WH-LIST-i18n-2 | Description | Check description text | "إدارة أماكن التخزين والمخزون" | Chrome MCP | [ ] |
| WH-LIST-i18n-3 | Add Button | Check add button text | "إضافة مستودع" | Chrome MCP | [ ] |
| WH-LIST-i18n-4 | Stats Card Labels | Check card labels | Arabic labels visible, no raw keys | Chrome MCP | [ ] |
| WH-LIST-i18n-5 | Table Headers | Check table headers | Arabic: الاسم، العنوان، الحالة، الإجراءات | Chrome MCP | [ ] |

### CRUD Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-CRUD-1 | Open Create Dialog | Click "إضافة مستودع" button | Create warehouse dialog opens | Chrome MCP | [ ] |
| WH-CRUD-2 | Create Warehouse | 1. Fill name: "مستودع اختبار" 2. Fill address: "العنوان 123" 3. Click create | New warehouse appears in list | Chrome MCP + DB | [ ] |
| WH-CRUD-3 | View Warehouse | Click on warehouse row | Navigate to warehouse detail page | Chrome MCP | [ ] |
| WH-CRUD-4 | Warehouse Actions | Click actions dropdown | View, Edit, Deactivate options visible | Chrome MCP | [ ] |
| WH-CRUD-5 | Search Filter | Type in search box | List filters correctly | Chrome MCP | [ ] |

### **HARD STOP** - Warehouses List Complete
- [ ] All UI elements render correctly
- [ ] All translations display correctly (no raw keys)
- [ ] CRUD operations work

---

## Page: /warehouses/[id] (Warehouse Detail)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-DETAIL-UI-1 | Page Loads | Navigate to warehouse detail | Warehouse name and address visible | Chrome MCP | [ ] |
| WH-DETAIL-UI-2 | Back Button | Locate back button | Arrow left button visible | Chrome MCP | [ ] |
| WH-DETAIL-UI-3 | Status Badge | Check status area | Active/Inactive badge visible | Chrome MCP | [ ] |
| WH-DETAIL-UI-4 | Action Buttons | Check header actions | Edit and New Transfer buttons visible | Chrome MCP | [ ] |
| WH-DETAIL-UI-5 | Stats Cards | Locate stats section | 4 cards: Total Items, Total Quantity, Total Value, Low Stock Alerts | Chrome MCP | [ ] |
| WH-DETAIL-UI-6 | Tabs | Locate tabs | Inventory and Alerts tabs visible | Chrome MCP | [ ] |
| WH-DETAIL-UI-7 | Inventory Table | Switch to inventory tab | Table with columns: Item, SKU, Quantity, Available, Threshold, Value, Status, Actions | Chrome MCP | [ ] |
| WH-DETAIL-UI-8 | Alerts Table | Switch to alerts tab | Table with alerts if any | Chrome MCP | [ ] |

### i18n Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-DETAIL-i18n-1 | Stats Labels | Check stat card labels | Arabic labels | Chrome MCP | [ ] |
| WH-DETAIL-i18n-2 | Tab Labels | Check tab labels | "المخزون", "التنبيهات" | Chrome MCP | [ ] |
| WH-DETAIL-i18n-3 | Table Headers | Check table headers | All in Arabic | Chrome MCP | [ ] |
| WH-DETAIL-i18n-4 | Status Badges | Check stock status | "مخزون منخفض" or "متوفر" | Chrome MCP | [ ] |
| WH-DETAIL-i18n-5 | Button Labels | Check buttons | "تعديل", "تحويل جديد" | Chrome MCP | [ ] |

### Inventory Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-INV-1 | Inventory Display | View inventory tab | Items listed with quantities | Chrome MCP | [ ] |
| WH-INV-2 | Search Items | Use search in inventory | Items filter correctly | Chrome MCP | [ ] |
| WH-INV-3 | Low Stock Filter | Click "Low Stock Only" | Only low stock items shown | Chrome MCP | [ ] |
| WH-INV-4 | Set Threshold | Click settings button on item | Threshold dialog opens | Chrome MCP | [ ] |
| WH-INV-5 | Save Threshold | Enter threshold value and save | Threshold saved, dialog closes | Chrome MCP | [ ] |

### **HARD STOP** - Warehouse Detail Complete
- [ ] Warehouse details display correctly
- [ ] Inventory tab works
- [ ] Alerts tab works
- [ ] Threshold setting works

---

## Page: /warehouses/transfers (Transfers List)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| TR-LIST-UI-1 | Page Loads | Navigate to /ar/warehouses/transfers | "تحويلات المخزون" title visible | Chrome MCP | [ ] |
| TR-LIST-UI-2 | New Transfer Button | Locate button | "تحويل جديد" button visible | Chrome MCP | [ ] |
| TR-LIST-UI-3 | Stats Cards | Locate stats section | 4 cards: Pending, In Transit, Completed, Canceled | Chrome MCP | [ ] |
| TR-LIST-UI-4 | Search Box | Locate search | Search input visible | Chrome MCP | [ ] |
| TR-LIST-UI-5 | Status Filter | Locate status filter | Dropdown with status options | Chrome MCP | [ ] |
| TR-LIST-UI-6 | Transfers Table | Locate table | Columns: Transfer Number, Route, Items, Status, Created, Actions | Chrome MCP | [ ] |
| TR-LIST-UI-7 | Empty State | If no transfers | "لم يتم العثور على تحويلات" message | Chrome MCP | [ ] |

### i18n Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| TR-LIST-i18n-1 | Page Title | Check h1 | "تحويلات المخزون" | Chrome MCP | [ ] |
| TR-LIST-i18n-2 | Stats Labels | Check card labels | Arabic labels | Chrome MCP | [ ] |
| TR-LIST-i18n-3 | Status Labels | Check status filter | قيد الانتظار, قيد النقل, مكتمل, ملغي | Chrome MCP | [ ] |
| TR-LIST-i18n-4 | Table Headers | Check headers | Arabic column names | Chrome MCP | [ ] |

### **HARD STOP** - Transfers List Complete
- [ ] Page renders correctly
- [ ] All translations present

---

## Page: /warehouses/transfers/new (Create Transfer)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| TR-NEW-UI-1 | Page Loads | Navigate to /ar/warehouses/transfers/new | "تحويل جديد" title visible | Chrome MCP | [ ] |
| TR-NEW-UI-2 | Back Button | Locate back button | Back arrow visible | Chrome MCP | [ ] |
| TR-NEW-UI-3 | Form Card | Locate form | Transfer details card visible | Chrome MCP | [ ] |
| TR-NEW-UI-4 | From Warehouse | Locate dropdown | From warehouse selector visible | Chrome MCP | [ ] |
| TR-NEW-UI-5 | To Warehouse | Locate dropdown | To warehouse selector visible | Chrome MCP | [ ] |
| TR-NEW-UI-6 | Items Section | Locate items area | Items selection/input visible | Chrome MCP | [ ] |

### i18n Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| TR-NEW-i18n-1 | Page Title | Check title | "تحويل جديد" | Chrome MCP | [ ] |
| TR-NEW-i18n-2 | Card Title | Check card header | "تفاصيل التحويل" | Chrome MCP | [ ] |
| TR-NEW-i18n-3 | Form Labels | Check form labels | Arabic labels | Chrome MCP | [ ] |

### Transfer Creation Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| TR-CREATE-1 | Select From Warehouse | Click from dropdown, select warehouse | Warehouse selected | Chrome MCP | [ ] |
| TR-CREATE-2 | Select To Warehouse | Click to dropdown, select different warehouse | Warehouse selected | Chrome MCP | [ ] |
| TR-CREATE-3 | Add Items | Add items to transfer | Items added to list | Chrome MCP | [ ] |
| TR-CREATE-4 | Submit Transfer | Click create button | Transfer created, redirect to detail | Chrome MCP + DB | [ ] |

### **HARD STOP** - Create Transfer Complete
- [ ] Form renders correctly
- [ ] Transfer can be created

---

## Page: /warehouses/settings (Low Stock Settings)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-SET-UI-1 | Page Loads | Navigate to /ar/warehouses/settings | Settings page visible | Chrome MCP | [ ] |
| WH-SET-UI-2 | Title | Check title | "إعدادات المخزون المنخفض" | Chrome MCP | [ ] |
| WH-SET-UI-3 | Settings List | Locate settings content | Items with threshold settings visible | Chrome MCP | [ ] |

### i18n Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-SET-i18n-1 | Page Title | Check h1 | Arabic title | Chrome MCP | [ ] |
| WH-SET-i18n-2 | Description | Check description | Arabic text | Chrome MCP | [ ] |
| WH-SET-i18n-3 | Button Labels | Check buttons | Arabic labels | Chrome MCP | [ ] |

### **HARD STOP** - Settings Page Complete
- [ ] Settings page renders

---

## Page: /warehouses/report (Inventory Report)

### UI Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-RPT-UI-1 | Page Loads | Navigate to /ar/warehouses/report | Report page visible | Chrome MCP | [ ] |
| WH-RPT-UI-2 | Title | Check title | "تقرير المخزون" | Chrome MCP | [ ] |
| WH-RPT-UI-3 | Export Buttons | Locate export buttons | CSV and PDF export buttons visible | Chrome MCP | [ ] |
| WH-RPT-UI-4 | Filters | Locate filters | Warehouse filter and Low Stock Only filter | Chrome MCP | [ ] |
| WH-RPT-UI-5 | Report Table | Locate table | Inventory data displayed | Chrome MCP | [ ] |

### i18n Tests
| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-RPT-i18n-1 | Page Title | Check h1 | "تقرير المخزون" | Chrome MCP | [ ] |
| WH-RPT-i18n-2 | Export Labels | Check buttons | "تصدير CSV", "تصدير PDF" | Chrome MCP | [ ] |
| WH-RPT-i18n-3 | Filter Labels | Check filters | Arabic labels | Chrome MCP | [ ] |

### **HARD STOP** - Report Page Complete
- [ ] Report page renders

---

## Mobile Responsiveness Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-MOB-1 | Warehouses List Mobile | Resize to 375x812 | Layout adjusts, no horizontal scroll | Chrome MCP | [ ] |
| WH-MOB-2 | Warehouse Detail Mobile | Resize to 375x812 | Cards stack, table scrolls | Chrome MCP | [ ] |
| WH-MOB-3 | Transfers List Mobile | Resize to 375x812 | Layout adjusts correctly | Chrome MCP | [ ] |
| WH-MOB-4 | Create Transfer Mobile | Resize to 375x812 | Form usable on mobile | Chrome MCP | [ ] |

### **HARD STOP** - Mobile Tests Complete
- [ ] All pages mobile-friendly

---

## RTL Layout Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-RTL-1 | Page Direction | Check html/body dir | dir="rtl" for Arabic locale | Chrome MCP | [ ] |
| WH-RTL-2 | Table Alignment | Check table | Text aligned correctly for RTL | Chrome MCP | [ ] |
| WH-RTL-3 | Icons Position | Check icon placement | Icons on correct side for RTL | Chrome MCP | [ ] |
| WH-RTL-4 | Form Layout | Check form fields | Labels and inputs aligned for RTL | Chrome MCP | [ ] |

### **HARD STOP** - RTL Tests Complete
- [ ] RTL layout correct

---

## API Verification Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-API-1 | List Warehouses | GET /api/warehouses | Returns warehouse list with pagination | DB Check | [ ] |
| WH-API-2 | Get Warehouse | GET /api/warehouses/:id | Returns warehouse with stats | DB Check | [ ] |
| WH-API-3 | Get Inventory | GET /api/warehouses/:id/inventory | Returns inventory items | DB Check | [ ] |
| WH-API-4 | List Transfers | GET /api/transfers | Returns transfers list | DB Check | [ ] |
| WH-API-5 | Create Transfer | POST /api/transfers | Creates new transfer | DB Check | [ ] |

### **HARD STOP** - API Tests Complete
- [ ] All API endpoints working

---

## Console Error Checks

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| WH-CONSOLE-1 | Warehouses List | Check console on /warehouses | No errors | Chrome MCP | [ ] |
| WH-CONSOLE-2 | Warehouse Detail | Check console on /warehouses/[id] | No errors | Chrome MCP | [ ] |
| WH-CONSOLE-3 | Transfers List | Check console on /warehouses/transfers | No errors | Chrome MCP | [ ] |
| WH-CONSOLE-4 | Create Transfer | Check console on /warehouses/transfers/new | No errors | Chrome MCP | [ ] |

### **HARD STOP** - Console Check Complete
- [ ] No console errors

---

## Test Summary

| Section | Test Count |
|---------|------------|
| Authentication | 1 |
| Warehouses List | 16 |
| Warehouse Detail | 18 |
| Transfers List | 11 |
| Create Transfer | 10 |
| Settings Page | 6 |
| Report Page | 8 |
| Mobile Tests | 4 |
| RTL Tests | 4 |
| API Tests | 5 |
| Console Tests | 4 |
| **TOTAL** | **87** |

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
