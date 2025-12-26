# RTL (Right-to-Left) Testing Guide

**Purpose:** Ensure the ERP system displays correctly in Arabic and other RTL languages
**Date:** 2025-12-14
**Status:** Implementation Complete, Testing in Progress

---

## Overview

This guide documents RTL support implementation and provides testing procedures to ensure proper layout and functionality in RTL mode (Arabic).

---

## Implementation Summary

### 1. RTL Utilities Created

**File:** `apps/web/src/lib/rtl-utils.ts`

**Functions:**
- `isRTL(locale)` - Check if locale is RTL
- `getTextDirection(locale)` - Get 'ltr' or 'rtl'
- `getRTLSpacing(locale, className)` - Convert Tailwind classes (ml-4 → mr-4)
- `getFlexDirection(locale)` - Get flex direction for locale
- `getTextAlign(locale)` - Get text alignment
- `shouldFlipIcon(iconName)` - Check if icon needs flipping
- `getIconTransform(locale, iconName)` - Get CSS transform for icons
- `formatNumber(locale, value)` - Format numbers with locale
- `formatCurrency(locale, value, currency)` - Format currency
- `getColumnAlign(locale, dataType)` - Get table column alignment
- `rtlStyle(locale, ltrStyles, rtlStyles)` - CSS-in-JS helper

### 2. Global CSS Enhancements

**File:** `apps/web/src/styles/globals.css`

**Added:**

#### Logical Properties (Direction-Agnostic)
- Margin inline: `.ms-*`, `.me-*` (start/end instead of left/right)
- Padding inline: `.ps-*`, `.pe-*`
- Text alignment: `.text-start`, `.text-end`
- Border inline: `.border-s`, `.border-e`
- Rounded corners: `.rounded-s`, `.rounded-e`
- Position inline: `.start-*`, `.end-*`

#### RTL-Specific Styles
- `[dir="rtl"]` direction and text-align
- Table RTL direction
- Number input alignment
- Dropdown menu alignment
- Icon flipping class `.flip-rtl`
- Dialog/Modal RTL positioning

---

## Testing Checklist

### A. Language Switcher Testing

- [ ] Language switcher accessible in header
- [ ] Switching to Arabic changes `dir="rtl"` attribute
- [ ] Page content translates to Arabic
- [ ] Layout mirrors correctly

### B. Layout Components

#### 1. Navigation & Header
- [ ] Sidebar aligns to right in RTL
- [ ] Menu items right-aligned
- [ ] Icons flip correctly (arrows, chevrons)
- [ ] User menu dropdown right-aligned
- [ ] Logo position correct

#### 2. Forms
- [ ] Form labels right-aligned
- [ ] Input fields right-aligned text
- [ ] Required asterisks on correct side
- [ ] Validation messages aligned
- [ ] Button groups (Save/Cancel) order reversed
- [ ] Date pickers display correctly
- [ ] Select dropdowns open from correct side

#### 3. Tables
- [ ] Table headers right-aligned for text
- [ ] Numbers aligned right (both LTR/RTL)
- [ ] Action buttons column on correct side
- [ ] Sort icons display correctly
- [ ] Pagination controls mirrored
- [ ] Search bar aligned correctly

#### 4. Cards & Panels
- [ ] Card padding symmetric
- [ ] Icons in correct position
- [ ] Close buttons on correct side
- [ ] Badges/status indicators positioned correctly

#### 5. Dialogs & Modals
- [ ] Modal content right-aligned
- [ ] Close button on correct side (right in LTR, left in RTL)
- [ ] Footer buttons order reversed
- [ ] Form content aligned properly

#### 6. Data Display
- [ ] Lists aligned correctly
- [ ] Bullet points/numbers on correct side
- [ ] Indentation correct
- [ ] Nested items indented correctly
- [ ] Timeline components mirrored

### C. Module-Specific Testing

#### Dashboard
- [ ] Widget cards display correctly
- [ ] Charts readable in RTL
- [ ] Quick actions aligned
- [ ] Statistics cards symmetric

#### Items/Inventory
- [ ] Item list table RTL
- [ ] Item form fields aligned
- [ ] Image upload component positioned
- [ ] Category tree RTL

#### Invoices (Sales/Purchases)
- [ ] Invoice form RTL
- [ ] Line items table RTL
- [ ] Customer/supplier select RTL
- [ ] Totals section aligned (right-side)
- [ ] Autosave indicator positioned

#### Warehouses
- [ ] Warehouse list RTL
- [ ] Inventory table RTL
- [ ] Transfer form RTL
- [ ] Stock levels display

#### HR Module
- [ ] Employee list RTL
- [ ] Employee detail tabs
- [ ] Leave request form
- [ ] Payroll table RTL
- [ ] Attendance calendar

#### Accounting
- [ ] Chart of accounts tree RTL
- [ ] Journal entry form
- [ ] Debit/Credit columns correctly labeled
- [ ] Financial statements RTL

#### Settings
- [ ] Settings tabs
- [ ] User management table
- [ ] Role permissions grid
- [ ] Currency settings

### D. Interactive Elements

- [ ] Buttons with icons (icon position)
- [ ] Icon-only buttons
- [ ] Badges with text
- [ ] Tooltips appear from correct side
- [ ] Popovers align correctly
- [ ] Context menus position correctly
- [ ] Notifications/toasts slide from correct side

### E. Responsive Testing

- [ ] Mobile navigation menu RTL
- [ ] Mobile tables scroll correctly
- [ ] Mobile forms display properly
- [ ] Tablet layout RTL
- [ ] Desktop layout RTL

### F. PDF Reports

