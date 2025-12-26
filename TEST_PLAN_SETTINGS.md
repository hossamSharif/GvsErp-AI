# Test Plan: Core User Settings Section

## Overview
This test plan covers the comprehensive testing of the ERP System's Core User Settings Section (US8 - System Configuration and User Management).

## User Story Reference
**US8 - System Configuration and User Management (Priority: P2)**
- Goal: Configure subscriptions, users, roles, language, theme, currency
- Independent Test: Configure settings, create users, verify authorization

## Test Environment
- Browser: Chrome (using Chrome DevTools MCP)
- Application URL: http://localhost:3000
- Preconditions: User must be logged in with admin privileges

---

## Feature 1: Settings Dashboard Navigation

### Test Cases

#### TC1.1: Settings Dashboard Loading
- **Description**: Verify settings dashboard loads correctly with all navigation cards
- **Steps**:
  1. Navigate to /en/settings
  2. Verify page title "Settings" is displayed
  3. Verify description text is visible
  4. Verify all 6 settings section cards are visible
- **Expected Results**:
  - Page loads without errors
  - Title and description are correct
  - Cards displayed: General, Users, Roles, Currencies, Exchange Rates, Subscription

#### TC1.2: Navigation Card Interactions
- **Description**: Verify clicking on each card navigates to correct section
- **Steps**:
  1. Click on "General Settings" card
  2. Verify navigation to /en/settings/general
  3. Click back arrow
  4. Repeat for other cards
- **Expected Results**:
  - Each card navigates to correct sub-page
  - Back navigation works correctly

---

## Feature 2: General Settings

### Test Cases

#### TC2.1: General Settings Page Load
- **Description**: Verify general settings page loads with all sections
- **Steps**:
  1. Navigate to /en/settings/general
  2. Verify all 4 cards are visible: Preferences, Company Information, Business Preferences, Module Activation
- **Expected Results**:
  - Page loads without errors
  - All form fields are visible

#### TC2.2: Language Selection
- **Description**: Verify language dropdown works correctly
- **Steps**:
  1. Click on Language dropdown
  2. Select "Arabic"
  3. Click Save Settings
  4. Verify toast notification appears
- **Expected Results**:
  - Dropdown shows both English and Arabic options
  - Selection is saved successfully
  - Success toast notification appears

#### TC2.3: Theme Selection
- **Description**: Verify theme dropdown works correctly
- **Steps**:
  1. Click on Theme dropdown
  2. Verify options: Light, Dark
  3. Select different theme
  4. Save settings
- **Expected Results**:
  - Theme options are available
  - Theme change is saved

#### TC2.4: Default Currency Selection
- **Description**: Verify currency dropdown loads and works
- **Steps**:
  1. Click on Default Currency dropdown
  2. Verify currencies are loaded
  3. Select a currency
  4. Save settings
- **Expected Results**:
  - Currency list is populated
  - Selection is saved

#### TC2.5: Date Format Selection
- **Description**: Verify date format dropdown works
- **Steps**:
  1. Click on Date Format dropdown
  2. Verify options: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
  3. Select format
  4. Save settings
- **Expected Results**:
  - All date format options available
  - Selection is saved

#### TC2.6: Company Information Form
- **Description**: Verify company information fields work correctly
- **Steps**:
  1. Enter Company Name
  2. Enter Company Email
  3. Enter Company Phone
  4. Enter Company Address
  5. Enter Tax Number
  6. Save settings
- **Expected Results**:
  - All fields accept input
  - Email validates format
  - Settings are saved successfully

#### TC2.7: Company Email Validation
- **Description**: Verify email field validates format
- **Steps**:
  1. Enter invalid email format (e.g., "notanemail")
  2. Try to save
- **Expected Results**:
  - Validation error displayed for invalid email

#### TC2.8: Business Preferences
- **Description**: Verify fiscal year and timezone fields work
- **Steps**:
  1. Enter fiscal year start (e.g., "01-01")
  2. Enter timezone (e.g., "America/New_York")
  3. Save settings
- **Expected Results**:
  - Fields accept input
  - Settings are saved

