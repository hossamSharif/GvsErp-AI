# WhatsApp Sales Agent — Development Cost & Effort Estimate

> **Forward-looking project estimate** for a new AI agent that converses with customers over WhatsApp, answers product queries, builds draft invoices, captures new customers into the CRM, and surfaces drafts in the ERP's Sales module for admin approval. Hours and cost at **$35/hr** (MENA local senior rate).

---

## 1. Overview

### What we're proposing to build
A production WhatsApp AI agent (`apps/whatsapp-agent/`) that:
- **Listens on WhatsApp Business** for incoming customer messages.
- **Answers product/pricing questions** in Arabic or English, with product images and stock availability.
- **Identifies existing customers** by phone number, or **captures new prospects** into the CRM with status `prospect`.
- **Builds orders conversationally** — add items, confirm quantities, apply discounts, capture delivery details.
- **Generates a draft invoice** at conversation end and pushes it to the ERP's Sales module with status `draft` (admin approves before finalization).
- **Notifies admins** of new prospects and pending draft invoices.
- **Provides an admin dashboard** inside the ERP to monitor live conversations, review/edit/approve drafts, see conversion analytics, and hand off to a human if needed.

### Relationship to existing products
This is the **third product** in the suite, building on top of:
- **The ERP** ($97,755 traditional equivalent already delivered) — provides the customer master, product catalog, pricing tiers, invoice creation, and Sales module.
- **The AI Assistant** ($15,225 already delivered) — provides an existing WhatsApp outbound messaging connector (`apps/ai/src/mcp_server/whatsapp.py`), the product RAG ingestion pipeline, the LLM provider abstraction, and the bilingual response patterns. **~10 hours of WhatsApp-related work is already done and will be reused** rather than rebuilt.

The new agent also **requires modifications to the ERP's customer (parties) and invoice schemas** to track prospect status, WhatsApp consent, conversation source, and acquisition channel. These ERP changes are scoped and budgeted in this document.

### Methodology
- Hour estimates derived from feature decomposition against industry benchmarks for WhatsApp Business API integrations, conversational AI agents, and CRM extensions.
- A blended **3× productivity multiplier** is applied (vibe hrs × 3 = traditional dev hrs).
- **Forward-looking estimates** — these are pre-build budget numbers, conservative at the low end. Actual delivery may come in 10–20% under this if existing AI Assistant code is reused effectively.
- Rate basis: **$35/hr** — MENA senior. EU ($90/hr) and US ($150/hr) comparisons shown.

### Headline numbers @ $35/hr

| Metric | Vibe-coded | Traditional equivalent |
|---|---:|---:|
| **Total hours** | **221** | **663** |
| **Total budget @ $35/hr** | **$7,735** | **$23,205** |
| Budget @ $90/hr (EU) | — | $59,670 |
| Budget @ $150/hr (US) | — | $99,450 |

---

## 2. Module-by-module breakdown

### 2.1 WhatsApp Business API & Webhook Infrastructure

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Meta WhatsApp Business app setup + phone number verification | 2 | 6 | $70 | $210 |
| Webhook endpoint + Meta signature verification | 2 | 6 | $70 | $210 |
| HTTPS / SSL configuration | 2 | 6 | $70 | $210 |
| **Subtotal** | **6** | **18** | **$210** | **$630** |

### 2.2 Inbound Message Handler

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Webhook payload parsing (text, media, button replies) | 2 | 6 | $70 | $210 |
| Message routing to conversation engine | 2 | 6 | $70 | $210 |
| Media download (images from customers) | 1 | 3 | $35 | $105 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

### 2.3 Outbound Messaging (partial reuse from AI Assistant)

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Adapt existing `apps/ai/src/mcp_server/whatsapp.py` for multi-conversation flow | 1 | 3 | $35 | $105 |
| Send text messages | 1 | 3 | $35 | $105 |
| Send product images | 1 | 3 | $35 | $105 |
| Send invoice PDFs as documents | 1 | 3 | $35 | $105 |
| Quick-reply buttons | 1 | 3 | $35 | $105 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

