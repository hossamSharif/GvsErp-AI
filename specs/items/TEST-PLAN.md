# TEST-PLAN: Items Management Module

**Generated**: 2026-01-11
**Spec Source**: specs/001-modular-erp-saas/spec.md (User Story 1)
**Database**: Supabase (PostgreSQL with RLS)
**App URL**: http://localhost:3000

---

## Test Environment

| Setting | Value |
|---------|-------|
| Database | Supabase |
| App URL | http://localhost:3000 |
| Default Locale | en |
| RTL Locale | ar |
| Test Credentials | hossamsharif1990@gmail.com / Hossam1990@ |
| Fallback Credentials | halabija@gmail.com, husameldeenh@gmail.com |

---

## Pre-Test: Authentication

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUTH-1 | Login to Application | 1. Navigate to http://localhost:3000/en/login<br>2. Enter email: hossamsharif1990@gmail.com<br>3. Enter password: Hossam1990@<br>4. Click Sign In | Dashboard loads successfully | Chrome MCP | [ ] |
| AUTH-2 | Verify Dashboard Access | 1. After login, check URL contains /dashboard or redirects to dashboard<br>2. Verify sidebar navigation is visible | User sees main dashboard | Chrome MCP | [ ] |

### **HARD STOP** - Auth Checkpoint
- [ ] Successfully logged in
- [ ] Dashboard accessible
- [ ] Navigation sidebar visible

---

## Page: /en/items (Items List)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ITEMS-UI-1 | Page Load | Navigate to /en/items | Page renders with title "Items" and description | Chrome MCP | [ ] |
| ITEMS-UI-2 | Header Elements | Check page header | Shows "Items" title, "Manage your inventory items..." description | Chrome MCP | [ ] |
| ITEMS-UI-3 | Action Buttons | Check header buttons | "Add Item" button visible, "Export" button visible | Chrome MCP | [ ] |
| ITEMS-UI-4 | Data Table Structure | Check table renders | Table with columns: Name, SKU, Barcode, Brand, Category, Unit, Tax Rate, Status, Actions | Chrome MCP | [ ] |
| ITEMS-UI-5 | Search Input | Check search functionality | Search input with placeholder "Search items..." visible | Chrome MCP | [ ] |
| ITEMS-UI-6 | Column Toggle | Check column visibility toggle | Columns button present to show/hide columns | Chrome MCP | [ ] |
| ITEMS-UI-7 | Pagination | Check pagination controls | Pagination showing page numbers, rows per page selector | Chrome MCP | [ ] |
| ITEMS-UI-8 | Empty State | With no items, check empty state | Shows "No items found. Create your first item to get started." | Chrome MCP | [ ] |

### i18n Tests (English)

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ITEMS-i18n-EN-1 | Page Title | Check page title text | "Items" (not raw key like items.title) | Chrome MCP | [ ] |
| ITEMS-i18n-EN-2 | Description | Check description text | "Manage your inventory items, categories, and pricing." | Chrome MCP | [ ] |
| ITEMS-i18n-EN-3 | Add Button | Check button text | "Add Item" | Chrome MCP | [ ] |
| ITEMS-i18n-EN-4 | Export Button | Check button text | "Export" | Chrome MCP | [ ] |
| ITEMS-i18n-EN-5 | Search Placeholder | Check search placeholder | "Search items..." | Chrome MCP | [ ] |
| ITEMS-i18n-EN-6 | Column Headers | Check all column headers | Name, SKU, Barcode, Brand, Category, Unit of Measure, Tax Rate (%), Status | Chrome MCP | [ ] |
| ITEMS-i18n-EN-7 | Status Badges | Check status badge text | "Active" or "Inactive" | Chrome MCP | [ ] |

