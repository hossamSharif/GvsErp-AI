# Research: Modular ERP SaaS Platform

**Branch**: `001-modular-erp-saas` | **Date**: 2025-12-13

---

## Research Tasks Completed

### 1. Monorepo Structure for Full-Stack TypeScript

**Decision**: Turborepo with pnpm workspaces

**Rationale**:
- Shared TypeScript types between frontend and backend eliminate API contract drift
- Single version control simplifies deployment and CI/CD
- Turborepo provides efficient caching and parallel builds
- pnpm offers faster installs and disk efficiency vs npm/yarn

**Alternatives Considered**:
- Nx: More powerful but heavier, steeper learning curve
- Lerna: Deprecated in favor of Nx, less active maintenance
- Separate repos: Would require publishing packages, more complex type sharing

---

### 2. State Management for React (Next.js)

**Decision**: Zustand for client state + TanStack Query for server state

**Rationale**:
- **Zustand**: ~1KB, zero boilerplate, excellent DevTools, perfect for local UI state (drafts, theme, language)
- **TanStack Query**: Industry standard for server state with built-in caching, background refetching, optimistic updates
- Clear separation: local state (Zustand) vs server-synced state (TanStack Query)
- Both integrate well with React 18 concurrent features

**Alternatives Considered**:
- Redux Toolkit: Overkill for this scale, more boilerplate
- Jotai/Recoil: Good but less ecosystem support than Zustand
- Context alone: Would require manual caching, re-render optimization

---

### 3. API Design: REST vs GraphQL

**Decision**: REST with OpenAPI 3.0 specification

**Rationale**:
- REST is simpler for mostly CRUD operations (items, invoices, payments)
- OpenAPI enables auto-generated TypeScript types and documentation
- Better HTTP caching (GET requests cacheable by default)
- Easier rate limiting per endpoint
- Aligns with Supabase's REST-based PostgREST

**Alternatives Considered**:
- GraphQL: Flexibility not needed, adds client complexity, harder to cache
- tRPC: Great for monorepos but less ecosystem tooling than REST

---

### 4. Multi-Tenancy Strategy

**Decision**: Shared database with `tenant_id` column and Supabase RLS

**Rationale**:
- Most cost-effective for SaaS with potentially many small tenants
- Supabase RLS provides database-level security (not just application-level)
- JWT claims automatically filtered by RLS policies
- Simple backup/restore (single database)
- Can shard later if specific tenants grow large

**Alternatives Considered**:
- Database-per-tenant: Better isolation but 10x cost, complex migrations
- Schema-per-tenant: PostgreSQL specific, complex connection pooling
- Application-level filtering only: Security risk, easy to miss WHERE clauses

---

### 5. PDF Generation Library

**Decision**: Hybrid - @react-pdf/renderer (client) + Puppeteer (server fallback)

**Rationale**:
- **@react-pdf/renderer**: Runs in browser, reduces server load for common reports (invoices, receipts)
- **Puppeteer**: Server-side for complex reports, scheduled batch generation, email attachments
- Client-side first approach improves UX (instant PDF preview)
- Puppeteer handles edge cases where React-PDF has styling limitations

**Alternatives Considered**:
- PDFKit: Node.js only, no client-side option
- jsPDF: Less sophisticated styling, manual positioning
- Puppeteer only: Server resource intensive for simple PDFs

---

### 6. Internationalization (i18n) for Next.js

**Decision**: next-intl

**Rationale**:
- Built specifically for Next.js App Router
- First-class RTL support with automatic dir attribute
- Server Component compatible (SSR translations)
- ICU message format for pluralization and formatting
- Type-safe translation keys with TypeScript

**Alternatives Considered**:
- next-i18next: Pages Router focused, less App Router integration
- react-intl: More complex setup, not Next.js specific
- Custom solution: Would miss RTL handling, formatting edge cases

---

### 7. Excel-like Table Component

**Decision**: TanStack Table + TanStack Virtual (custom wrapper)

**Rationale**:
- TanStack Table: Headless, full control over styling, supports sorting/filtering/grouping
- TanStack Virtual: Virtualization for 10k+ rows without DOM bloat
- Custom wrapper for fixed headers, column resizing, drag-and-drop reordering
- Integrates with shadcn/ui styling

