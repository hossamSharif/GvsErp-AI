# TEST-PLAN: Dashboard

**Generated**: 2026-01-11
**Spec Source**: specs/001-modular-erp-saas/spec.md
**Database**: Supabase
**App URL**: http://localhost:3000

---

## Pre-Test: Authentication

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| AUTH-1 | Login with primary account | Navigate to /ar/login → Enter hossamsharif1990@gmail.com / Hossam1990@ → Submit | Redirect to dashboard | Chrome | [ ] |
| AUTH-2 | Session persistence | Verify session cookie exists after login | Session active | Chrome | [ ] |

### **HARD STOP** - Auth Checkpoint
- [ ] Logged in successfully
- [ ] Session is active

---

## Page: /dashboard

### UI Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-UI-1 | Dashboard loads | Navigate to /ar/dashboard | Page renders without errors | Chrome | [ ] |
| DASH-UI-2 | Welcome section displays | Check for welcome message | Shows "مرحباً بعودتك" and user name | Chrome | [ ] |
| DASH-UI-3 | Stats cards visible | Check for 4 stats cards | Total Revenue, Invoices, Products, Customers cards visible | Chrome | [ ] |
| DASH-UI-4 | Quick Actions section | Check for quick actions panel | Shows 4 action buttons | Chrome | [ ] |
| DASH-UI-5 | Recent Activity section | Check for recent activity panel | Panel visible with empty state | Chrome | [ ] |
| DASH-UI-6 | Top Products section | Check for top products panel | Panel visible with empty state | Chrome | [ ] |
| DASH-UI-7 | Recent Invoices section | Check for recent invoices panel | Panel visible with empty state | Chrome | [ ] |
| DASH-UI-8 | Low Stock Alerts section | Check for low stock panel | Panel visible with empty state | Chrome | [ ] |
| DASH-UI-9 | Header displays | Check for header component | Header with menu toggle visible | Chrome | [ ] |
| DASH-UI-10 | Sidebar displays | Check for sidebar component | Sidebar with navigation links visible | Chrome | [ ] |

### i18n Tests (Arabic)

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-i18n-1 | Arabic translations loaded | Scan page for raw translation keys | No "dashboard." prefixed keys visible | Chrome | [ ] |
| DASH-i18n-2 | Welcome text in Arabic | Check welcome message | Shows "مرحباً بعودتك" | Chrome | [ ] |
| DASH-i18n-3 | Stats labels in Arabic | Check stats card titles | "إجمالي الإيرادات", "الفواتير", "المنتجات", "العملاء" | Chrome | [ ] |
| DASH-i18n-4 | Quick Actions in Arabic | Check action button labels | "فاتورة جديدة", "إضافة منتج", etc. | Chrome | [ ] |
| DASH-i18n-5 | Section titles in Arabic | Check section headers | "النشاط الأخير", "إجراءات سريعة", etc. | Chrome | [ ] |
| DASH-i18n-6 | Empty states in Arabic | Check empty state messages | "لا يوجد نشاط حديث", "لا توجد منتجات بعد", etc. | Chrome | [ ] |

### i18n Tests (English)

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-i18n-EN-1 | Switch to English | Change locale to /en/dashboard | Page displays in English | Chrome | [ ] |
| DASH-i18n-EN-2 | English translations loaded | Scan page for raw translation keys | No "dashboard." prefixed keys visible | Chrome | [ ] |
| DASH-i18n-EN-3 | Welcome text in English | Check welcome message | Shows "Welcome back" | Chrome | [ ] |
| DASH-i18n-EN-4 | Stats labels in English | Check stats card titles | "Total Revenue", "Invoices", "Products", "Customers" | Chrome | [ ] |