### Functional Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ITEMS-FUNC-1 | Navigate to New Item | Click "Add Item" button | Redirects to /en/items/new | Chrome MCP | [ ] |
| ITEMS-FUNC-2 | Search Items | 1. Create items first<br>2. Type in search box<br>3. Check results update | Table filters based on search query | Chrome MCP | [ ] |
| ITEMS-FUNC-3 | Sort by Name | Click on Name column header | Items sorted alphabetically | Chrome MCP | [ ] |
| ITEMS-FUNC-4 | Pagination Change | Change rows per page | Table updates with new page size | Chrome MCP | [ ] |
| ITEMS-FUNC-5 | Select Items | Click checkbox on item rows | Row selection counter appears, bulk actions enabled | Chrome MCP | [ ] |
| ITEMS-FUNC-6 | Bulk Price Update Dialog | 1. Select items<br>2. Click "Update Prices" | Bulk price update dialog opens | Chrome MCP | [ ] |
| ITEMS-FUNC-7 | Export Navigation | Click "Export" button | Redirects to /en/items/report | Chrome MCP | [ ] |

### Mobile/Responsive Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| ITEMS-MOB-1 | Mobile Layout (375px) | Resize viewport to 375x812 | Layout adapts, buttons stack vertically | Chrome MCP | [ ] |
| ITEMS-MOB-2 | Table Scroll | Check horizontal scroll on mobile | Table scrollable horizontally | Chrome MCP | [ ] |

### **HARD STOP** - Items List Complete
- [ ] All UI elements render correctly
- [ ] All i18n translations display (no raw keys)
- [ ] Navigation works
- [ ] Search and sort functional

---

## Page: /en/items/new (Create New Item)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| NEW-UI-1 | Page Load | Navigate to /en/items/new | Form page renders with "New Item" title | Chrome MCP | [ ] |
| NEW-UI-2 | Back Button | Check back button | Arrow left button present to return to items list | Chrome MCP | [ ] |
| NEW-UI-3 | Tab Navigation | Check tabs | 4 tabs: Basic Info, Pricing, Packaging, Images | Chrome MCP | [ ] |
| NEW-UI-4 | Basic Info Tab | Click Basic Info tab | Shows form fields: Name, Alternative Name, SKU, Barcode, Brand, Category, Unit, Tax Rate, Active toggle | Chrome MCP | [ ] |
| NEW-UI-5 | Pricing Tab | Click Pricing tab | Shows "Add Price" button, empty state message | Chrome MCP | [ ] |
| NEW-UI-6 | Packaging Tab | Click Packaging tab | Shows "Add Packaging" button, empty state message | Chrome MCP | [ ] |
| NEW-UI-7 | Images Tab | Click Images tab | Shows image upload placeholder | Chrome MCP | [ ] |
| NEW-UI-8 | Form Action Buttons | Check bottom of form | "Cancel" and "Create Item" buttons visible | Chrome MCP | [ ] |

### i18n Tests (English)

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| NEW-i18n-EN-1 | Page Title | Check title | "New Item" | Chrome MCP | [ ] |
| NEW-i18n-EN-2 | Page Description | Check description | "Create a new inventory item with pricing and packaging options." | Chrome MCP | [ ] |
| NEW-i18n-EN-3 | Tab Labels | Check all tab labels | "Basic Info", "Pricing", "Packaging", "Images" | Chrome MCP | [ ] |
| NEW-i18n-EN-4 | Field Labels | Check form labels | "Name", "Alternative Name", "SKU", "Barcode", "Brand", "Category", "Unit of Measure", "Tax Rate (%)", "Active" | Chrome MCP | [ ] |
| NEW-i18n-EN-5 | Placeholders | Check input placeholders | "Enter item name", "Enter alternative name", etc. | Chrome MCP | [ ] |
| NEW-i18n-EN-6 | Unit Options | Open unit dropdown | "Piece", "Kilogram (kg)", "Gram (g)", etc. | Chrome MCP | [ ] |
| NEW-i18n-EN-7 | Create Button | Check submit button | "Create Item" | Chrome MCP | [ ] |