*Note: reusing ~3 hours of work already delivered in the AI Assistant — net new effort = ~2 hours less than greenfield.*

### 2.4 Template Message Management

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Template authoring + Meta approval submission | 1 | 3 | $35 | $105 |
| Template versioning in code | 1 | 3 | $35 | $105 |
| Use-template helper in outbound sender | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.5 Session & Conversation State Tracking

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| `whatsapp_conversations` table (per phone, conversation history, current state) | 2 | 6 | $70 | $210 |
| RLS policies | 1 | 3 | $35 | $105 |
| Conversation expiry / cleanup job | 1 | 3 | $35 | $105 |
| State machine helpers (current stage, cart contents) | 2 | 6 | $70 | $210 |
| **Subtotal** | **6** | **18** | **$210** | **$630** |

### 2.6 Rate Limiting & Message Queue

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Per-tenant + per-phone rate limiting | 2 | 6 | $70 | $210 |
| Outbound message queue (handle Meta API limits) | 2 | 6 | $70 | $210 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.7 24-Hour Customer Service Window Compliance

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Track last customer message timestamp per conversation | 1 | 3 | $35 | $105 |
| Enforce template-only sends outside 24-hour window | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.8 Opt-in / Opt-out Management

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Opt-in capture on first inbound message | 1 | 3 | $35 | $105 |
| Opt-out keyword handling (STOP / إيقاف) | 1 | 3 | $35 | $105 |
| Per-customer consent record | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.9 Message Logging & Audit

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| `whatsapp_messages` audit table | 1 | 3 | $35 | $105 |
| Inbound + outbound logging | 1 | 3 | $35 | $105 |
| Retention policy job | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.10 Failed Delivery Handling

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Delivery status webhook (sent / delivered / read / failed) | 1 | 3 | $35 | $105 |
| Retry logic + admin alert on failure | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.11 LLM Integration & Conversation Memory

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Reuse `apps/ai/src/llm/provider.py` (LiteLLM multi-provider) | 1 | 3 | $35 | $105 |
| Per-conversation message history + context window management | 2 | 6 | $70 | $210 |
| System prompt with company persona, products, policies | 2 | 6 | $70 | $210 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

### 2.12 Intent Classification

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Intent taxonomy (greeting / price query / product info / order / complaint / handoff / farewell) | 1 | 3 | $35 | $105 |
| LLM-based classifier with few-shot prompt | 2 | 6 | $70 | $210 |
| Intent → flow router | 2 | 6 | $70 | $210 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

### 2.13 Conversation Flow State Machine

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| State definitions (greeting → browsing → cart → checkout → confirm → closed) | 2 | 6 | $70 | $210 |
| State transition logic | 2 | 6 | $70 | $210 |
| LangGraph state machine (reusing AI Assistant patterns) | 3 | 9 | $105 | $315 |
| **Subtotal** | **7** | **21** | **$245** | **$735** |

### 2.14 Language Detection (Arabic / English)

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Per-message language detection | 1 | 3 | $35 | $105 |
| Reply-in-same-language pattern | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.15 Human Handoff Logic

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Trigger conditions (customer asks for human / AI confidence low / complaint) | 1 | 3 | $35 | $105 |
| Pause AI + notify admin | 1 | 3 | $35 | $105 |
| Admin takeover UI hook (in dashboard) | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.16 Off-topic & Fallback Handling

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Out-of-scope detection + polite redirect | 2 | 6 | $70 | $210 |
| Generic fallback templates per language | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.17 Product Catalog RAG (multilingual)

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Reuse `apps/ai/src/rag/ingest.py` + extend to products with Arabic + English fields | 2 | 6 | $70 | $210 |
| Daily refresh job for product embeddings | 2 | 6 | $70 | $210 |
| Multilingual similarity search | 2 | 6 | $70 | $210 |
| Image URL inclusion in metadata | 1 | 3 | $35 | $105 |
| **Subtotal** | **7** | **21** | **$245** | **$735** |

