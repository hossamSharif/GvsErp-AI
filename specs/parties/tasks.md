# Parties Feature - Implementation Tasks

## Completed Tasks

### Phase 1: Database Schema
- [x] Create parties table migration
- [x] Add RLS policies for tenant isolation
- [x] Add indexes for performance

### Phase 2: API Layer
- [x] Implement PartyService with CRUD operations
- [x] Create parties.routes.ts with all endpoints
- [x] Add validation schemas (createPartySchema, updatePartySchema)
- [x] Implement balance recalculation logic
- [x] Implement statement generation

### Phase 3: Frontend - Shared Components
- [x] Create PartyForm component with validation
- [x] Add DataTable with pagination/sorting support
- [x] Setup TanStack Query hooks (use-parties.ts)

### Phase 4: Frontend - Pages
- [x] Implement /parties page with tabs
- [x] Implement /customers page
- [x] Implement /customers/new page
- [x] Implement /customers/[id] detail page
- [x] Implement /suppliers page
- [x] Implement /suppliers/new page
- [x] Implement /suppliers/[id] detail page
- [x] Implement /customers/report page

### Phase 5: i18n
- [x] Add English translations (parties.json)
- [x] Add Arabic translations (parties.json)

## Known Issues to Test

### UI Issues
1. Check RTL layout on Arabic locale
2. Verify dropdown menus align properly in RTL
3. Verify balance colors (red for receivable, green for overpaid)

### i18n Issues
1. Verify all translation keys are properly loaded
2. Check hardcoded English strings in:
   - "Record Payment" / "Make Payment" in dropdown
   - Customer detail page headers ("Contact Information", "Current Balance", etc.)
   - Form labels ("Name", "Email", "Phone", etc.)

### CRUD Issues
1. Test create customer flow
2. Test create supplier flow
3. Test edit customer flow
4. Test delete confirmation dialog
5. Test balance recalculation

### API Issues
1. Verify authentication middleware works
2. Test pagination parameters
3. Test search functionality

## Test Data Requirements

### Pre-existing Data
- At least 5 customers with varying balances
- At least 3 suppliers with varying balances
- Some parties should have transactions for statement testing

### Test Scenarios
1. Create new customer with all fields
2. Create new customer with required fields only
3. Edit existing customer
4. Delete customer
5. View customer statement
6. Recalculate balance
7. Switch between tabs (customers/suppliers)
8. Pagination navigation
9. Search functionality