### Form Validation Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| NEW-VAL-1 | Empty Name | 1. Leave name empty<br>2. Click Create Item | Validation error "Item name is required" | Chrome MCP | [ ] |
| NEW-VAL-2 | Name Max Length | Enter >255 characters in name | Validation error or character limit | Chrome MCP | [ ] |
| NEW-VAL-3 | Tax Rate Range | 1. Enter -1 in tax rate<br>2. Enter 101 in tax rate | Validation error for out of range | Chrome MCP | [ ] |
| NEW-VAL-4 | Required Unit | Check unit field | Has default value "Piece" or requires selection | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| NEW-CRUD-1 | Create Basic Item | 1. Enter name: "Test Item 001"<br>2. Leave defaults<br>3. Click Create Item | Success toast, redirected to /en/items | Chrome MCP + Supabase | [ ] |
| NEW-CRUD-2 | Create Full Item | 1. Fill all fields:<br>- Name: "Full Test Item"<br>- Alias: "FTI"<br>- SKU: "SKU-001"<br>- Barcode: "1234567890123"<br>- Brand: "Test Brand"<br>- Category: select one<br>- Unit: kg<br>- Tax: 15<br>2. Add pricing tier<br>3. Add packaging<br>4. Click Create | Success toast, item visible in list | Chrome MCP + Supabase | [ ] |
| NEW-CRUD-3 | Add Price Tier | 1. Click Pricing tab<br>2. Click "Add Price"<br>3. Select Retail tier<br>4. Enter price: 99.99<br>5. Select currency | Price tier row added | Chrome MCP | [ ] |
| NEW-CRUD-4 | Add Multiple Prices | Add 3 different price tiers (retail, wholesale, vip) | All 3 tiers displayed | Chrome MCP | [ ] |
| NEW-CRUD-5 | Remove Price Tier | Click delete button on price row | Price tier removed | Chrome MCP | [ ] |
| NEW-CRUD-6 | Add Packaging | 1. Click Packaging tab<br>2. Click "Add Packaging"<br>3. Enter name: "Box"<br>4. Enter quantity: 12 | Packaging option added | Chrome MCP | [ ] |
| NEW-CRUD-7 | Cancel Creation | 1. Fill some fields<br>2. Click Cancel | Redirected to /en/items without saving | Chrome MCP | [ ] |

### **HARD STOP** - Create Item Complete
- [ ] Form renders correctly
- [ ] Validation works
- [ ] Item can be created successfully
- [ ] Price tiers can be added/removed
- [ ] Packaging options can be added/removed

---

## Page: /en/items/[id] (Edit Item)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EDIT-UI-1 | Page Load | Navigate to edit page for existing item | Form loads with item data populated | Chrome MCP | [ ] |
| EDIT-UI-2 | Item Name in Title | Check page title | Shows actual item name | Chrome MCP | [ ] |
| EDIT-UI-3 | Populated Fields | Check all form fields | Fields pre-filled with existing item data | Chrome MCP | [ ] |
| EDIT-UI-4 | Save Button Text | Check submit button | Shows "Save Changes" not "Create Item" | Chrome MCP | [ ] |

### i18n Tests (English)

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EDIT-i18n-EN-1 | Save Button | Check button text | "Save Changes" | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| EDIT-CRUD-1 | Update Name | 1. Change item name<br>2. Click Save Changes | Success toast, name updated | Chrome MCP + Supabase | [ ] |
| EDIT-CRUD-2 | Update Multiple Fields | 1. Change SKU, barcode, brand<br>2. Click Save | All fields updated in database | Chrome MCP + Supabase | [ ] |
| EDIT-CRUD-3 | Toggle Active Status | 1. Toggle active switch off<br>2. Save | Item marked inactive | Chrome MCP + Supabase | [ ] |
| EDIT-CRUD-4 | Update Prices | 1. Modify existing price<br>2. Save | Price updated | Chrome MCP + Supabase | [ ] |
| EDIT-CRUD-5 | Access Non-existent Item | Navigate to /en/items/invalid-uuid | Error message "Item not found" | Chrome MCP | [ ] |

