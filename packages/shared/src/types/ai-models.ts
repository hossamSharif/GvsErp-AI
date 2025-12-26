/**
 * AI Model configuration and provider types
 * @module types/ai-models
 */

// =============================================================================
// MODEL PROVIDERS
// =============================================================================

/**
 * Supported AI model providers
 */
export type ModelProvider = 'anthropic' | 'google';

/**
 * Anthropic models
 */
export type AnthropicModel =
  | 'claude-opus-4-5'
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4';

/**
 * Google models
 */
export type GoogleModel = 'gemini-2.0-flash-exp' | 'gemini-1.5-pro' | 'gemini-1.5-flash';

/**
 * All supported models
 */
export type AIModel = AnthropicModel | GoogleModel;

// =============================================================================
// MODEL CONFIGURATION
// =============================================================================

/**
 * AI Model configuration
 */
export interface AIModelConfig {
  provider: ModelProvider;
  model: AIModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/**
 * Model configuration for different use cases
 */
export interface ModelConfigurations {
  default: AIModelConfig;
  summary: AIModelConfig;
  vision?: AIModelConfig; // For document processing
}

// =============================================================================
// MODEL CAPABILITIES
// =============================================================================

/**
 * Model capabilities flags
 */
export interface ModelCapabilities {
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
  maxContextWindow: number;
  maxOutputTokens: number;
}

/**
 * Model pricing information (per 1M tokens)
 */
export interface ModelPricing {
  inputCostPerMillion: number; // USD per 1M input tokens
  outputCostPerMillion: number; // USD per 1M output tokens
}

// =============================================================================
// MODEL REGISTRY
// =============================================================================

/**
 * Model registry entry
 */
export interface ModelRegistryEntry {
  provider: ModelProvider;
  model: AIModel;
  displayName: string;
  description: string;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  isDefault?: boolean;
  isDeprecated?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default model configurations
 */
export const DEFAULT_MODEL_CONFIGS: ModelConfigurations = {
  default: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0.7,
    maxTokens: 4096,
  },
  summary: {
    provider: 'anthropic',
    model: 'claude-haiku-4',
    temperature: 0.5,
    maxTokens: 1024,
  },
  vision: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    temperature: 0.3,
    maxTokens: 2048,
  },
};

/**
 * Model registry with capabilities and pricing
 */
export const MODEL_REGISTRY: Record<AIModel, ModelRegistryEntry> = {
  'claude-opus-4-5': {
    provider: 'anthropic',
    model: 'claude-opus-4-5',
    displayName: 'Claude Opus 4.5',
    description: 'Most capable model for complex reasoning and analysis',
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextWindow: 200000,
      maxOutputTokens: 16384,
    },
    pricing: {
      inputCostPerMillion: 15,
      outputCostPerMillion: 75,
    },
  },
  'claude-sonnet-4-5': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    description: 'Balanced performance and speed for general tasks',
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextWindow: 200000,
      maxOutputTokens: 8192,
    },
    pricing: {
      inputCostPerMillion: 3,
      outputCostPerMillion: 15,
    },
    isDefault: true,
  },
  'claude-haiku-4': {
    provider: 'anthropic',
    model: 'claude-haiku-4',
    displayName: 'Claude Haiku 4',
    description: 'Fast and efficient for simple tasks and summaries',
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextWindow: 200000,
      maxOutputTokens: 4096,
    },
    pricing: {
      inputCostPerMillion: 0.8,
      outputCostPerMillion: 4,
    },
  },
  'gemini-2.0-flash-exp': {
    provider: 'google',
    model: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash (Experimental)',
    description: 'Experimental fast model with multimodal capabilities',
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextWindow: 1000000,
      maxOutputTokens: 8192,
    },
    pricing: {
      inputCostPerMillion: 0.1,
      outputCostPerMillion: 0.4,
    },
  },
  'gemini-1.5-pro': {
    provider: 'google',
    model: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Advanced reasoning with long context support',
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextWindow: 2000000,
      maxOutputTokens: 8192,
    },
    pricing: {
      inputCostPerMillion: 1.25,
      outputCostPerMillion: 5,
    },
  },
  'gemini-1.5-flash': {
    provider: 'google',
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: 'Fast and efficient for high-volume tasks',
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxContextWindow: 1000000,
      maxOutputTokens: 8192,
    },
    pricing: {
      inputCostPerMillion: 0.15,
      outputCostPerMillion: 0.6,
    },
  },
};

// =============================================================================
// HELPER TYPES
// =============================================================================

/**
 * Model selection criteria
 */
export interface ModelSelectionCriteria {
  requireVision?: boolean;
  requireStreaming?: boolean;
  requireFunctionCalling?: boolean;
  maxCostPerMillion?: number;
  preferredProvider?: ModelProvider;
}

/**
 * Token usage metadata
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Model response metadata
 */
export interface ModelResponseMetadata {
  model: AIModel;
  provider: ModelProvider;
  usage: TokenUsage;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
  latencyMs?: number;
}
