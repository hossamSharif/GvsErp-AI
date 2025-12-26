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
} from '@erp-saas/shared';
import { ModelFactory } from '../lib/ai-models/model-factory';
import { ConversationContextManager } from '../lib/context-manager';
import { DataAccessLayer } from '../lib/data-access-layer';
import { buildSystemPrompt, buildTitleGenerationPrompt } from '../lib/ai-models/system-prompts';
import { AIMessageRepository } from '../repositories/ai-message.repository';
import { AIUsageRepository } from '../repositories/ai-usage.repository';
import { AIDocumentRepository } from '../repositories/ai-document.repository';

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
  private contextManager: ConversationContextManager;
  private dataAccessLayer: DataAccessLayer;

  constructor(private supabase: SupabaseClient<Database>) {
    this.messageRepo = new AIMessageRepository(supabase);
    this.usageRepo = new AIUsageRepository(supabase);
    this.documentRepo = new AIDocumentRepository(supabase);
    this.contextManager = new ConversationContextManager(supabase);
    this.dataAccessLayer = new DataAccessLayer(supabase);
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
    const businessContext = await this.fetchBusinessContext(userContext, userMessage);

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
   * @returns Business context string
   */
  private async fetchBusinessContext(
    userContext: UserContext,
    query: string
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
        }
      }

      // Customer context
      if (queryLower.includes('customer') || queryLower.includes('client')) {
        const customerData = await this.dataAccessLayer.getTopCustomers(userContext, 10);
        if (customerData.data.length > 0) {
          contextParts.push(`Top Customers: ${JSON.stringify(customerData.data)}`);
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
}