### **HARD STOP** - Edit Item Complete
- [ ] Existing data loads correctly
- [ ] Updates save successfully
- [ ] Error handling for invalid items works

---

## Page: /en/items/categories (Category Management)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CAT-UI-1 | Page Load | Navigate to /en/items/categories | Category tree page renders | Chrome MCP | [ ] |
| CAT-UI-2 | Page Title | Check title | "Categories" | Chrome MCP | [ ] |
| CAT-UI-3 | Add Category Button | Check header | "Add Category" button visible | Chrome MCP | [ ] |
| CAT-UI-4 | Category Tree Card | Check card structure | Card with title "Category Tree" and description | Chrome MCP | [ ] |
| CAT-UI-5 | Empty State | With no categories | Shows folder icon and "No categories yet" message | Chrome MCP | [ ] |
| CAT-UI-6 | Back Button | Check navigation | Arrow button to return to items | Chrome MCP | [ ] |

### i18n Tests (English)

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CAT-i18n-EN-1 | Page Title | Check title | "Categories" | Chrome MCP | [ ] |
| CAT-i18n-EN-2 | Add Button | Check button | "Add Category" | Chrome MCP | [ ] |
| CAT-i18n-EN-3 | Card Title | Check card | "Category Tree" | Chrome MCP | [ ] |
| CAT-i18n-EN-4 | Empty Message | Check empty state | "No categories yet." | Chrome MCP | [ ] |

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CAT-CRUD-1 | Create Root Category | 1. Click "Add Category"<br>2. Enter name: "Electronics"<br>3. Select "No parent"<br>4. Click Create | Category appears in tree | Chrome MCP + Supabase | [ ] |
| CAT-CRUD-2 | Create Subcategory | 1. Hover over "Electronics"<br>2. Click + button<br>3. Enter name: "Phones"<br>4. Click Create | Subcategory appears under Electronics | Chrome MCP + Supabase | [ ] |
| CAT-CRUD-3 | Edit Category | 1. Hover over category<br>2. Click edit button<br>3. Change name<br>4. Save | Category name updated | Chrome MCP + Supabase | [ ] |
| CAT-CRUD-4 | Delete Empty Category | 1. Hover over category with no children/items<br>2. Click delete<br>3. Confirm | Category removed | Chrome MCP + Supabase | [ ] |
| CAT-CRUD-5 | Expand/Collapse | Click on category with children | Tree expands/collapses | Chrome MCP | [ ] |
| CAT-CRUD-6 | Move Category | 1. Edit category<br>2. Change parent<br>3. Save | Category moved to new parent | Chrome MCP + Supabase | [ ] |

### **HARD STOP** - Categories Complete
- [ ] Category tree displays correctly
- [ ] CRUD operations work
- [ ] Subcategories work

---

## Page: /en/items/report (Items Report)

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| RPT-UI-1 | Page Load | Navigate to /en/items/report | Report page renders | Chrome MCP | [ ] |
| RPT-UI-2 | Page Title | Check title | "Items Report" | Chrome MCP | [ ] |
| RPT-UI-3 | Filter Card | Check left panel | "Report Options" card with filters | Chrome MCP | [ ] |
| RPT-UI-4 | Preview Card | Check right panel | "Preview" card with placeholder | Chrome MCP | [ ] |
| RPT-UI-5 | Filter Options | Check available filters | Category, Status, Currency, Include Prices toggle | Chrome MCP | [ ] |
| RPT-UI-6 | Action Buttons | Check buttons | "Preview Report" and "Download PDF" buttons | Chrome MCP | [ ] |
| RPT-UI-7 | Back Button | Check navigation | Arrow button to return to items | Chrome MCP | [ ] |

