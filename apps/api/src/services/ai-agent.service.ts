/**
 * AI Agent Service
 * Core service for processing AI conversations with streaming responses
 */

import { streamText, generateText } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import type {
  Message,
  UserContext,
  ConsultantRole,
  AIModelConfig,
  Document,
  UsageActionType,
  TaskType,
  Task,
} from '@erp-saas/shared';
import { ModelFactory } from '../lib/ai-models/model-factory';
import { ConversationContextManager } from '../lib/context-manager';
import { DataAccessLayer } from '../lib/data-access-layer';
import { buildSystemPrompt, buildTitleGenerationPrompt } from '../lib/ai-models/system-prompts';
import { AIMessageRepository } from '../repositories/ai-message.repository';
import { AIUsageRepository } from '../repositories/ai-usage.repository';
import { AIDocumentRepository } from '../repositories/ai-document.repository';
import { AITaskRepository } from '../repositories/ai-task.repository';
import { AIAuditService } from './ai-audit.service';

/**
 * Streaming response interface
 */
export interface StreamingResponse {
  stream: ReadableStream;
  messageId: string;
  conversationId: string;
}

/**
 * Process message options
 */
export interface ProcessMessageOptions {
  userContext: UserContext;
  conversationId: string;
  consultantRole: ConsultantRole;
  userMessage: string;
  documentIds?: string[];
  modelConfig?: AIModelConfig;
}

/**
 * AI Agent Service
 * Handles streaming AI conversations with context management
 */