### 2.18 Product Search & Details Response

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| `search_products` tool with RAG | 2 | 6 | $70 | $210 |
| `get_product_details` tool (price, stock, packaging) | 1 | 3 | $35 | $105 |
| Formatted product reply card | 2 | 6 | $70 | $210 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

### 2.19 Product Image Sending

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Resolve product image URL (Supabase Storage) | 1 | 3 | $35 | $105 |
| Send via WhatsApp media API | 1 | 3 | $35 | $105 |
| Caption with price + brief | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.20 Pricing Tier & Stock Logic

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Resolve pricing tier per customer (retail vs wholesale vs VIP) | 1 | 3 | $35 | $105 |
| Multi-warehouse stock availability check | 1 | 3 | $35 | $105 |
| "In stock" / "low stock" / "out of stock" formatted replies | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.21 Alternative Product Suggestions

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| When asked-for product is out of stock or unavailable | 1 | 3 | $35 | $105 |
| RAG-based similar-product lookup | 1 | 3 | $35 | $105 |
| Polite suggestion response | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.22 Customer Lookup by Phone

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Phone-number normalization (E.164) | 1 | 3 | $35 | $105 |
| ERP `parties` lookup by `whatsapp_phone` or `phone` | 1 | 3 | $35 | $105 |
| Existing-customer greeting personalization | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.23 Prospective Customer Capture Flow

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Conversational onboarding (ask name, location, optional email) | 2 | 6 | $70 | $210 |
| Validate + store as `parties` with `prospect_status = 'prospect'` | 1 | 3 | $35 | $105 |
| Create-party API call to ERP | 1 | 3 | $35 | $105 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.24 Customer Status Workflow

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Status transitions: `prospect` → `lead` (started cart) → `customer` (first invoice) | 2 | 6 | $70 | $210 |
| Auto-promote on first paid invoice | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.25 Consent Management

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Consent timestamp on first interaction | 1 | 3 | $35 | $105 |
| Consent revocation handling | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.26 Conversational Cart Management

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Cart state per conversation (line items, qty, price) | 3 | 9 | $105 | $315 |
| Add / remove / update line items via natural language | 2 | 6 | $70 | $210 |
| Cart persistence across messages | 1 | 3 | $35 | $105 |
| Cart summary message | 1 | 3 | $35 | $105 |
| **Subtotal** | **7** | **21** | **$245** | **$735** |

### 2.27 Item Add / Quantity / Unit Flow

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Parse "I want X kg of Y" type phrases | 2 | 6 | $70 | $210 |
| Unit clarification when ambiguous (piece / box / carton) | 1 | 3 | $35 | $105 |
| Quantity confirmation step | 1 | 3 | $35 | $105 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.28 Discount & Total Calculation

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Apply customer-tier pricing automatically | 1 | 3 | $35 | $105 |
| Discount handling (% or fixed, with admin policy) | 1 | 3 | $35 | $105 |
| Tax inclusive/exclusive total display | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.29 Delivery Details Capture

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Capture delivery address / pickup choice | 1 | 3 | $35 | $105 |
| Capture preferred delivery date | 1 | 3 | $35 | $105 |
| Update customer record with delivery defaults | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.30 Draft Invoice Generation (ERP API)

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Map cart → ERP invoice payload | 2 | 6 | $70 | $210 |
| POST to ERP `/invoices` with `status = 'draft'`, `source = 'whatsapp'` | 1 | 3 | $35 | $105 |
| Link `whatsapp_conversation_id` for traceability | 1 | 3 | $35 | $105 |
| Error handling + retry | 1 | 3 | $35 | $105 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

