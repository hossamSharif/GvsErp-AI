/**
 * Model Factory for AI Model Selection
 * Provides unified abstraction for selecting and instantiating AI models
 */

import { LanguageModel } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { AIModelConfig, ModelProvider } from '@erp-saas/shared';

/**
 * Factory class for creating and managing AI model instances
 */
export class ModelFactory {
  /**
   * Get model instance based on configuration
   * @param config - Model configuration (provider, model, optional params)
   * @returns LanguageModel instance from Vercel AI SDK
   * @throws Error if provider is unsupported
   */
  static getModel(config: AIModelConfig): LanguageModel {
    const { provider, model } = config;

    switch (provider) {
      case 'anthropic':
        return anthropic(model);
      case 'google':
        return google(model);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Get default model for user-facing responses
   * Uses environment variables AI_DEFAULT_PROVIDER and AI_DEFAULT_MODEL
   * Defaults to Claude Sonnet 4.5 if not configured
   * @returns LanguageModel instance
   */
  static getDefaultModel(): LanguageModel {
    const provider = (process.env.AI_DEFAULT_PROVIDER || 'anthropic') as ModelProvider;
    const model = process.env.AI_DEFAULT_MODEL || 'claude-sonnet-4-5';

    return this.getModel({ provider, model });
  }

  /**
   * Get fast/cheap model for summaries and background tasks
   * Uses environment variables AI_SUMMARY_PROVIDER and AI_SUMMARY_MODEL
   * Defaults to Claude Haiku 4 if not configured
   * @returns LanguageModel instance
   */
  static getSummaryModel(): LanguageModel {
    const provider = (process.env.AI_SUMMARY_PROVIDER || 'anthropic') as ModelProvider;
    const model = process.env.AI_SUMMARY_MODEL || 'claude-haiku-4';

    return this.getModel({ provider, model });
  }

  /**
   * Get model for vision/multimodal tasks (document processing)
   * Uses default model as all supported models have vision capabilities
   * @returns LanguageModel instance
   */
  static getVisionModel(): LanguageModel {
    // All supported models (Claude Sonnet/Opus/Haiku 4, Gemini 1.5/2.0) have vision
    return this.getDefaultModel();
  }

  /**
   * Select optimal model based on criteria
   * @param criteria - Selection criteria (vision, speed, cost, context size)
   * @returns Model configuration
   */
  static selectOptimalModel(criteria: {
    requiresVision?: boolean;
    requiresSpeed?: boolean;
    maxCost?: number;
    contextSize?: 'small' | 'medium' | 'large';
  }): AIModelConfig {
    // Vision required - use multimodal models only
    if (criteria.requiresVision) {
      if (criteria.requiresSpeed) {
        return { provider: 'google', model: 'gemini-2.0-flash-exp' };
      }
      return { provider: 'anthropic', model: 'claude-sonnet-4-5' };
    }

    // Speed priority - use fast models
    if (criteria.requiresSpeed) {
      if (criteria.maxCost && criteria.maxCost < 0.01) {
        return { provider: 'anthropic', model: 'claude-haiku-4' };
      }
      return { provider: 'google', model: 'gemini-2.0-flash-exp' };
    }

    // Large context - use Gemini Pro (2M tokens)
    if (criteria.contextSize === 'large') {
      return { provider: 'google', model: 'gemini-1.5-pro' };
    }

    // Default: balanced performance/cost
    return { provider: 'anthropic', model: 'claude-sonnet-4-5' };
  }

  /**
   * Get model name string for logging/tracking
   * @param model - LanguageModel instance
   * @returns Model identifier string
   */
  static getModelName(config: AIModelConfig): string {
    return `${config.provider}:${config.model}`;
  }
}
