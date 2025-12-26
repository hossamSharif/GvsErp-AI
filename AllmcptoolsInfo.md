# MCP Tools Reference

This document lists all MCP tools available for this project. Always use these tools for their respective operations as mandated by the project constitution.

---

## Supabase MCP Tools

### Documentation & Types
- `mcp__supabase__search_docs` - Search Supabase documentation using GraphQL
- `mcp__supabase__generate_typescript_types` - Generate TypeScript types for a project

### Database Operations
- `mcp__supabase__list_tables` - List all tables in one or more schemas
- `mcp__supabase__list_extensions` - List all extensions in the database
- `mcp__supabase__list_migrations` - List all migrations in the database
- `mcp__supabase__apply_migration` - Apply a migration (DDL operations)
- `mcp__supabase__execute_sql` - Execute raw SQL queries

### Project Info
- `mcp__supabase__get_project_url` - Get the API URL for a project
- `mcp__supabase__get_publishable_keys` - Get all publishable API keys
- `mcp__supabase__get_logs` - Get logs by service type (api, postgres, edge-function, auth, storage, realtime)
- `mcp__supabase__get_advisors` - Get security or performance advisory notices

### Edge Functions
- `mcp__supabase__list_edge_functions` - List all Edge Functions
- `mcp__supabase__get_edge_function` - Get file contents of an Edge Function
- `mcp__supabase__deploy_edge_function` - Deploy an Edge Function

### Branching (Development)
- `mcp__supabase__create_branch` - Create a development branch
- `mcp__supabase__list_branches` - List all development branches
- `mcp__supabase__delete_branch` - Delete a development branch
- `mcp__supabase__merge_branch` - Merge branch migrations/functions to production
- `mcp__supabase__reset_branch` - Reset migrations of a branch
- `mcp__supabase__rebase_branch` - Rebase a branch on production

---

## Ref MCP Tools

| Tool | Description |
|------|-------------|
| `mcp__Ref__ref_search_documentation` | Search for documentation on the web, GitHub, or private resources. Include programming language and framework/library names. Add `ref_src=private` to search private docs. |
| `mcp__Ref__ref_read_url` | Read the content of a URL as markdown. Pass the exact URL (including #hash) from a search result. |

**Usage Pattern:**
1. Use `ref_search_documentation` to find relevant docs
2. Use `ref_read_url` to read the full content of a specific result

---

## Stripe MCP Tools

### Customer Management
- `mcp__stripe-agent-toolkit__create_customer` - Create a new customer
- `mcp__stripe-agent-toolkit__list_customers` - List customers (with optional email filter)

### Products & Pricing
- `mcp__stripe-agent-toolkit__create_product` - Create a new product
- `mcp__stripe-agent-toolkit__list_products` - List all products
- `mcp__stripe-agent-toolkit__create_price` - Create a price for a product
- `mcp__stripe-agent-toolkit__list_prices` - List prices (optionally by product)

### Payments & Links
- `mcp__stripe-agent-toolkit__create_payment_link` - Create a payment link
- `mcp__stripe-agent-toolkit__list_payment_intents` - List payment intents

### Invoicing
- `mcp__stripe-agent-toolkit__create_invoice` - Create an invoice for a customer
- `mcp__stripe-agent-toolkit__list_invoices` - List invoices
- `mcp__stripe-agent-toolkit__create_invoice_item` - Add an item to an invoice
- `mcp__stripe-agent-toolkit__finalize_invoice` - Finalize and send an invoice

### Subscriptions
- `mcp__stripe-agent-toolkit__list_subscriptions` - List subscriptions
- `mcp__stripe-agent-toolkit__update_subscription` - Update a subscription
- `mcp__stripe-agent-toolkit__cancel_subscription` - Cancel a subscription

### Refunds & Disputes
- `mcp__stripe-agent-toolkit__create_refund` - Refund a payment intent
- `mcp__stripe-agent-toolkit__list_disputes` - List disputes
- `mcp__stripe-agent-toolkit__update_dispute` - Submit evidence for a dispute

### Coupons & Discounts
- `mcp__stripe-agent-toolkit__list_coupons` - List all coupons
- `mcp__stripe-agent-toolkit__create_coupon` - Create a coupon

### Balance & Documentation
- `mcp__stripe-agent-toolkit__retrieve_balance` - Get account balance
- `mcp__stripe-agent-toolkit__search_stripe_documentation` - Search Stripe docs

---

## Chrome DevTools MCP Tools

### Navigation & Page Management
- `mcp__chrome-devtools__navigate_page` - Navigate to URL, back, forward, or reload
- `mcp__chrome-devtools__list_pages` - List all open pages in the browser
- `mcp__chrome-devtools__select_page` - Select a page as context for future tool calls
- `mcp__chrome-devtools__new_page` - Create a new page with a URL
- `mcp__chrome-devtools__close_page` - Close a page by index
- `mcp__chrome-devtools__resize_page` - Resize the page viewport

### User Interaction
- `mcp__chrome-devtools__click` - Click on an element (supports double-click)
- `mcp__chrome-devtools__fill` - Type text into input/textarea or select option
- `mcp__chrome-devtools__fill_form` - Fill multiple form elements at once
- `mcp__chrome-devtools__hover` - Hover over an element
- `mcp__chrome-devtools__drag` - Drag an element onto another element
- `mcp__chrome-devtools__press_key` - Press a key or key combination
- `mcp__chrome-devtools__upload_file` - Upload a file through a file input

### Content Inspection
- `mcp__chrome-devtools__take_snapshot` - Get accessibility tree snapshot (preferred for element inspection)
- `mcp__chrome-devtools__take_screenshot` - Capture page or element screenshot
- `mcp__chrome-devtools__wait_for` - Wait for text to appear on page

### Script Execution
- `mcp__chrome-devtools__evaluate_script` - Execute JavaScript in page context

### Network & Console Debugging
- `mcp__chrome-devtools__list_network_requests` - List network requests since last navigation
- `mcp__chrome-devtools__get_network_request` - Get details of a specific request
- `mcp__chrome-devtools__list_console_messages` - List console messages
- `mcp__chrome-devtools__get_console_message` - Get a specific console message

### Performance Analysis
- `mcp__chrome-devtools__performance_start_trace` - Start performance trace recording
- `mcp__chrome-devtools__performance_stop_trace` - Stop active trace recording
- `mcp__chrome-devtools__performance_analyze_insight` - Analyze specific performance insight

### Dialogs & Emulation
- `mcp__chrome-devtools__handle_dialog` - Accept or dismiss browser dialogs
- `mcp__chrome-devtools__emulate` - Emulate geolocation, CPU throttling, network conditions

**Usage Pattern:**
1. Use `take_snapshot` to get page structure with element UIDs
2. Use UIDs from snapshot to interact with elements (click, fill, etc.)
3. Use `wait_for` to ensure content is loaded before interacting
4. Prefer `take_snapshot` over `take_screenshot` for element inspection