### 2.31 Invoice PDF Generation & Send

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Trigger ERP invoice PDF render | 1 | 3 | $35 | $105 |
| Upload to Supabase Storage with signed URL | 1 | 3 | $35 | $105 |
| Send to customer via WhatsApp document message | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.32 Order Confirmation Flow

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Confirmation summary message before invoice send | 1 | 3 | $35 | $105 |
| Customer "confirm" / "modify" / "cancel" replies | 1 | 3 | $35 | $105 |
| Post-confirmation thank-you + admin notification | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.33 Admin Conversations Dashboard (new page in ERP web)

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| `/whatsapp/conversations` route | 2 | 6 | $70 | $210 |
| Conversation list with filters (active / closed / handoff) | 2 | 6 | $70 | $210 |
| Real-time updates (Supabase realtime subscription) | 2 | 6 | $70 | $210 |
| Conversation card with last message preview | 1 | 3 | $35 | $105 |
| **Subtotal** | **7** | **21** | **$245** | **$735** |

### 2.34 Live Conversation Monitoring

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Drill-down to single conversation thread | 2 | 6 | $70 | $210 |
| Real-time message updates | 1 | 3 | $35 | $105 |
| Inbound/outbound visual distinction | 1 | 3 | $35 | $105 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.35 Per-Customer Conversation History

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Link from customer profile to WhatsApp conversations | 1 | 3 | $35 | $105 |
| Historical thread browser | 2 | 6 | $70 | $210 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.36 Quick Handoff Button

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| "Take over from AI" button in conversation view | 1 | 3 | $35 | $105 |
| Pause AI flag + manual message composer | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.37 Draft Invoice Review Queue

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| `Sales → WhatsApp Drafts` filter view | 2 | 6 | $70 | $210 |
| Inline conversation link per draft | 1 | 3 | $35 | $105 |
| Bulk approve / reject actions | 2 | 6 | $70 | $210 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

### 2.38 Approve / Edit / Reject Draft Invoice Workflow

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Approve → trigger ERP invoice finalize flow | 1 | 3 | $35 | $105 |
| Edit → load draft into invoice form for modification | 2 | 6 | $70 | $210 |
| Reject → notify customer via WhatsApp + close draft | 1 | 3 | $35 | $105 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.39 Conversion Analytics Dashboard

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| New prospects / day | 1 | 3 | $35 | $105 |
| Prospect → customer conversion rate | 1 | 3 | $35 | $105 |
| Average conversation length to first invoice | 1 | 3 | $35 | $105 |
| Draft approval rate + revenue from WhatsApp channel | 1 | 3 | $35 | $105 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.40 Conversation Templates Management

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Admin UI for editing greeting / FAQ / closing templates | 2 | 6 | $70 | $210 |
| Per-language template versions | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.41 Customer Schema Extensions (ERP modification)

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| `prospect_status` enum (`prospect` / `lead` / `customer`) | 1 | 3 | $35 | $105 |
| `acquisition_source` enum (`whatsapp` / `direct` / `referral` / `walk-in`) | 1 | 3 | $35 | $105 |
| `whatsapp_phone` field + `language_preference` field | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.42 Invoice Schema Extensions (ERP modification)

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| `source` field (existing → extended: includes `whatsapp_draft`) | 1 | 3 | $35 | $105 |
| `whatsapp_conversation_id` FK | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.43 Migrations + RLS Updates

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| New migration for parties extensions + new tables (`whatsapp_conversations`, `whatsapp_messages`) | 2 | 6 | $70 | $210 |
| RLS policies for new tables (JWT-claim pattern) | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.44 Prospects View in Customers Module

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| `Customers → Prospects` filtered list | 2 | 6 | $70 | $210 |
| Prospect-specific columns (source, last interaction, conversion candidate flag) | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.45 WhatsApp Drafts Filter in Sales Module

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Quick-filter chip "WhatsApp drafts" in sales list | 1 | 3 | $35 | $105 |
| Badge / icon on rows sourced from WhatsApp | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.46 Customer Status Badges in UI

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Visual badge component for `prospect` / `lead` / `customer` | 1 | 3 | $35 | $105 |
| Display on customer list + profile | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.47 Notifications — New Prospect

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Trigger on prospect creation | 1 | 3 | $35 | $105 |
| In-app toast + email to sales admin | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.48 Notifications — New Draft Invoice

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Trigger on draft creation from WhatsApp | 1 | 3 | $35 | $105 |
| In-app + email notification | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.49 Daily Summary Email

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Scheduled job (APScheduler) | 1 | 3 | $35 | $105 |
| Summary template (conversations, prospects, drafts, revenue) | 1 | 3 | $35 | $105 |
| Send via Gmail connector (reuse from AI Assistant) | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.50 Handoff Alerts

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Real-time push notification on handoff trigger | 1 | 3 | $35 | $105 |
| Optional WhatsApp/email backup channel for after-hours | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.51 Arabic + English Response Templates

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Greeting / farewell / FAQ / fallback in both languages | 3 | 9 | $105 | $315 |
| Per-stage prompt versions (browsing, cart, checkout, confirmation) | 2 | 6 | $70 | $210 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