#### TC2.9: Module Activation - Accounting
- **Description**: Verify accounting module toggle works
- **Steps**:
  1. Find Accounting Module toggle
  2. Toggle it on/off
  3. Save settings
  4. Refresh page
  5. Verify toggle state persisted
- **Expected Results**:
  - Toggle switches correctly
  - State persists after save

#### TC2.10: Module Activation - HR
- **Description**: Verify HR module toggle works
- **Steps**:
  1. Find HR Module toggle
  2. Toggle it on/off
  3. Save settings
- **Expected Results**:
  - Toggle switches correctly
  - State persists after save

#### TC2.11: Cancel Button
- **Description**: Verify cancel button returns to settings dashboard
- **Steps**:
  1. Click Cancel button
  2. Verify navigation to /en/settings
- **Expected Results**:
  - Returns to settings dashboard without saving

---

## Feature 3: Roles & Permissions

### Test Cases

#### TC3.1: Roles Page Load
- **Description**: Verify roles page loads with data table
- **Steps**:
  1. Navigate to /en/settings/roles
  2. Verify page title "Roles & Permissions"
  3. Verify data table is visible
  4. Verify "Add Role" button is visible
- **Expected Results**:
  - Page loads without errors
  - Data table shows existing roles
  - Add Role button is visible

#### TC3.2: Create New Role
- **Description**: Verify new role creation works
- **Steps**:
  1. Click "Add Role" button
  2. Verify dialog opens
  3. Enter role name (e.g., "Test Role")
  4. Select at least one permission
  5. Click Create button
- **Expected Results**:
  - Dialog opens correctly
  - Role is created successfully
  - Toast notification appears
  - New role appears in table

#### TC3.3: Permission Groups Display
- **Description**: Verify permission groups are organized correctly
- **Steps**:
  1. Click Add Role
  2. Scroll through permissions
  3. Verify groups: Items, Invoices, Warehouses, Transfers, Parties, Payments, Expenses, Reports, Settings, Users, Roles, Audit Logs, Accounting, HR
- **Expected Results**:
  - All permission groups are visible
  - Each group has appropriate permissions

#### TC3.4: Edit Existing Role
- **Description**: Verify role editing works
- **Steps**:
  1. Find a non-system role
  2. Click actions menu (three dots)
  3. Click Edit
  4. Modify role name
  5. Add/remove permissions
  6. Click Update
- **Expected Results**:
  - Edit dialog opens with existing data
  - Changes are saved successfully

#### TC3.5: Delete Role
- **Description**: Verify role deletion works
- **Steps**:
  1. Find a non-system role
  2. Click actions menu
  3. Click Delete
  4. Verify confirmation dialog
  5. Confirm deletion
- **Expected Results**:
  - Confirmation dialog appears
  - Role is deleted successfully
  - Role removed from table

#### TC3.6: System Role Protection
- **Description**: Verify system roles cannot be deleted
- **Steps**:
  1. Find a system role (marked with "System" badge)
  2. Click actions menu
  3. Verify Delete option is not available
- **Expected Results**:
  - System roles show "System" badge
  - Delete option is hidden for system roles

#### TC3.7: Role Search
- **Description**: Verify role search functionality
- **Steps**:
  1. Enter text in search field
  2. Verify table filters results
- **Expected Results**:
  - Search filters roles by name

#### TC3.8: Role Validation - Empty Name
- **Description**: Verify role name is required
- **Steps**:
  1. Click Add Role
  2. Leave name empty
  3. Select permissions
  4. Try to create
- **Expected Results**:
  - Validation error for empty name

#### TC3.9: Role Validation - No Permissions
- **Description**: Verify at least one permission is required
- **Steps**:
  1. Click Add Role
  2. Enter role name
  3. Don't select any permissions
  4. Try to create
- **Expected Results**:
  - Validation error for no permissions

---

## Feature 4: Subscription & Billing

### Test Cases

#### TC4.1: Subscription Page Load
- **Description**: Verify subscription page loads correctly
- **Steps**:
  1. Navigate to /en/settings/subscription
  2. Verify page title
  3. Verify current plan card
  4. Verify usage limits section
  5. Verify available plans section