### RTL Layout Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-RTL-1 | Page direction is RTL | Check dir attribute in Arabic mode | dir="rtl" on container | Chrome | [ ] |
| DASH-RTL-2 | Sidebar positioned right | Check sidebar position in Arabic | Sidebar on right side | Chrome | [ ] |
| DASH-RTL-3 | Text alignment | Check text alignment in cards | Text aligns correctly for RTL | Chrome | [ ] |
| DASH-RTL-4 | LTR in English mode | Switch to English, check direction | dir="ltr" on container | Chrome | [ ] |

### Responsive/Mobile Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-MOB-1 | Mobile viewport | Resize to 375x812 | Layout adapts, sidebar hidden | Chrome | [ ] |
| DASH-MOB-2 | Mobile menu toggle | Click menu button on mobile | Mobile sidebar opens | Chrome | [ ] |
| DASH-MOB-3 | Stats cards stack | Check stats cards on mobile | Cards stack vertically | Chrome | [ ] |
| DASH-MOB-4 | Tablet viewport | Resize to 768x1024 | Layout adapts appropriately | Chrome | [ ] |
| DASH-MOB-5 | Desktop viewport | Resize to 1920x1080 | Full desktop layout | Chrome | [ ] |

### **HARD STOP** - Dashboard UI Complete
- [ ] All UI elements render correctly
- [ ] All translations display properly
- [ ] RTL/LTR layouts work correctly
- [ ] Responsive design functions properly

---

## Navigation Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-NAV-1 | Quick Action: New Invoice | Click "فاتورة جديدة" | Navigates to /ar/invoices/new | Chrome | [ ] |
| DASH-NAV-2 | Quick Action: Add Product | Click "إضافة منتج" | Navigates to /ar/items/new | Chrome | [ ] |
| DASH-NAV-3 | Quick Action: Add Customer | Click "إضافة عميل" | Navigates to /ar/customers/new | Chrome | [ ] |
| DASH-NAV-4 | Quick Action: View Reports | Click "عرض التقارير" | Navigates to /ar/reports | Chrome | [ ] |
| DASH-NAV-5 | Sidebar navigation | Click sidebar menu items | Navigates to correct pages | Chrome | [ ] |

### **HARD STOP** - Navigation Complete
- [ ] All quick action buttons work
- [ ] Sidebar navigation works

---

## Theme Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-THEME-1 | Dark mode toggle | Toggle to dark mode via header | Background changes to dark | Chrome | [ ] |
| DASH-THEME-2 | Light mode toggle | Toggle to light mode | Background changes to light | Chrome | [ ] |
| DASH-THEME-3 | Theme persistence | Refresh page after theme change | Theme preference persists | Chrome | [ ] |
| DASH-THEME-4 | Dark mode cards | Check stats cards in dark mode | Cards have dark background | Chrome | [ ] |

### **HARD STOP** - Theme Tests Complete
- [ ] Theme toggles work correctly
- [ ] Theme persists on refresh

---

## Console Error Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-ERR-1 | No console errors on load | Load dashboard, check console | No JavaScript errors | Chrome | [ ] |
| DASH-ERR-2 | No network errors | Check network tab | All requests succeed (200 OK) | Chrome | [ ] |
| DASH-ERR-3 | No hydration errors | Check for React hydration issues | No hydration mismatch warnings | Chrome | [ ] |

---

## Performance Tests

| ID | Test | Steps | Expected | Tool | Status |
|----|------|-------|----------|------|--------|
| DASH-PERF-1 | Page load time | Measure time to interactive | Under 3 seconds | Chrome | [ ] |
| DASH-PERF-2 | No layout shift | Check for CLS issues | No visible layout shifts | Chrome | [ ] |

---

## Success Criteria

- All [ ] marked as [x] or BLOCKED
- All fixes committed with proper messages
- TEST-REPORT.md generated with details
- Output `<promise>ALL_TESTS_COMPLETE</promise>`

---

## Test Execution Notes

- Execute tests in order
- Take screenshots for failures
- Fix issues immediately and commit
- Try 3 times before marking BLOCKED
- Continue to next test after fix or block