**Alternatives Considered**:
- AG Grid: Feature-rich but expensive license for commercial use
- MUI DataGrid: Tied to Material UI, not shadcn/ui
- react-table (v7): Deprecated in favor of TanStack Table v8

---

### 8. Local Autosave Implementation

**Decision**: Zustand persist middleware + IndexedDB

**Rationale**:
- Zustand persist: Automatic serialization/deserialization to storage
- IndexedDB: 50MB+ storage limit (vs 5MB localStorage), async API
- Debounced saves (500ms) to prevent excessive writes
- Clear separation: autosave store vs server-synced data
- Recovery UI shows last save timestamp

**Alternatives Considered**:
- localStorage: 5MB limit may be insufficient for large drafts
- sessionStorage: Lost on tab close, not resilient enough
- Dexie.js: Additional dependency, IndexedDB API sufficient

---

### 9. Testing Strategy

**Decision**: Vitest (unit) + Supertest (API) + Playwright (E2E)

**Rationale**:
- **Vitest**: Fast, native ESM, Jest-compatible API, works with TypeScript
- **Supertest**: Express middleware testing, request/response assertions
- **Playwright**: Cross-browser E2E, excellent RTL support, visual regression

**Coverage Strategy**:
- Unit: 80% on business logic services
- Integration: All API endpoints with RLS verification
- E2E: 10 critical user journeys (invoice creation, payment recording, etc.)

**Alternatives Considered**:
- Jest: Slower, requires transforms for ESM
- Cypress: Less cross-browser support than Playwright
- Testing Library only: Not sufficient for full integration testing

---

### 10. Brand Palette Implementation

**Decision**: Tailwind CSS custom theme with CSS variables

**Implementation**:
```css
:root {
  --color-primary: 36 84 58;        /* #24543A Deep Green */
  --color-accent: 200 165 90;       /* #C8A55A Muted Gold */
  --color-background: 244 240 232;  /* #F4F0E8 Off-White */
  --color-text: 30 30 30;           /* #1E1E1E Charcoal */
  --color-text-secondary: 111 106 97; /* #6F6A61 Warm Grey */
}

.dark {
  --color-background: 30 30 30;
  --color-text: 244 240 232;
  /* ... dark mode adjustments */
}
```

**Rationale**:
- CSS variables enable runtime theme switching
- Tailwind utility classes for consistent spacing (8px baseline)
- shadcn/ui theming system compatible

---

## Unresolved Questions

All initial unknowns have been resolved. The following are noted for implementation phase:

1. **Supabase project setup**: Will need actual Supabase project URL and keys
2. **Stripe account setup**: Will need Stripe API keys and webhook secrets
3. **Domain/hosting**: Deployment target (Vercel, Railway, etc.) not yet decided
4. **Email service**: For notifications, password reset (Resend, SendGrid options)

---

## Dependencies Summary

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| Build | turborepo | ^2.x | Monorepo build system |
| Build | pnpm | ^8.x | Package manager |
| Frontend | next | ^14.x | React framework |
| Frontend | @tanstack/react-query | ^5.x | Server state management |
| Frontend | zustand | ^4.x | Client state management |
| Frontend | @tanstack/react-table | ^8.x | Table component |
| Frontend | @tanstack/react-virtual | ^3.x | Virtualization |
| Frontend | next-intl | ^3.x | Internationalization |
| Frontend | @react-pdf/renderer | ^3.x | Client-side PDF |
| UI | tailwindcss | ^3.x | Styling |
| UI | shadcn/ui | latest | Component library |
| Backend | express | ^4.x | API framework |
| Backend | @supabase/supabase-js | ^2.x | Database client |
| Backend | stripe | ^14.x | Payment processing |
| Backend | puppeteer | ^21.x | Server-side PDF |
| Backend | zod | ^3.x | Validation |
| Testing | vitest | ^1.x | Unit testing |
| Testing | @playwright/test | ^1.x | E2E testing |
| Testing | supertest | ^6.x | API testing |