- **Expected Results**:
  - Page loads without errors
  - All sections are visible

#### TC4.2: Current Plan Display
- **Description**: Verify current plan is displayed correctly
- **Steps**:
  1. Verify current plan name (Freemium/Premium)
  2. Verify plan icon
  3. Verify status badge
- **Expected Results**:
  - Current plan is accurately displayed
  - Status badge shows correct state

#### TC4.3: Usage Limits Display
- **Description**: Verify usage limits are shown with progress bars
- **Steps**:
  1. Check Items usage display
  2. Check Users usage display
  3. Check Monthly Transactions display
  4. Verify progress bar fills
- **Expected Results**:
  - All three limits are displayed
  - Progress bars show current/limit ratio

#### TC4.4: Plan Comparison Cards
- **Description**: Verify both plan cards display correctly
- **Steps**:
  1. Verify Freemium plan card with features
  2. Verify Premium plan card with features
  3. Check current plan indicator
  4. Check recommended badge on Premium
- **Expected Results**:
  - Both plans show correct pricing
  - Features list is complete
  - Current plan has "Current" badge

#### TC4.5: Upgrade Button (Freemium User)
- **Description**: Verify upgrade button works for freemium users
- **Steps**:
  1. As freemium user, click "Upgrade to Premium"
  2. Verify Stripe checkout redirect (or loading state)
- **Expected Results**:
  - Button initiates checkout process

#### TC4.6: Manage Billing Button (Premium User)
- **Description**: Verify billing management works
- **Steps**:
  1. As premium user, click "Manage Billing"
  2. Verify Stripe portal redirect
- **Expected Results**:
  - Button redirects to Stripe customer portal

#### TC4.7: Billing History Display
- **Description**: Verify billing history shows past invoices
- **Steps**:
  1. Scroll to billing history section
  2. Verify invoice entries if any
  3. Check download/view links
- **Expected Results**:
  - History shows invoices or "No billing history" message
  - Links work correctly

#### TC4.8: Cancel Subscription Flow
- **Description**: Verify subscription cancellation works
- **Steps**:
  1. As premium user, find Cancel Subscription section
  2. Click Cancel Subscription button
  3. Verify confirmation dialog
  4. Click "Keep Subscription" to cancel
- **Expected Results**:
  - Confirmation dialog warns about consequences
  - Cancel/Keep options work correctly

---

## Feature 5: UI/UX Consistency

### Test Cases

#### TC5.1: Back Navigation
- **Description**: Verify back arrow navigation on all sub-pages
- **Steps**:
  1. Visit each settings sub-page
  2. Click back arrow
  3. Verify return to settings dashboard
- **Expected Results**:
  - All sub-pages have back arrow
  - Navigation returns to dashboard

#### TC5.2: Loading States
- **Description**: Verify loading indicators are shown
- **Steps**:
  1. Navigate to settings pages
  2. Observe loading states during data fetch
- **Expected Results**:
  - Loading spinners/skeletons shown during load

#### TC5.3: Toast Notifications
- **Description**: Verify success/error toasts appear
- **Steps**:
  1. Save settings successfully
  2. Verify success toast
  3. Trigger an error (if possible)
  4. Verify error toast
- **Expected Results**:
  - Success toasts appear on successful actions
  - Error toasts appear on failures

#### TC5.4: Responsive Layout
- **Description**: Verify settings pages work on different screen sizes
- **Steps**:
  1. Resize browser window
  2. Check card layout adjusts
  3. Check form layout adjusts
- **Expected Results**:
  - Layout adapts to screen size
  - Content remains accessible

---

## Test Execution Summary

| Feature | Total Tests | Status |
|---------|-------------|--------|
| Settings Dashboard | 2 | Pending |
| General Settings | 11 | Pending |
| Roles & Permissions | 9 | Pending |
| Subscription & Billing | 8 | Pending |
| UI/UX Consistency | 4 | Pending |
| **Total** | **34** | **Pending** |

---

## Notes
- Test execution will use Chrome DevTools MCP for browser automation
- Screenshots will be captured for evidence
- Any bugs found will be documented with reproduction steps
- Fixes will be implemented professionally