export class AIAgentService {
  private messageRepo: AIMessageRepository;
  private usageRepo: AIUsageRepository;
  private documentRepo: AIDocumentRepository;
  private taskRepo: AITaskRepository;
  private contextManager: ConversationContextManager;
  private dataAccessLayer: DataAccessLayer;
  private auditService: AIAuditService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.messageRepo = new AIMessageRepository(supabase);
    this.usageRepo = new AIUsageRepository(supabase);
    this.documentRepo = new AIDocumentRepository(supabase);
    this.taskRepo = new AITaskRepository(supabase);
    this.contextManager = new ConversationContextManager(supabase);
    this.dataAccessLayer = new DataAccessLayer(supabase);
    this.auditService = new AIAuditService();
  }

  /**
   * Process user message with streaming AI response
   * @param options - Processing options
   * @returns Streaming response with message ID
   */
  async processMessage(options: ProcessMessageOptions): Promise<StreamingResponse> {
    const {
      userContext,
      conversationId,
      consultantRole,
      userMessage,
      documentIds = [],
      modelConfig,
    } = options;

    // 1. Save user message
    const userMessageRecord = await this.messageRepo.createMessage({
      conversation_id: conversationId,
      role: 'user',
      content: userMessage,
      metadata: documentIds.length > 0 ? { documentIds } : null,
    });

    // 2. Get conversation history
    const messages = await this.messageRepo.findByConversation(conversationId);

    // 3. Prepare context with sliding window
    const contextMessages = await this.contextManager.prepareContext(messages);

    // 4. Build system prompt with user context
    const systemPrompt = buildSystemPrompt(userContext, consultantRole);

    // 5. Fetch relevant business data if needed
    // Track data accessed for audit purposes
    const dataAccessedForAudit: Record<string, any> = {};
    const businessContext = await this.fetchBusinessContext(userContext, userMessage, dataAccessedForAudit);

    // 6. Get AI model
    const model = modelConfig
      ? ModelFactory.getModel(modelConfig)
      : ModelFactory.getDefaultModel();

    // 7. Create assistant message placeholder
    const assistantMessage = await this.messageRepo.createMessage({
      conversation_id: conversationId,
      role: 'assistant',
      content: '', // Will be updated as stream completes
      metadata: null,
    });

    // 8. Prepare enhanced prompt with business context
    const enhancedMessages = this.buildEnhancedMessages(
      contextMessages,
      businessContext,
      documentIds
    );

    // 9. Stream AI response
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const result = await streamText({
      model,
      system: systemPrompt,
      messages: enhancedMessages,
      temperature: 0.7,
      maxTokens: 4096,
      onFinish: async (event) => {
        // Update message with full response
        await this.messageRepo.updateMessage(
          conversationId,
          assistantMessage.id,
          {
            content: fullResponse,
            metadata: {
              model: modelConfig?.model || process.env.AI_DEFAULT_MODEL,
              tokens: {
                input: event.usage?.promptTokens || 0,
                output: event.usage?.completionTokens || 0,
                total: event.usage?.totalTokens || 0,
              },
              finishReason: event.finishReason,
            },
          }
        );

        // Track usage
        await this.trackUsage({
          tenantId: userContext.tenantId,
          userId: userContext.userId,
          conversationId,
          actionType: 'question',
          modelUsed: modelConfig?.model || process.env.AI_DEFAULT_MODEL || 'claude-sonnet-4-5',
          tokensUsed: event.usage?.totalTokens || 0,
          inputTokens: event.usage?.promptTokens || 0,
          outputTokens: event.usage?.completionTokens || 0,
        });

        // Audit log the interaction
        await this.auditService.logInteraction({
          tenantId: userContext.tenantId,
          userId: userContext.userId,
          conversationId,
          prompt: userMessage,
          response: fullResponse,
          dataAccessed: dataAccessedForAudit,
          permissions: userContext.permissions,
        });
      },
    });

    // 10. Create transform stream to capture response
    const transformStream = new TransformStream({
      transform: (chunk, controller) => {
        fullResponse += chunk;
        controller.enqueue(chunk);
      },
    });

    // Pipe the result through our transform
    const stream = result.textStream.pipeThrough(transformStream);

    return {
      stream,
      messageId: assistantMessage.id,
      conversationId,
    };
  }

  /**
   * Fetch relevant business context based on user query
   * @param userContext - User context
   * @param query - User query
   * @param auditTracker - Object to track accessed data for auditing
   * @returns Business context string
   */
  private async fetchBusinessContext(
    userContext: UserContext,
    query: string,
    auditTracker?: Record<string, any>
  ): Promise<string> {
    const queryLower = query.toLowerCase();
    const contextParts: string[] = [];

    try {
      // Sales context
      if (
        queryLower.includes('sale') ||
        queryLower.includes('invoice') ||
        queryLower.includes('revenue')
      ) {
        const salesData = await this.dataAccessLayer.getRecentSalesInvoices(userContext, 10);
        if (salesData.data.length > 0) {
          contextParts.push(`Recent Sales: ${JSON.stringify(salesData.data)}`);
          if (auditTracker) {
            auditTracker.sales_invoices = salesData.data.length;
          }
        }
      }

      // Inventory context
      if (
        queryLower.includes('inventory') ||
        queryLower.includes('stock') ||
        queryLower.includes('item')
      ) {
        const inventoryData = await this.dataAccessLayer.getInventoryLevels(userContext, 10);
        if (inventoryData.data.length > 0) {
          contextParts.push(`Inventory Levels: ${JSON.stringify(inventoryData.data)}`);
          if (auditTracker) {
            auditTracker.inventory_items = inventoryData.data.length;
          }
        }
      }

      // Customer context
      if (queryLower.includes('customer') || queryLower.includes('client')) {
        const customerData = await this.dataAccessLayer.getTopCustomers(userContext, 10);
        if (customerData.data.length > 0) {
          contextParts.push(`Top Customers: ${JSON.stringify(customerData.data)}`);
          if (auditTracker) {
            auditTracker.customers = customerData.data.length;
          }
        }
      }

      // Financial context
      if (
        queryLower.includes('finance') ||
        queryLower.includes('payment') ||
        queryLower.includes('balance')
      ) {
        const financeData = await this.dataAccessLayer.getAccountingOverview(userContext);
        if (financeData) {
          contextParts.push(`Financial Overview: ${JSON.stringify(financeData)}`);
          if (auditTracker) {
            auditTracker.financial_overview = true;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching business context:', error);
      // Continue without context if there's an error
    }

    return contextParts.join('\n\n');
  }

  /**
   * Build enhanced messages with business context
   * @param contextMessages - Conversation context
   * @param businessContext - Business data context
   * @param documentIds - Attached document IDs
   * @returns Enhanced messages array
   */
  private buildEnhancedMessages(
    contextMessages: Array<{ role: string; content: string }>,
    businessContext: string,
    documentIds: string[]
  ): Array<{ role: string; content: string }> {
    const messages = [...contextMessages];

    // Add business context if available
    if (businessContext) {
      messages.unshift({
        role: 'system',
        content: `BUSINESS DATA CONTEXT:\n${businessContext}\n\nUse this data to provide accurate, data-driven responses.`,
      });
    }

    // Note: Document content would be added here in a real implementation
    // For now, we just acknowledge their presence
    if (documentIds.length > 0) {
      messages.unshift({
        role: 'system',
        content: `The user has attached ${documentIds.length} document(s) to this message. These documents may contain additional context.`,
      });
    }

    return messages;
  }

  /**
   * Track AI usage
   * @param data - Usage data
   */
  private async trackUsage(data: {
    tenantId: string;
    userId: string;
    conversationId: string;
    actionType: UsageActionType;
    modelUsed: string;
    tokensUsed: number;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    try {
      // Calculate cost estimate based on model pricing
      const costEstimate = this.calculateCost(
        data.modelUsed,
        data.inputTokens,
        data.outputTokens
      );

      await this.usageRepo.trackUsage({
        tenant_id: data.tenantId,
        user_id: data.userId,
        conversation_id: data.conversationId,
        action_type: data.actionType,
        model_used: data.modelUsed,
        tokens_used: data.tokensUsed,
        cost_estimate: costEstimate.toString(),
      });
    } catch (error) {
      console.error('Error tracking usage:', error);
      // Don't fail the request if usage tracking fails
    }
  }

  /**
   * Calculate cost estimate for API usage
   * @param model - Model name
   * @param inputTokens - Input tokens
   * @param outputTokens - Output tokens
   * @returns Cost in USD
   */
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    // Pricing per million tokens (based on MODEL_REGISTRY)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5': { input: 3, output: 15 },
      'claude-haiku-4': { input: 0.8, output: 4 },
      'claude-opus-4': { input: 15, output: 75 },
      'gemini-2.0-flash-exp': { input: 0, output: 0 }, // Free tier
      'gemini-1.5-pro': { input: 1.25, output: 5 },
      'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    };

    const modelPricing = pricing[model] || pricing['claude-sonnet-4-5'];
    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Generate conversation title from first message
   * @param firstMessage - First user message
   * @returns Generated title
   */
  async generateConversationTitle(firstMessage: string): Promise<string> {
    try {
      const model = ModelFactory.getSummaryModel();
      const prompt = buildTitleGenerationPrompt(firstMessage);

      const result = await generateText({
        model,
        prompt,
        temperature: 0.5,
        maxTokens: 50,
      });

      // Clean up the title (remove quotes, trim)
      let title = result.text.trim();
      title = title.replace(/^["']|["']$/g, '');

      // Limit to 50 characters
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      return title || 'New Conversation';
    } catch (error) {
      console.error('Error generating title:', error);
      return 'New Conversation';
    }
  }

  /**
   * Regenerate AI response for a message
   * @param options - Same as processMessage
   * @returns Streaming response
   */
  async regenerateResponse(options: ProcessMessageOptions): Promise<StreamingResponse> {
    // For regeneration, we simply process the message again
    // The conversation history will automatically exclude the old assistant response
    return this.processMessage(options);
  }

  /**
   * Detect if user message contains task creation intent
   * @param userMessage - User's message content
   * @returns Task type if detected, null otherwise
   */
  async detectTaskIntent(userMessage: string): Promise<TaskType | null> {
    const messageLower = userMessage.toLowerCase();

    // Intent keywords for different task types
    const taskIntents = {
      invoice: [
        'create invoice',
        'generate invoice',
        'new invoice',
        'make invoice',
        'invoice for',
        'bill customer',
        'bill client',
      ],
      purchase_order: [
        'create purchase order',
        'new purchase order',
        'order from supplier',
        'purchase from',
        'buy from',
        'create po',
      ],
      sales_order: [
        'create sales order',
        'new sales order',
        'sales order for',
        'sell to',
        'create so',
      ],
      payment: [
        'create payment',
        'record payment',
        'make payment',
        'pay invoice',
        'receive payment',
        'payment for',
        'pay supplier',
        'pay vendor',
      ],
      journal_entry: [
        'create journal entry',
        'new journal entry',
        'record transaction',
        'make entry',
        'debit',
        'credit',
      ],
    };

    // Check each task type for intent keywords
    for (const [taskType, keywords] of Object.entries(taskIntents)) {
      if (keywords.some((keyword) => messageLower.includes(keyword))) {
        return taskType as TaskType;
      }
    }

    // If no clear intent, use AI to analyze more complex requests
    try {
      const model = ModelFactory.getSummaryModel(); // Use faster model for intent detection

      const result = await generateText({
        model,
        prompt: `Analyze this user message and determine if they want to create a transaction.
User message: "${userMessage}"

Respond with ONLY ONE of these exact words (or "none" if not a task request):
- invoice (for sales invoices)
- purchase_order (for purchase orders)
- sales_order (for sales orders)
- payment (for payments or receipts)
- journal_entry (for accounting entries)
- none (if not asking to create a transaction)

Response:`,
        temperature: 0.3,
        maxTokens: 20,
      });

      const intent = result.text.trim().toLowerCase();
      if (
        intent === 'invoice' ||
        intent === 'purchase_order' ||
        intent === 'sales_order' ||
        intent === 'payment' ||
        intent === 'journal_entry'
      ) {
        return intent as TaskType;
      }
    } catch (error) {
      console.error('Error detecting task intent:', error);
    }

    return null;
  }

  /**
   * Generate structured task data using AI
   * @param userContext - User context
   * @param conversationId - Conversation ID
   * @param messageId - Message ID that triggered task
   * @param taskType - Type of task to generate
   * @param userMessage - User's message content
   * @returns Generated task data
   */
  async generateTaskData(
    userContext: UserContext,
    conversationId: string,
    messageId: string,
    taskType: TaskType,
    userMessage: string
  ): Promise<Record<string, any>> {
    const model = ModelFactory.getDefaultModel();

    // Build task-specific prompt
    const taskPrompt = this.buildTaskGenerationPrompt(taskType, userMessage, userContext);

    // Get relevant business data for context
    const businessContext = await this.fetchBusinessContext(userContext, userMessage);

    try {
      const result = await generateText({
        model,
        prompt: `${taskPrompt}

BUSINESS DATA CONTEXT:
${businessContext}

USER MESSAGE:
${userMessage}

Generate the transaction data in valid JSON format. The response MUST be valid JSON only, no explanations.`,
        temperature: 0.5,
        maxTokens: 2048,
      });

      // Parse the generated JSON
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }

      const generatedData = JSON.parse(jsonMatch[0]);

      return generatedData;
    } catch (error) {
      console.error('Error generating task data:', error);
      throw new Error('Failed to generate task data. Please try rephrasing your request.');
    }
  }

  /**
   * Build task-specific generation prompt
   * @param taskType - Type of task
   * @param userMessage - User's message
   * @param userContext - User context
   * @returns Prompt for task generation
   */
  private buildTaskGenerationPrompt(
    taskType: TaskType,
    userMessage: string,
    userContext: UserContext
  ): string {
    const basePrompt = `You are an ERP assistant helping to create a ${taskType.replace('_', ' ')}.
Extract all relevant information from the user's message and business data context.`;

    const taskPrompts: Record<TaskType, string> = {
      invoice: `${basePrompt}

Generate a sales invoice JSON with the following structure:
{
  "type": "sales_invoice",
  "party_id": "uuid-of-customer",
  "party_name": "Customer Name (if not found in data, use name from message)",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "items": [
    {
      "item_id": "uuid-of-item",
      "item_name": "Item Name (if not found in data, use name from message)",
      "quantity": number,
      "unit_price": number,
      "discount_percent": number (default 0),
      "tax_percent": number (default from item or 0)
    }
  ],
  "notes": "string (any special notes mentioned)",
  "payment_terms": "string (e.g., 'Net 30')"
}`,
      purchase_order: `${basePrompt}

Generate a purchase order JSON with the following structure:
{
  "type": "purchase_order",
  "supplier_id": "uuid-of-supplier",
  "supplier_name": "Supplier Name (if not found in data, use name from message)",
  "order_date": "YYYY-MM-DD",
  "expected_date": "YYYY-MM-DD",
  "items": [
    {
      "item_id": "uuid-of-item",
      "item_name": "Item Name (if not found in data, use name from message)",
      "quantity": number,
      "unit_price": number
    }
  ],
  "notes": "string (delivery instructions, etc.)"
}`,
      sales_order: `${basePrompt}

Generate a sales order JSON with the following structure:
{
  "type": "sales_order",
  "customer_id": "uuid-of-customer",
  "customer_name": "Customer Name (if not found in data, use name from message)",
  "order_date": "YYYY-MM-DD",
  "delivery_date": "YYYY-MM-DD",
  "items": [
    {
      "item_id": "uuid-of-item",
      "item_name": "Item Name (if not found in data, use name from message)",
      "quantity": number,
      "unit_price": number
    }
  ],
  "notes": "string"
}`,
      payment: `${basePrompt}

Generate a payment record JSON with the following structure:
{
  "type": "payment",
  "payment_type": "received" | "sent",
  "party_id": "uuid-of-customer-or-supplier",
  "party_name": "Party Name (if not found in data, use name from message)",
  "amount": number,
  "payment_date": "YYYY-MM-DD",
  "payment_method": "cash" | "bank_transfer" | "check" | "credit_card",
  "reference": "string (check number, transaction ref, etc.)",
  "notes": "string"
}`,
      journal_entry: `${basePrompt}

Generate a journal entry JSON with the following structure:
{
  "type": "journal_entry",
  "entry_date": "YYYY-MM-DD",
  "reference": "string",
  "description": "string",
  "lines": [
    {
      "account_code": "string (account code or name)",
      "debit": number (0 if credit),
      "credit": number (0 if debit),
      "description": "string"
    }
  ]
}`,
    };

    return taskPrompts[taskType] || basePrompt;
  }

  /**
   * Validate generated task data against business rules
   * @param taskType - Type of task
   * @param generatedData - AI-generated task data
   * @param userContext - User context for permission checks
   * @returns Validation result with errors if any
   */
  async validateTaskData(
    taskType: TaskType,
    generatedData: Record<string, any>,
    userContext: UserContext
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Common validations
      if (!generatedData || typeof generatedData !== 'object') {
        errors.push('Generated data must be a valid object');
        return { valid: false, errors };
      }

      // Task-specific validations
      switch (taskType) {
        case 'invoice':
          await this.validateInvoiceData(generatedData, errors, userContext);
          break;
        case 'purchase_order':
          await this.validatePurchaseOrderData(generatedData, errors, userContext);
          break;
        case 'sales_order':
          await this.validateSalesOrderData(generatedData, errors, userContext);
          break;
        case 'payment':
          await this.validatePaymentData(generatedData, errors, userContext);
          break;
        case 'journal_entry':
          await this.validateJournalEntryData(generatedData, errors, userContext);
          break;
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      console.error('Error validating task data:', error);
      errors.push('Validation error occurred');
      return { valid: false, errors };
    }
  }

  /**
   * Validate invoice data
   */
  private async validateInvoiceData(
    data: Record<string, any>,
    errors: string[],
    userContext: UserContext
  ): Promise<void> {
    // Required fields
    if (!data.party_name) {
      errors.push('Customer name is required');
    }
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one item is required');
    }

    // Validate items
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any, index: number) => {
        if (!item.item_name) {
          errors.push(`Item ${index + 1}: Item name is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
        }
        if (!item.unit_price || item.unit_price < 0) {
          errors.push(`Item ${index + 1}: Unit price must be 0 or greater`);
        }
      });
    }

    // Validate dates
    if (data.invoice_date && !this.isValidDate(data.invoice_date)) {
      errors.push('Invoice date must be a valid date (YYYY-MM-DD)');
    }
    if (data.due_date && !this.isValidDate(data.due_date)) {
      errors.push('Due date must be a valid date (YYYY-MM-DD)');
    }
  }

  /**
   * Validate purchase order data
   */
  private async validatePurchaseOrderData(
    data: Record<string, any>,
    errors: string[],
    userContext: UserContext
  ): Promise<void> {
    // Required fields
    if (!data.supplier_name) {
      errors.push('Supplier name is required');
    }
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one item is required');
    }

    // Validate items
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any, index: number) => {
        if (!item.item_name) {
          errors.push(`Item ${index + 1}: Item name is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
        }
        if (!item.unit_price || item.unit_price < 0) {
          errors.push(`Item ${index + 1}: Unit price must be 0 or greater`);
        }
      });
    }

    // Validate dates
    if (data.order_date && !this.isValidDate(data.order_date)) {
      errors.push('Order date must be a valid date (YYYY-MM-DD)');
    }
    if (data.expected_date && !this.isValidDate(data.expected_date)) {
      errors.push('Expected date must be a valid date (YYYY-MM-DD)');
    }
  }

  /**
   * Validate sales order data
   */
  private async validateSalesOrderData(
    data: Record<string, any>,
    errors: string[],
    userContext: UserContext
  ): Promise<void> {
    // Required fields
    if (!data.customer_name) {
      errors.push('Customer name is required');
    }
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one item is required');
    }

    // Validate items
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any, index: number) => {
        if (!item.item_name) {
          errors.push(`Item ${index + 1}: Item name is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
        }
        if (!item.unit_price || item.unit_price < 0) {
          errors.push(`Item ${index + 1}: Unit price must be 0 or greater`);
        }
      });
    }

    // Validate dates
    if (data.order_date && !this.isValidDate(data.order_date)) {
      errors.push('Order date must be a valid date (YYYY-MM-DD)');
    }
    if (data.delivery_date && !this.isValidDate(data.delivery_date)) {
      errors.push('Delivery date must be a valid date (YYYY-MM-DD)');
    }
  }

  /**
   * Validate payment data
   */
  private async validatePaymentData(
    data: Record<string, any>,
    errors: string[],
    userContext: UserContext
  ): Promise<void> {
    // Required fields
    if (!data.party_name) {
      errors.push('Party name (customer or supplier) is required');
    }
    if (!data.amount || data.amount <= 0) {
      errors.push('Payment amount must be greater than 0');
    }
    if (!data.payment_type || !['received', 'sent'].includes(data.payment_type)) {
      errors.push('Payment type must be either "received" or "sent"');
    }
    if (
      data.payment_method &&
      !['cash', 'bank_transfer', 'check', 'credit_card'].includes(data.payment_method)
    ) {
      errors.push('Invalid payment method');
    }

    // Validate date
    if (data.payment_date && !this.isValidDate(data.payment_date)) {
      errors.push('Payment date must be a valid date (YYYY-MM-DD)');
    }
  }

  /**
   * Validate journal entry data
   */
  private async validateJournalEntryData(
    data: Record<string, any>,
    errors: string[],
    userContext: UserContext
  ): Promise<void> {
    // Required fields
    if (!data.description) {
      errors.push('Description is required');
    }
    if (!data.lines || !Array.isArray(data.lines) || data.lines.length < 2) {
      errors.push('At least two journal entry lines are required (debit and credit)');
    }

    // Validate lines
    let totalDebit = 0;
    let totalCredit = 0;

    if (data.lines && Array.isArray(data.lines)) {
      data.lines.forEach((line: any, index: number) => {
        if (!line.account_code) {
          errors.push(`Line ${index + 1}: Account code is required`);
        }
        if (line.debit === undefined && line.credit === undefined) {
          errors.push(`Line ${index + 1}: Either debit or credit must be specified`);
        }
        if ((line.debit || 0) < 0 || (line.credit || 0) < 0) {
          errors.push(`Line ${index + 1}: Debit and credit amounts must be non-negative`);
        }
        if (line.debit && line.credit && line.debit > 0 && line.credit > 0) {
          errors.push(`Line ${index + 1}: Cannot have both debit and credit on the same line`);
        }

        totalDebit += line.debit || 0;
        totalCredit += line.credit || 0;
      });

      // Check if debits equal credits (with small tolerance for floating point)
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        errors.push(
          `Total debits (${totalDebit}) must equal total credits (${totalCredit})`
        );
      }
    }

    // Validate date
    if (data.entry_date && !this.isValidDate(data.entry_date)) {
      errors.push('Entry date must be a valid date (YYYY-MM-DD)');
    }
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Detect if user message is requesting a report
   * @param message - User message
   * @returns Report type or null
   */
  detectReportIntent(
    message: string
  ): 'sales' | 'inventory' | 'financial' | 'customer' | 'general' | null {
    const lowerMessage = message.toLowerCase();

    // Sales report keywords
    if (
      lowerMessage.includes('sales report') ||
      lowerMessage.includes('revenue report') ||
      lowerMessage.includes('sales analysis') ||
      lowerMessage.includes('sales summary')
    ) {
      return 'sales';
    }

    // Inventory report keywords
    if (
      lowerMessage.includes('inventory report') ||
      lowerMessage.includes('stock report') ||
      lowerMessage.includes('inventory analysis') ||
      lowerMessage.includes('stock levels')
    ) {
      return 'inventory';
    }

    // Financial report keywords
    if (
      lowerMessage.includes('financial report') ||
      lowerMessage.includes('balance sheet') ||
      lowerMessage.includes('income statement') ||
      lowerMessage.includes('profit and loss') ||
      lowerMessage.includes('p&l') ||
      lowerMessage.includes('financial summary')
    ) {
      return 'financial';
    }

    // Customer report keywords
    if (
      lowerMessage.includes('customer report') ||
      lowerMessage.includes('customer analysis') ||
      lowerMessage.includes('customer balances') ||
      lowerMessage.includes('top customers')
    ) {
      return 'customer';
    }

    // General analysis/report keywords
    if (
      lowerMessage.includes('report') ||
      lowerMessage.includes('analysis') ||
      lowerMessage.includes('summary')
    ) {
      return 'general';
    }

    return null;
  }

  /**
   * Generate a business report based on user request
   * @param userContext - User context
   * @param reportType - Type of report
   * @param message - User's message with specific requirements
   * @returns Report data and formatted text
   */
  async generateReport(
    userContext: UserContext,
    reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'general',
    message: string
  ): Promise<{
    reportData: any;
    formattedReport: string;
  }> {
    let reportData: any = {};

    // Fetch relevant data based on report type
    switch (reportType) {
      case 'sales':
        reportData = await this.generateSalesReport(userContext);
        break;
      case 'inventory':
        reportData = await this.generateInventoryReport(userContext);
        break;
      case 'financial':
        reportData = await this.generateFinancialReport(userContext);
        break;
      case 'customer':
        reportData = await this.generateCustomerReport(userContext);
        break;
      case 'general':
        reportData = await this.generateGeneralReport(userContext);
        break;
    }

    // Use AI to format the report based on user's specific request
    const formattedReport = await this.formatReportWithAI(
      reportType,
      reportData,
      message,
      userContext
    );

    return {
      reportData,
      formattedReport,
    };
  }

  /**
   * Generate sales report
   */
  private async generateSalesReport(userContext: UserContext): Promise<any> {
    const salesData = await this.dataAccessLayer.getRecentSalesInvoices(
      userContext,
      100
    );
    const topCustomers = await this.dataAccessLayer.getTopCustomers(
      userContext,
      10
    );

    // Calculate totals
    const totalSales = salesData.data.reduce(
      (sum, invoice: any) => sum + (invoice.total_amount || 0),
      0
    );

    return {
      sales: salesData.data,
      topCustomers: topCustomers.data,
      totalSales,
      count: salesData.data.length,
    };
  }

  /**
   * Generate inventory report
   */
  private async generateInventoryReport(userContext: UserContext): Promise<any> {
    const inventoryData = await this.dataAccessLayer.getInventoryLevels(
      userContext,
      100
    );

    return {
      items: inventoryData.data,
      totalItems: inventoryData.data.length,
      totalValue: inventoryData.data.reduce(
        (sum: number, item: any) =>
          sum + (item.quantity || 0) * (item.unit_price || 0),
        0
      ),
    };
  }

  /**
   * Generate financial report
   */
  private async generateFinancialReport(userContext: UserContext): Promise<any> {
    const accountingOverview =
      await this.dataAccessLayer.getAccountingOverview(userContext);

    return {
      overview: accountingOverview,
    };
  }

  /**
   * Generate customer report
   */
  private async generateCustomerReport(userContext: UserContext): Promise<any> {
    const topCustomers = await this.dataAccessLayer.getTopCustomers(
      userContext,
      20
    );

    return {
      customers: topCustomers.data,
      totalCustomers: topCustomers.data.length,
    };
  }

  /**
   * Generate general report
   */
  private async generateGeneralReport(userContext: UserContext): Promise<any> {
    // Fetch all available data for general analysis
    const [salesData, inventoryData, customerData, financeData] =
      await Promise.all([
        this.dataAccessLayer.getRecentSalesInvoices(userContext, 20),
        this.dataAccessLayer.getInventoryLevels(userContext, 20),
        this.dataAccessLayer.getTopCustomers(userContext, 10),
        this.dataAccessLayer.getAccountingOverview(userContext),
      ]);

    return {
      sales: salesData.data,
      inventory: inventoryData.data,
      customers: customerData.data,
      finance: financeData,
    };
  }

  /**
   * Format report using AI
   * @param reportType - Type of report
   * @param reportData - Raw report data
   * @param userMessage - User's original message
   * @param userContext - User context
   */
  private async formatReportWithAI(
    reportType: string,
    reportData: any,
    userMessage: string,
    userContext: UserContext
  ): Promise<string> {
    const model = ModelFactory.getDefaultModel();

    const prompt = `You are a business intelligence analyst creating a report for an ERP system.

User Request: ${userMessage}
Report Type: ${reportType}

Data:
${JSON.stringify(reportData, null, 2)}

Please create a comprehensive, well-formatted report that:
1. Answers the user's specific request
2. Highlights key insights and trends
3. Includes relevant metrics and KPIs
4. Provides actionable recommendations
5. Uses clear headings and sections
6. Formats numbers with proper currency symbols and units
7. Is easy to read and understand

Format the report in markdown with tables, bullet points, and headings as appropriate.`;

    const { text } = await generateText({
      model,
      messages: [{ role: 'user', content: prompt }],
    });

    return text;
  }
}