### 2.52 Localized Number / Price / Date Formatting

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Currency formatting per locale | 1 | 3 | $35 | $105 |
| Arabic numeral support | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.53 Production Deployment

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Containerize agent (Dockerfile, multi-stage) | 1 | 3 | $35 | $105 |
| Fly.io / Railway deployment config | 2 | 6 | $70 | $210 |
| Secrets management | 1 | 3 | $35 | $105 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.54 SSL / HTTPS / Webhook URL

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Domain + SSL certificate | 1 | 3 | $35 | $105 |
| Webhook URL registration with Meta | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.55 Monitoring & Error Tracking

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| LangSmith tracing for AI calls | 1 | 3 | $35 | $105 |
| Sentry (or equivalent) for application errors | 1 | 3 | $35 | $105 |
| Health-check endpoint + uptime monitoring | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.56 Logging Aggregation

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Structured logging | 1 | 3 | $35 | $105 |
| Log shipping config | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

### 2.57 E2E Conversation Tests

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Scripted conversation scenarios (10 happy paths) | 3 | 9 | $105 | $315 |
| Edge cases (cancel, modify, out-of-stock, language switch) | 2 | 6 | $70 | $210 |
| **Subtotal** | **5** | **15** | **$175** | **$525** |

### 2.58 WhatsApp Test Mode / Simulator

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Local webhook mock that simulates Meta payloads | 2 | 6 | $70 | $210 |
| CLI tool to send test inbound messages | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.59 Eval Harness (multilingual)

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| 30 multilingual test prompts with expected behavior | 2 | 6 | $70 | $210 |
| Pytest harness | 1 | 3 | $35 | $105 |
| Regression tracking + LangSmith integration | 1 | 3 | $35 | $105 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.60 Load Testing

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Concurrent conversation simulation | 2 | 6 | $70 | $210 |
| Bottleneck identification + tuning | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.61 Build Plan & Specs

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Architecture spec + diagrams | 2 | 6 | $70 | $210 |
| Conversation flow diagrams | 1 | 3 | $35 | $105 |
| Phase-by-phase build plan | 1 | 3 | $35 | $105 |
| **Subtotal** | **4** | **12** | **$140** | **$420** |

### 2.62 Operator Playbook

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| How to manage templates | 1 | 3 | $35 | $105 |
| How to review/approve drafts | 1 | 3 | $35 | $105 |
| Troubleshooting guide | 1 | 3 | $35 | $105 |
| **Subtotal** | **3** | **9** | **$105** | **$315** |

### 2.63 API / Integration Documentation

| Feature | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---:|---:|---:|---:|
| Webhook schema + auth | 1 | 3 | $35 | $105 |
| ERP integration points + new endpoints | 1 | 3 | $35 | $105 |
| **Subtotal** | **2** | **6** | **$70** | **$210** |

---

## 3. Grand totals