- [ ] PDF headers RTL-aware
- [ ] PDF tables RTL
- [ ] Arabic text renders in PDFs
- [ ] Page numbers positioned correctly

### G. Data & Typography

- [ ] Arabic text displays without breaking
- [ ] Mixed Arabic/English displays correctly
- [ ] Numbers format correctly (1,234.56)
- [ ] Dates format for Arabic locale
- [ ] Currency symbols positioned correctly
- [ ] Percentage signs positioned correctly

---

## How to Test

### 1. Enable Arabic Language

```typescript
// In browser DevTools console
localStorage.setItem('locale', 'ar');
window.location.reload();
```

Or use the language switcher in the UI.

### 2. Check `dir` Attribute

```typescript
// Should be 'rtl' for Arabic
console.log(document.documentElement.dir);
```

### 3. Inspect Element Styles

Look for:
- `direction: rtl`
- `text-align: right`
- Logical properties (margin-inline-start, padding-inline-end, etc.)

### 4. Visual Comparison

Take screenshots side-by-side:
- English (LTR) version
- Arabic (RTL) version
- Verify they are proper mirrors

---

## Common RTL Issues & Fixes

### Issue 1: Text Not Right-Aligned

**Problem:** Text stays left-aligned in RTL mode

**Fix:**
```css
/* Instead of */
text-align: left;

/* Use */
text-align: start;
```

### Issue 2: Wrong Margin/Padding Direction

**Problem:** Spacing not mirrored

**Fix:**
```typescript
// Instead of
className="ml-4"

// Use logical properties
className="ms-4"  // margin-inline-start

// Or use RTL utility
import { getRTLSpacing } from '@/lib/rtl-utils';
className={getRTLSpacing(locale, 'ml-4')}
```

### Issue 3: Icons Not Flipping

**Problem:** Directional icons (arrows, chevrons) don't flip

**Fix:**
```typescript
import { getIconTransform } from '@/lib/rtl-utils';

<ChevronRight
  className={getIconTransform(locale, 'chevron-right') ? 'flip-rtl' : ''}
/>
```

### Issue 4: Absolute Positioning Wrong

**Problem:** Absolutely positioned elements in wrong location

**Fix:**
```css
/* Instead of */
left: 10px;

/* Use logical properties */
inset-inline-start: 10px;
```

### Issue 5: Flex Direction Not Reversed

**Problem:** Flex items don't reverse

**Fix:**
```typescript
import { getFlexDirection } from '@/lib/rtl-utils';

<div className={`flex ${getFlexDirection(locale, 'row')}`}>
```

### Issue 6: Table Columns Not Mirrored

**Problem:** Table layout doesn't reverse

**Fix:**
```typescript
// DataTable component should auto-detect RTL
// Ensure table has dir attribute
<table dir={isRTL(locale) ? 'rtl' : 'ltr'}>
```

---

## Browser Testing Matrix

Test in multiple browsers to ensure compatibility:

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ⬜ Not Tested |
| Firefox | Latest | ⬜ Not Tested |
| Safari | Latest | ⬜ Not Tested |
| Edge | Latest | ⬜ Not Tested |
| Mobile Safari (iOS) | Latest | ⬜ Not Tested |
| Chrome Mobile (Android) | Latest | ⬜ Not Tested |

---

## Accessibility Considerations

- [ ] Screen readers announce text in correct direction
- [ ] Keyboard navigation (Tab) follows RTL order
- [ ] Focus indicators visible in RTL
- [ ] ARIA labels appropriate for RTL

---

## Performance Considerations

- RTL utilities are lightweight (< 5KB)
- CSS logical properties have excellent browser support (96%+)
- No JavaScript overhead for static RTL layouts
- Dynamic RTL switching requires page reload (acceptable trade-off)

---

## Known Limitations

1. **PDF Generation:** Some complex PDFs may require additional RTL adjustments
2. **Third-party Libraries:** Chart libraries may need specific RTL configuration
3. **Rich Text Editors:** May require additional plugins for RTL support

---

## Testing Tools

### Browser DevTools

```javascript
// Toggle RTL for testing
document.documentElement.dir = 'rtl';
document.documentElement.dir = 'ltr';

// Check computed styles
getComputedStyle(element).direction;
getComputedStyle(element).textAlign;
```

### Chrome Extension

Consider using RTL testing extensions:
- RTL Tester
- Force RTL

---

## Sign-off Checklist

Before marking T247 as complete:

- [X] RTL utilities created and documented
- [X] Global CSS updated with logical properties
- [X] Translation files complete (Arabic)
- [ ] All layout components tested in RTL
- [ ] All modules tested in RTL
- [ ] Forms tested in RTL
- [ ] Tables tested in RTL
- [ ] PDF reports tested in RTL
- [ ] Mobile responsive RTL tested
- [ ] Cross-browser RTL tested
- [ ] Accessibility verified
- [ ] Performance verified
- [ ] User acceptance testing in Arabic

---

## Next Steps

1. **Manual Testing:** Go through each page/module systematically
2. **Screenshot Documentation:** Capture before/after for key pages
3. **Bug Fixes:** Address any layout issues found
4. **User Testing:** Get feedback from Arabic-speaking users
5. **Automated Tests:** Add RTL test cases to E2E tests

---

## Resources

- [MDN: CSS Logical Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties)
- [W3C: CSS Writing Modes](https://www.w3.org/TR/css-writing-modes-4/)
- [Material Design: Bidirectionality](https://material.io/design/usability/bidirectionality.html)
- [Bootstrap RTL](https://getbootstrap.com/docs/5.0/getting-started/rtl/)

---

*Last Updated: 2025-12-14*