### i18n Tests (English)

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| RPT-i18n-EN-1 | Page Title | Check title | "Items Report" | Chrome MCP | [ ] |
| RPT-i18n-EN-2 | Options Card Title | Check card | "Report Options" | Chrome MCP | [ ] |
| RPT-i18n-EN-3 | Preview Button | Check button | "Preview Report" | Chrome MCP | [ ] |
| RPT-i18n-EN-4 | Download Button | Check button | "Download PDF" | Chrome MCP | [ ] |
| RPT-i18n-EN-5 | Currency Options | Open currency dropdown | "US Dollar ($)", "Euro", etc. | Chrome MCP | [ ] |

### Functional Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| RPT-FUNC-1 | Generate Preview | 1. Click "Preview Report" | PDF preview loads in iframe | Chrome MCP | [ ] |
| RPT-FUNC-2 | Filter by Category | 1. Select a category<br>2. Click Preview | Report filtered by category | Chrome MCP | [ ] |
| RPT-FUNC-3 | Filter by Status | 1. Select "Active only"<br>2. Click Preview | Report shows only active items | Chrome MCP | [ ] |
| RPT-FUNC-4 | Change Currency | 1. Select different currency<br>2. Click Preview | Currency symbol changes in report | Chrome MCP | [ ] |
| RPT-FUNC-5 | Download PDF | Click "Download PDF" | PDF file downloads | Chrome MCP | [ ] |
| RPT-FUNC-6 | Toggle Prices | 1. Toggle "Include Prices" off<br>2. Preview | Prices hidden in report | Chrome MCP | [ ] |

### **HARD STOP** - Report Complete
- [ ] Report options work
- [ ] Preview generates
- [ ] PDF downloads successfully

---

## RTL/Arabic Tests (/ar/items)

### i18n Tests (Arabic)

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AR-i18n-1 | Page Title | Navigate to /ar/items | "الأصناف" displayed | Chrome MCP | [ ] |
| AR-i18n-2 | Description | Check description | "إدارة أصناف المخزون والفئات والأسعار" | Chrome MCP | [ ] |
| AR-i18n-3 | Add Button | Check button | "إضافة صنف" | Chrome MCP | [ ] |
| AR-i18n-4 | Search Placeholder | Check search | "ابحث في الأصناف..." | Chrome MCP | [ ] |
| AR-i18n-5 | New Item Page | Navigate to /ar/items/new | "صنف جديد" title displayed | Chrome MCP | [ ] |
| AR-i18n-6 | Form Labels Arabic | Check labels | "اسم الصنف", "رمز التخزين", etc. | Chrome MCP | [ ] |
| AR-i18n-7 | Tab Labels Arabic | Check tabs | "المعلومات الأساسية", "التسعير", "التعبئة", "الصور" | Chrome MCP | [ ] |
| AR-i18n-8 | Categories Page | Navigate to /ar/items/categories | "الفئات" title displayed | Chrome MCP | [ ] |

### RTL Layout Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AR-RTL-1 | Page Direction | Check body direction | dir="rtl" attribute present | Chrome MCP | [ ] |
| AR-RTL-2 | Button Icons | Check button icon positions | Icons on right side of text (ml-2 becomes mr-2) | Chrome MCP | [ ] |
| AR-RTL-3 | Back Button Rotation | Check back arrow | Arrow points right (rotated 180deg) | Chrome MCP | [ ] |
| AR-RTL-4 | Form Layout | Check form fields | Fields aligned to right | Chrome MCP | [ ] |
| AR-RTL-5 | Data Table | Check table alignment | Text right-aligned | Chrome MCP | [ ] |

### **HARD STOP** - Arabic/RTL Complete
- [ ] All Arabic translations display correctly
- [ ] RTL layout renders properly
- [ ] No broken layouts or overlaps

---

## Delete Item Tests