| Category | Modules | Vibe hrs | Trad hrs | Vibe $ | Trad $ |
|---|---|---:|---:|---:|---:|
| WhatsApp Integration Infrastructure | 2.1–2.10 | 37 | 111 | $1,295 | $3,885 |
| AI Conversation Engine | 2.11–2.16 | 25 | 75 | $875 | $2,625 |
| Product Knowledge & Queries | 2.17–2.21 | 21 | 63 | $735 | $2,205 |
| Customer Identification & Onboarding | 2.22–2.25 | 12 | 36 | $420 | $1,260 |
| Order Building & Invoice Creation | 2.26–2.32 | 28 | 84 | $980 | $2,940 |
| Admin UI (in ERP web) | 2.33–2.40 | 32 | 96 | $1,120 | $3,360 |
| ERP Schema & UI Modifications | 2.41–2.46 | 15 | 45 | $525 | $1,575 |
| Notifications | 2.47–2.50 | 9 | 27 | $315 | $945 |
| Bilingual Support | 2.51–2.52 | 7 | 21 | $245 | $735 |
| Infrastructure & Deployment | 2.53–2.56 | 11 | 33 | $385 | $1,155 |
| Testing & QA | 2.57–2.60 | 15 | 45 | $525 | $1,575 |
| Documentation | 2.61–2.63 | 9 | 27 | $315 | $945 |
| **GRAND TOTAL** | **63 modules** | **221** | **663** | **$7,735** | **$23,205** |

---

## 4. Phased delivery plan

| Phase | Scope | Modules included | Vibe hrs | Trad hrs | Budget @ $35/hr |
|---|---|---|---:|---:|---:|
| **Phase 1 — MVP foundation** (~3 weeks part-time) | WhatsApp connection, basic Q&A, product RAG, admin can see live conversations | 2.1, 2.2, 2.3, 2.5, 2.9, 2.11, 2.14, 2.16, 2.17, 2.18, 2.19, 2.20, 2.33, 2.34, 2.43, 2.51, 2.53, 2.54, 2.61 | 62 | 186 | $2,170 vibe / $6,510 trad |
| **Phase 2 — Order building** (~3 weeks part-time) | Conversational cart, item add flow, discount/total, delivery capture, draft invoice generation, PDF send | 2.13, 2.21, 2.26, 2.27, 2.28, 2.29, 2.30, 2.31, 2.32, 2.45 | 33 | 99 | $1,155 vibe / $3,465 trad |
| **Phase 3 — Customer CRM integration** (~3 weeks part-time) | Customer schema extensions, prospect workflow, consent, lookup, status badges, prospects view | 2.4, 2.7, 2.8, 2.12, 2.15, 2.22, 2.23, 2.24, 2.25, 2.35, 2.36, 2.41, 2.42, 2.44, 2.46 | 36 | 108 | $1,260 vibe / $3,780 trad |
| **Phase 4 — Operations & polish** (~3 weeks part-time) | Admin review queue, notifications, analytics, templates UI, monitoring, eval harness, deploy to production | 2.6, 2.10, 2.37, 2.38, 2.39, 2.40, 2.47, 2.48, 2.49, 2.50, 2.52, 2.55, 2.56, 2.57, 2.58, 2.59, 2.60, 2.62, 2.63 | 90 | 270 | $3,150 vibe / $9,450 trad |
| **TOTAL** | | | **221** | **663** | **$7,735 / $23,205** |

**Calendar timeline**: ~12 weeks part-time (3 weeks per phase). Could compress to ~6 weeks full-time.

---

## 5. Combined view — ERP + AI Assistant + WhatsApp Agent

The total product investment after this build:

