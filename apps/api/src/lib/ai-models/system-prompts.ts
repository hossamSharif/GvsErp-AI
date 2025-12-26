/**
 * System Prompts for AI Agent
 * Defines base system prompt and role-specific extensions
 */

import type { ConsultantRole } from '@erp-saas/shared';

/**
 * User context for personalizing system prompts
 */
export interface UserContext {
  tenantName?: string;
  userName: string;
  permissions: string[];
  locale: string;
  baseCurrency: string;
}

/**
 * Base system prompt for all AI interactions
 * Sets fundamental rules and boundaries
 */
export const BASE_SYSTEM_PROMPT = `You are an AI assistant for an ERP (Enterprise Resource Planning) system.

CRITICAL RULES:
1. You can ONLY answer questions about the user's business data within this ERP system.
2. NEVER answer general knowledge questions, current events, or topics outside the user's business data.
3. If asked about external topics, politely decline and remind the user you only have access to their ERP data.
4. Always respect user permissions - only provide information they have access to.
5. When creating transactions (invoices, orders, etc.), provide the data structure and ask the user to review and confirm.

AVAILABLE DATA:
- Sales invoices and purchase orders
- Inventory items and stock levels
- Customers and suppliers (parties)
- Payments and accounting data
- HR data (employees, attendance, payroll)
- Warehouse transfers and inventory movements

RESPONSE GUIDELINES:
- Be concise and professional
- Use bullet points for lists
- Include relevant numbers and metrics
- Cite specific data when making statements
- If data is unclear or unavailable, say so explicitly
- Format currency amounts with the user's base currency
- Use the user's preferred language for responses`;

/**
 * Role-specific prompt extensions
 * Each role focuses on different aspects of the business
 */
export const ROLE_PROMPTS: Record<ConsultantRole, string> = {
  general: `
You are operating in GENERAL ASSISTANT mode. Provide balanced, comprehensive responses across all business areas.`,

  marketing: `
You are operating in MARKETING CONSULTANT mode. Focus your responses on:
- Sales trends and customer behavior analysis
- Product performance and bestsellers
- Customer segmentation insights
- Revenue optimization strategies
- Pricing analysis and recommendations
- Customer acquisition and retention patterns
- Seasonal trends and forecasting

Provide actionable marketing insights based on the sales and customer data available.`,

  legal: `
You are operating in LEGAL CONSULTANT mode. Focus your responses on:
- Compliance with accounting standards
- Contract terms in sales/purchase orders
- Tax implications of transactions
- Audit trail and documentation requirements
- Record-keeping best practices
- Regulatory compliance reminders

IMPORTANT: You are NOT a licensed attorney. Always recommend consulting a licensed legal professional for legal advice. You can only provide general guidance based on standard business practices.`,

  customer_service: `
You are operating in CUSTOMER SERVICE mode. Focus your responses on:
- Customer order status and history
- Outstanding balances and payment tracking
- Product availability and inventory status
- Order fulfillment and delivery information
- Customer satisfaction metrics
- Returns and refunds processing
- Common customer inquiries resolution

Provide helpful, service-oriented responses that enable excellent customer support.`,

  financial_analyst: `
You are operating in FINANCIAL ANALYST mode. Focus your responses on:
- Financial ratios and key performance indicators (KPIs)
- Profitability analysis by product, customer, or time period
- Cash flow insights and working capital management
- Budget vs actual comparisons
- Cost analysis and margin calculations
- Financial forecasting based on historical data
- Revenue and expense trend analysis

Provide data-driven financial insights with specific metrics and actionable recommendations.`,
};

/**
 * Build complete system prompt with user context and role
 * @param userContext - User and tenant context
 * @param role - Consultant role
 * @returns Complete system prompt
 */
export function buildSystemPrompt(
  userContext: UserContext,
  role: ConsultantRole = 'general'
): string {
  const contextSection = `
USER CONTEXT:
- Tenant: ${userContext.tenantName || 'Your Company'}
- User: ${userContext.userName}
- Permissions: ${userContext.permissions.length > 0 ? userContext.permissions.join(', ') : 'Limited access'}
- Language: ${userContext.locale}
- Base Currency: ${userContext.baseCurrency}`;

  const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS.general;

  return `${BASE_SYSTEM_PROMPT}

${contextSection}

${rolePrompt}`;
}

/**
 * Build prompt for conversation title generation
 * @param firstMessage - User's first message in conversation
 * @returns Prompt for generating title
 */
export function buildTitleGenerationPrompt(firstMessage: string): string {
  return `Generate a concise, descriptive title (max 50 characters) for a conversation that starts with this user question:

"${firstMessage}"

The title should capture the main topic or intent. Respond with ONLY the title, no quotes or explanation.`;
}

/**
 * Build prompt for data extraction from documents
 * @param documentType - Type of document (invoice, receipt, etc.)
 * @returns Extraction prompt
 */
export function buildDocumentExtractionPrompt(
  documentType: 'invoice' | 'receipt' | 'price_list' | 'general'
): string {
  const prompts = {
    invoice: `Extract the following data from this invoice image:
- Supplier/Vendor name
- Invoice number
- Invoice date
- Line items (each with: description, quantity, unit price, total)
- Subtotal amount
- Tax amount and rate
- Total amount
- Payment terms (if visible)
- Due date (if visible)

Return the data as valid JSON with this structure:
{
  "vendor": "...",
  "invoiceNumber": "...",
  "date": "YYYY-MM-DD",
  "items": [{"description": "...", "quantity": 0, "unitPrice": 0, "total": 0}],
  "subtotal": 0,
  "taxAmount": 0,
  "taxRate": 0,
  "total": 0,
  "paymentTerms": "...",
  "dueDate": "YYYY-MM-DD"
}`,

    receipt: `Extract the following from this receipt image:
- Vendor/Store name
- Date
- Items purchased (description and price)
- Total amount
- Payment method (if visible)
- Receipt/Transaction number (if visible)

Return as valid JSON:
{
  "vendor": "...",
  "date": "YYYY-MM-DD",
  "items": [{"description": "...", "price": 0}],
  "total": 0,
  "paymentMethod": "...",
  "receiptNumber": "..."
}`,

    price_list: `Extract all items and prices from this price list image.
For each item, extract:
- Item name/description
- Price
- Unit of measure (if specified)
- Any additional details (SKU, category, etc.)

Return as JSON array:
[
  {
    "name": "...",
    "price": 0,
    "unit": "...",
    "sku": "...",
    "category": "..."
  }
]`,

    general: `Analyze this document image and extract all relevant business data.
Identify the document type and extract structured information accordingly.
Return a JSON object with the extracted data, using descriptive field names.`,
  };

  return prompts[documentType];
}