### CRUD Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DEL-CRUD-1 | Delete Dialog Opens | 1. In items list, click row actions<br>2. Click Delete | Confirmation dialog appears | Chrome MCP | [ ] |
| DEL-CRUD-2 | Delete Confirmation | 1. Open delete dialog<br>2. Check content | Shows item name and warning | Chrome MCP | [ ] |
| DEL-CRUD-3 | Cancel Delete | Click Cancel in dialog | Dialog closes, item remains | Chrome MCP | [ ] |
| DEL-CRUD-4 | Confirm Delete | Click Delete in dialog | Item removed, success toast | Chrome MCP + Supabase | [ ] |
| DEL-CRUD-5 | Verify Deletion | Check items list after delete | Deleted item no longer appears | Chrome MCP | [ ] |

### **HARD STOP** - Delete Complete
- [ ] Delete confirmation works
- [ ] Item successfully deleted from database

---

## Bulk Price Update Tests

### Functional Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| BULK-FUNC-1 | Select Multiple Items | Click checkboxes on multiple items | Selection counter shows count | Chrome MCP | [ ] |
| BULK-FUNC-2 | Open Bulk Dialog | Click "Update Prices (N)" button | Bulk price update dialog opens | Chrome MCP | [ ] |
| BULK-FUNC-3 | Percentage Adjustment | 1. Select "Percentage"<br>2. Enter 10<br>3. Submit | Prices increased by 10% | Chrome MCP + Supabase | [ ] |
| BULK-FUNC-4 | Fixed Adjustment | 1. Select "Fixed Amount"<br>2. Enter 5<br>3. Submit | Prices increased by $5 | Chrome MCP + Supabase | [ ] |
| BULK-FUNC-5 | Select Price Tier | Change price tier dropdown | Different tier selected for update | Chrome MCP | [ ] |
| BULK-FUNC-6 | Invalid Value | Enter non-numeric value | Validation error shown | Chrome MCP | [ ] |
| BULK-FUNC-7 | Cancel Bulk Update | Click Cancel | Dialog closes, no changes | Chrome MCP | [ ] |

### **HARD STOP** - Bulk Update Complete
- [ ] Bulk selection works
- [ ] Price adjustments calculate correctly
- [ ] Database updated properly

---

## Database Verification Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DB-1 | Items Table | Query items table | Items exist with correct schema | Supabase MCP | [ ] |
| DB-2 | Categories Table | Query categories table | Categories with parent_id relationships | Supabase MCP | [ ] |
| DB-3 | Item Prices Table | Query item_prices | Prices linked to items | Supabase MCP | [ ] |
| DB-4 | Item Packagings Table | Query item_packagings | Packagings linked to items | Supabase MCP | [ ] |
| DB-5 | Tenant Isolation | Query with different tenant | RLS prevents cross-tenant access | Supabase MCP | [ ] |

---

## Console Error Monitoring

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| CONSOLE-1 | No JS Errors on Load | Check console after page loads | No JavaScript errors | Chrome MCP | [ ] |
| CONSOLE-2 | No API Errors | Monitor network during CRUD | No 4xx/5xx errors (except expected) | Chrome MCP | [ ] |
| CONSOLE-3 | No Missing Translations | Check console for i18n warnings | No missing translation key warnings | Chrome MCP | [ ] |

---

## Success Criteria

- [ ] All authentication tests pass
- [ ] All items list tests pass
- [ ] All create item tests pass
- [ ] All edit item tests pass
- [ ] All category tests pass
- [ ] All report tests pass
- [ ] All Arabic/RTL tests pass
- [ ] All delete tests pass
- [ ] All bulk update tests pass
- [ ] All database verifications pass
- [ ] No blocking console errors
- [ ] All fixes committed

---

## Test Execution Notes

When executing:
1. Start with AUTH tests - all other tests depend on being logged in
2. Create test data (items, categories) before running read/update tests
3. Take screenshots on failures to specs/items/screenshots/
4. Log console errors to TEST-REPORT.md but continue testing
5. Fix issues immediately, commit with descriptive messages
6. Re-test fixed items (max 3 attempts before marking BLOCKED)

---

## Output

Upon completion, output:
```
<promise>ALL_TESTS_COMPLETE</promise>
```

If >50% tests blocked:
```
<promise>BLOCKED</promise>
```