| | ERP | AI Assistant | WhatsApp Agent | **Combined** |
|---|---:|---:|---:|---:|
| Vibe hours | 931 | 145 | 221 | **1,297** |
| Traditional dev hours | 2,793 | 435 | 663 | **3,891** |
| Cost @ $35/hr (MENA) | $32,585 / $97,755 | $5,075 / $15,225 | $7,735 / $23,205 | **$45,395 / $136,185** |
| Cost @ $90/hr (EU, trad) | $251,370 | $39,150 | $59,670 | **$350,190** |
| Cost @ $150/hr (US, trad) | $418,950 | $65,250 | $99,450 | **$583,650** |

The WhatsApp Agent would represent **17%** of the combined effort (221 of 1,297 vibe hours) but open a fully new sales channel.

---

## 6. Business case (high-level — full ROI in partner doc)

**Why build this:**
- New sales channel via WhatsApp (#1 messaging app in MENA region for business communication).
- Reduce sales-team time spent on repetitive price/availability inquiries.
- Capture leads that would otherwise be lost (no need for the customer to visit, call, or fill a form).
- Faster customer response = higher conversion.
- 24/7 availability vs. business-hours phone support.

**Conservative ROI scenario:**
- If WhatsApp agent generates **just 8 new customer orders / month** averaging **$200 each**, that's **$1,600/month** in new revenue.
- At a 25% gross margin, that's **$400/month** = **$4,800/year** in new gross profit.
- Build cost ($23,205 traditional or $7,735 vibe) is recovered in **5–11 months** under that conservative scenario.
- Aggressive scenario (30 orders/month × $300 avg × 25% margin = $27,000/year) recovers cost in **1–3 months**.

---

## 7. Caveats & assumptions

1. **WhatsApp Business API access required** — Meta approval can take 1–3 weeks. Build estimate assumes the account is approved or in approval by Phase 1 start.
2. **Template message approval** by Meta for the chosen language pairs (Arabic + English) — typically 24–48 hours per template, no developer time but a calendar dependency.
3. **Pricing accuracy** depends on the ERP's product catalog being current and well-tagged with multi-language product names. Catalog grooming time is NOT included in this estimate (estimated separately at ~10–15 hrs / $350–$525 if needed).
4. **The 3× vibe-vs-traditional multiplier** holds for most modules; conversational AI work compresses closer to 4× thanks to existing patterns from the AI Assistant.
5. **Reuse from AI Assistant** is ~10 hours saved on outbound WhatsApp, LLM provider abstraction, RAG ingestion, LangGraph state-machine patterns, and Google OAuth (for daily summary email). Already accounted for in the line-item estimates above.
6. **Operating cost is separate from build cost.** Expect ongoing **~$50–$150/month** for: Meta WhatsApp Business API per-conversation charges (after the first 1,000 free); LLM provider usage (~$30–$80/month at moderate volume); hosting on Fly.io or Railway (~$20–$30/month); monitoring/observability (~$0–$30/month).

---

## 8. Verification

1. **Phase 1 verification**: send a WhatsApp message to the agent's number → receive a coherent product info reply that cites a real product from the ERP catalog. Admin dashboard shows the conversation live.
2. **Phase 2 verification**: complete a full order via WhatsApp → draft invoice appears in ERP Sales module with `status=draft, source=whatsapp`, linked to the conversation.
3. **Phase 3 verification**: a new phone number messages the agent → prospect record created in Customers module with `prospect_status=prospect, acquisition_source=whatsapp`.
4. **Phase 4 verification**: admin reviews draft → approves → invoice finalizes via standard ERP flow → customer is auto-promoted to `prospect_status=customer`. Eval harness passes ≥27/30 cases.
5. **End-to-end E2E**: 10 simulated customer conversations across happy paths and edge cases all produce expected outcomes.

---

## 9. Document export options

- **PDF (simplest)**: open in VS Code → Print to PDF
- **PDF (best quality)**: `pandoc docs/whatsapp-agent/dev-cost-estimate.md -o whatsapp-agent-cost.pdf --pdf-engine=xelatex`
- **DOCX (Word)**: `pandoc docs/whatsapp-agent/dev-cost-estimate.md -o whatsapp-agent-cost.docx`
