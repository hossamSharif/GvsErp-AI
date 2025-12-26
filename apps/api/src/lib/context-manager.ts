/**
 * Conversation Context Manager
 * Handles sliding window context management and message summarization
 */

import { generateText } from 'ai';
import type { Message } from '@erp-saas/shared';
import { ModelFactory } from './ai-models/model-factory';

/**
 * Manages conversation context with sliding window approach
 * Keeps recent messages and summarizes older messages to fit within token limits
 */
export class ConversationContextManager {
  /**
   * Maximum number of recent messages to keep in full
   * Configurable via AI_MAX_CONTEXT_MESSAGES environment variable
   */
  private readonly maxRecentMessages: number;

  /**
   * Whether summarization is enabled
   * Configurable via AI_ENABLE_SUMMARIZATION environment variable
   */
  private readonly enableSummarization: boolean;

  constructor() {
    this.maxRecentMessages = parseInt(
      process.env.AI_MAX_CONTEXT_MESSAGES || '20',
      10
    );
    this.enableSummarization =
      process.env.AI_ENABLE_SUMMARIZATION !== 'false';
  }

  /**
   * Prepare conversation context with sliding window
   * If messages exceed maxRecentMessages, older messages are summarized
   * @param messages - Full conversation history
   * @returns Optimized message array for AI model
   */
  async prepareContext(
    messages: Message[]
  ): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
    // If conversation is short, return all messages
    if (messages.length <= this.maxRecentMessages) {
      return messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    }

    // Split into recent and older messages
    const recentMessages = messages.slice(-this.maxRecentMessages);
    const olderMessages = messages.slice(0, -this.maxRecentMessages);

    // If summarization is disabled, just truncate
    if (!this.enableSummarization) {
      return recentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    }

    // Summarize older messages
    const summary = await this.summarizeMessages(olderMessages);

    // Return summary + recent messages
    return [
      {
        role: 'system',
        content: `Previous conversation summary (${olderMessages.length} messages):\n${summary}`,
      },
      ...recentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];
  }

  /**
   * Summarize a set of messages using AI
   * Uses fast/cheap summary model (Claude Haiku 4 by default)
   * @param messages - Messages to summarize
   * @returns Concise summary text
   */
  async summarizeMessages(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return 'No previous conversation.';
    }

    try {
      // Format messages for summarization
      const conversationText = messages
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      // Use summary model for cost efficiency
      const model = ModelFactory.getSummaryModel();

      const result = await generateText({
        model,
        prompt: `Summarize this conversation concisely, focusing on key questions, decisions, and context. Keep it under 500 words:\n\n${conversationText}`,
        maxTokens: 1024,
        temperature: 0.5, // Lower temperature for more focused summaries
      });

      return result.text;
    } catch (error) {
      console.error('Failed to summarize messages:', error);
      // Fallback: Return simple message count
      return `Previous conversation: ${messages.length} messages exchanged.`;
    }
  }

  /**
   * Estimate token count for a message
   * Rough approximation: 1 token ≈ 4 characters
   * @param content - Message content
   * @returns Estimated token count
   */
  estimateTokenCount(content: string): number {
    // Rough approximation for English text
    return Math.ceil(content.length / 4);
  }

  /**
   * Check if conversation needs summarization
   * @param messages - Current conversation messages
   * @returns True if summarization is needed
   */
  needsSummarization(messages: Message[]): boolean {
    return this.enableSummarization && messages.length > this.maxRecentMessages;
  }

  /**
   * Get context window configuration
   * @returns Current context window settings
   */
  getConfig() {
    return {
      maxRecentMessages: this.maxRecentMessages,
      enableSummarization: this.enableSummarization,
    };
  }
}
