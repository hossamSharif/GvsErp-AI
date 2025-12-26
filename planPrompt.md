/plan
title: Modular ERP SaaS MVP (Stock, Accounting, HR)
description: 
  Architect and scaffold a modular ERP SaaS platform with Stock Management as the core MVP, 
  and optional Accounting and HR add-ons. The system must be built with Next.js (frontend), 
  shadcn/ui (UI components), Node.js + Express (backend), Supabase (database/auth), and Stripe 
  (payments). All integrations must strictly use MCP tools as defined below. 

tech_stack:
  frontend: Next.js 14 + shadcn/ui MCP tool
  backend: Node.js 20 + Express
  database: Supabase MCP tool (auth, storage, analytics)
  payments: Stripe MCP tool (subscriptions, invoices)
  testing: Chrome MCP tool (manual testing, RTL verification)
  documentation: ref MCP tool (design files, repos, PDFs, markdown)

mcp_integration_rules:
  - Use ref MCP tool for documentation and code references.
  - Use Supabase MCP tool for all DB interactions (auth, user data, analytics).
  - Use Stripe MCP tool for all payment/subscription/invoice operations.
  - Use shadcn/ui MCP tool for UI implementation, ensuring RTL support and accessibility.
  - Use Chrome MCP tool for browser automation and UX validation.
  - Never bypass MCP tools with custom code.

design_specifications:
  brand_palette:
    primary: "#24543A" (Deep Green) — headers, buttons, key actions.
    accent: "#C8A55A" (Muted Gold) — highlights, icons, focus rings.
    background: "#F4F0E8" (Off-White) — backgrounds, cards.
    text_primary: "#1E1E1E" (Charcoal) — body text.
    text_secondary: "#6F6A61" (Warm Grey) — metadata, secondary labels.

  typography:
    - Use system fonts with clear hierarchy (H1/H2 for section headers, body text at 16px).
    - Ensure high contrast between text and background for readability.
    - Metadata styled in Warm Grey with smaller font size.

  layout:
    - Responsive grid system with consistent spacing (8px baseline).
    - Fixed table headers for scrolling datasets.
    - Adjustable column/row width and height (Excel-like control).
    - Cards and modals use Off-White background with subtle shadow for depth.
    - Navigation sidebar in Deep Green with active states highlighted in Muted Gold.

  components:
    - Use preset shadcn/ui components (Button, Card, Table, Modal, Form, Dropdown, Tabs).
    - Buttons: Deep Green background, Muted Gold focus ring, rounded corners.
    - Tables: Fixed headers, resizable columns, alternating row colors for clarity.
    - Dropdowns: Search + autocomplete enabled, styled with brand palette.
    - Forms: Inline validation, clear error states in Muted Gold.
    - Reports: Export buttons styled as primary actions, PDF export integrated.

  ux_principles:
    - ERP design must prioritize clarity, efficiency, and scalability.
    - Minimize cognitive load: consistent placement of actions, predictable navigation.
    - Provide real-time feedback (loading states, success/error toasts).
    - Ensure accessibility: keyboard navigation, ARIA labels, RTL support.
    - Optimize for large datasets: fast rendering, virtualization for tables.
    - Maintain separation of concerns: Stock = operational, Accounting = financial, HR = workforce.

modules:
  stock_management:
    - Items, Warehouses, POS, Sales, Purchases, Customers/Suppliers, Expenses.
    - Reports section in every module with advanced filters + PDF export.
    - Local autosave for drafts (not persisted until finalized).
    - Real-time stock preview when selecting items.
    - Payments (receive/pay) with preview/edit functionality.
    - Restriction: no formal financial statements (reserved for Accounting).

  accounting:
    - Chart of Accounts, Journal Entries, General Ledger, Trial Balance, Financial Statements.
    - AR/AP aging reports, Bank & Cash management, Taxes.
    - Integration with Stock: migration layer for historical data, balance synchronization.
    - Activation wizard for onboarding after subscription.

  hr:
    - Employee records, Attendance/Leave, Payroll, Roles/Authorization, Performance/Experience.
    - Payroll auto-posted to Accounting.
    - Employees linked to POS/Warehouse operations.
    - Reports section with PDF export.

deliverables:
  - Next.js frontend scaffold with shadcn/ui preset components styled per brand palette.
  - Node.js + Express backend with Supabase integration for auth/data.
  - Stripe integration for subscriptions/payments via MCP tool.
  - Modular architecture with feature flags for Accounting/HR add-ons.
  - Documentation via ref MCP tool.
  - UX validation via Chrome MCP tool.

