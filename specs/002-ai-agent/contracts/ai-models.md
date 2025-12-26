# AI Model Integration Contract

**Feature**: AI Agent Assistant
**Date**: 2025-12-26
**Phase**: 1 - Design

## Overview

This document defines the contract for integrating AI model providers (Anthropic Claude, Google Gemini) via the Vercel AI SDK. It specifies the unified abstraction layer, model selection logic, and provider-specific configurations.

## Model Provider Abstraction

### Unified Interface

All AI operations use the Vercel AI SDK's unified interface:

```typescript
import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// Type definition for model provider
type ModelProvider = 'anthropic' | 'google';

interface AIModelConfig {
  provider: ModelProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}
```

### Model Selection Factory

```typescript
// apps/api/src/lib/ai-models/model-factory.ts

import { LanguageModel } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export class ModelFactory {
  /**
   * Get model instance based on configuration
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
   */
  static getDefaultModel(): LanguageModel {
    const provider = process.env.AI_DEFAULT_PROVIDER || 'anthropic';
    const model = process.env.AI_DEFAULT_MODEL || 'claude-sonnet-4-5';

    return this.getModel({ provider: provider as ModelProvider, model });
  }

  /**
   * Get fast/cheap model for summaries and background tasks
   */
  static getSummaryModel(): LanguageModel {
    const provider = process.env.AI_SUMMARY_PROVIDER || 'anthropic';
    const model = process.env.AI_SUMMARY_MODEL || 'claude-haiku-4';

    return this.getModel({ provider: provider as ModelProvider, model });
  }
}
```

## Supported Models

### Anthropic Claude

**Models Available**:
- `claude-sonnet-4-5`: Best balance (200K context, vision, tool use)
- `claude-opus-4-5`: Most capable (200K context, best reasoning)
- `claude-haiku-4`: Fastest/cheapest (200K context, summaries)

**Features**:
- Vision/multimodal support (all models)
- 200,000 token context window
- Tool/function calling
- Streaming responses

**Pricing** (per 1M tokens):
- Haiku: $0.25 input / $1.25 output
- Sonnet: $3 input / $15 output
- Opus: $15 input / $75 output

**Configuration**:
```typescript
const claudeModel = anthropic('claude-sonnet-4-5', {
  // Optional overrides
  cacheControl: true,  // Enable prompt caching
});
```

### Google Gemini

**Models Available**:
- `gemini-2.0-flash`: Fast multimodal model (1M context, vision)
- `gemini-1.5-pro`: Most capable (2M context, vision, best reasoning)
- `gemini-1.5-flash`: Balanced (1M context, vision)

**Features**:
- Vision/multimodal support (all models)
- Up to 2M token context window (Pro)
- Tool/function calling
- Streaming responses

**Pricing** (per 1M tokens):
- Flash: $0.075 input / $0.30 output
- Pro: $1.25 input / $5 output

**Configuration**:
```typescript
const geminiModel = google('gemini-2.0-flash', {
  // Optional overrides
  safetySettings: [
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_ONLY_HIGH'
    }
  ]
});
```

## Message Format Contract

### Input Message Structure

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MultimodalContent[];
}

type MultimodalContent =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string | URL }; // base64 or URL

// Example: Text-only message
const textMessage: ChatMessage = {
  role: 'user',
  content: 'What were my sales last month?'
};

// Example: Multimodal message with image
const multimodalMessage: ChatMessage = {
  role: 'user',
  content: [
    { type: 'text', text: 'Extract invoice data from this document:' },
    { type: 'image', image: 'data:image/png;base64,iVBORw0KGgoAAAANS...' }
  ]
};
```

### System Prompts

```typescript
interface SystemPrompt {
  role: 'system';
  content: string;
}

/**
 * Base system prompt for all AI interactions
 */
const BASE_SYSTEM_PROMPT = `You are an AI assistant for an ERP (Enterprise Resource Planning) system.

CRITICAL RULES:
1. You can ONLY answer questions about the user's business data within this ERP system.
2. NEVER answer general knowledge questions, current events, or topics outside the user's business data.
3. If asked about external topics, politely decline and remind the user you only have access to their ERP data.
4. Always respect user permissions - only provide information they have access to.
5. When creating transactions (invoices, orders, etc.), navigate to the form page, pre-fill it with your generated data, and ask the user to review and confirm.

AVAILABLE DATA:
- Sales invoices and purchase orders
- Inventory items and stock levels
- Customers and suppliers (parties)
- Payments and accounting data
- HR data (employees, attendance, payroll)
- Warehouse transfers and inventory movements

USER CONTEXT:
- Tenant: {tenant_name}
- User: {user_name}
- Permissions: {permissions}
- Language: {locale}
- Currency: {base_currency}
`;

/**
 * Role-specific prompt extensions
 */
const ROLE_PROMPTS: Record<ConsultantRole, string> = {
  general: '',
  marketing: `
You are operating in MARKETING CONSULTANT mode. Focus your responses on:
- Sales trends and customer behavior
- Product performance analysis
- Customer segmentation insights
- Marketing campaign effectiveness (based on sales data)
- Revenue optimization strategies
`,
  legal: `
You are operating in LEGAL CONSULTANT mode. Focus your responses on:
- Compliance with accounting standards
- Contract terms in sales/purchase orders
- Tax implications of transactions
- Audit trail and documentation
IMPORTANT: You are NOT a licensed attorney. Always recommend consulting a legal professional for legal advice.
`,
  customer_service: `
You are operating in CUSTOMER SERVICE mode. Focus your responses on:
- Customer order status and history
- Outstanding balances and payment tracking
- Product availability and delivery
- Customer satisfaction metrics (order fulfillment, returns)
`,
  financial_analyst: `
You are operating in FINANCIAL ANALYST mode. Focus your responses on:
- Financial ratios and KPIs
- Profitability analysis
- Cash flow insights
- Budget vs actual comparisons
- Financial forecasting (based on historical data)
`
};
```

## Response Format Contract

### Streaming Response

```typescript
import { streamText } from 'ai';

interface StreamingResponse {
  textStream: AsyncIterable<string>;
  fullStream: AsyncIterable<StreamEvent>;
  usage: Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;
}

type StreamEvent =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'finish'; finishReason: string; usage: TokenUsage };

// Example usage
async function streamAIResponse(messages: ChatMessage[]) {
  const result = await streamText({
    model: ModelFactory.getDefaultModel(),
    messages,
    system: buildSystemPrompt(user),
  });

  // Stream to client via SSE
  for await (const chunk of result.textStream) {
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
  }

  // Get final usage stats
  const usage = await result.usage;
  res.write(`data: ${JSON.stringify({ type: 'done', usage })}\n\n`);
}
```

### Non-Streaming Response

```typescript
import { generateText } from 'ai';

interface GenerateResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content-filter';
}

// Example usage
async function getAIResponse(messages: ChatMessage[]) {
  const result = await generateText({
    model: ModelFactory.getDefaultModel(),
    messages,
    system: buildSystemPrompt(user),
    maxTokens: 4096,
    temperature: 0.7,
  });

  return {
    text: result.text,
    tokens: result.usage.totalTokens,
    model: result.model
  };
}
```

## Vision/Multimodal Contract

### Document Processing Flow

```typescript
interface DocumentProcessingRequest {
  documentId: string;
  extractionType: 'invoice' | 'receipt' | 'price_list' | 'general';
}

interface DocumentProcessingResponse {
  extractedText: string;
  structuredData?: object;  // Depends on extraction type
  confidence: number;  // 0-1
}

async function processDocument(
  file: Buffer,
  mimeType: string,
  extractionType: string
): Promise<DocumentProcessingResponse> {
  const base64 = file.toString('base64');

  const prompt = getExtractionPrompt(extractionType);

  const result = await generateText({
    model: ModelFactory.getDefaultModel(),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image', image: `data:${mimeType};base64,${base64}` }
      ]
    }]
  });

  return parseExtractionResponse(result.text);
}

function getExtractionPrompt(type: string): string {
  const prompts = {
    invoice: `Extract the following data from this invoice:
- Supplier/Vendor name
- Invoice number
- Date
- Line items (description, quantity, unit price, total)
- Subtotal, tax, total amount
- Payment terms

Return as valid JSON.`,

    receipt: `Extract the following from this receipt:
- Vendor name
- Date
- Items purchased
- Total amount
- Payment method (if visible)

Return as valid JSON.`,

    price_list: `Extract all items and prices from this price list.
Return as JSON array: [{ name, price, unit, description }]`,

    general: `Analyze this document and extract all relevant business data.
Return a structured JSON representation.`
  };

  return prompts[type] || prompts.general;
}
```

## Error Handling Contract

### Error Types

```typescript
enum AIErrorCode {
  // Provider errors
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  PROVIDER_RATE_LIMITED = 'PROVIDER_RATE_LIMITED',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Content errors
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',

  // Application errors
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_REQUEST = 'INVALID_REQUEST',
}

class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public retryable: boolean = false,
    public retryAfter?: number  // Seconds
  ) {
    super(message);
    this.name = 'AIError';
  }
}
```

### Retry Logic

```typescript
interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;  // ms
  maxDelay: number;      // ms
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (error instanceof AIError && !error.retryable) {
        throw error;
      }

      if (attempt < config.maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }

  throw new AIError(
    AIErrorCode.PROVIDER_UNAVAILABLE,
    `Failed after ${config.maxAttempts} attempts: ${lastError.message}`,
    false
  );
}
```

## Token Counting and Cost Estimation

```typescript
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface CostEstimate {
  inputCost: number;   // USD
  outputCost: number;  // USD
  totalCost: number;   // USD
}

/**
 * Calculate cost based on model and token usage
 */
function estimateCost(
  model: string,
  usage: TokenUsage
): CostEstimate {
  // Pricing per 1M tokens (in USD)
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-haiku-4': { input: 0.25, output: 1.25 },
    'claude-sonnet-4-5': { input: 3, output: 15 },
    'claude-opus-4-5': { input: 15, output: 75 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.0-flash': { input: 0.075, output: 0.30 },
    'gemini-1.5-pro': { input: 1.25, output: 5 },
  };

  const modelPricing = pricing[model] || { input: 0, output: 0 };

  const inputCost = (usage.promptTokens / 1_000_000) * modelPricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * modelPricing.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost
  };
}
```

## Environment Variables

Required environment variables for model integration:

```bash
# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-api03-...

# Google Configuration
GOOGLE_API_KEY=AIzaSy...

# Model Selection (optional, defaults shown)
AI_DEFAULT_PROVIDER=anthropic  # or 'google'
AI_DEFAULT_MODEL=claude-sonnet-4-5
AI_SUMMARY_PROVIDER=anthropic
AI_SUMMARY_MODEL=claude-haiku-4

# Feature Flags
AI_ENABLE_VISION=true
AI_ENABLE_STREAMING=true
AI_MAX_CONTEXT_MESSAGES=50  # For sliding window
```

## Model Switching Strategy

### Runtime Model Selection

```typescript
interface ModelSelectionCriteria {
  requiresVision: boolean;
  requiresSpeed: boolean;
  maxCost: number;  // USD per request
  contextSize: 'small' | 'medium' | 'large';
}

function selectOptimalModel(
  criteria: ModelSelectionCriteria
): AIModelConfig {
  // Vision required - use multimodal models only
  if (criteria.requiresVision) {
    if (criteria.requiresSpeed) {
      return { provider: 'google', model: 'gemini-2.0-flash' };
    }
    return { provider: 'anthropic', model: 'claude-sonnet-4-5' };
  }

  // Speed priority - use fast models
  if (criteria.requiresSpeed) {
    if (criteria.maxCost < 0.01) {
      return { provider: 'anthropic', model: 'claude-haiku-4' };
    }
    return { provider: 'google', model: 'gemini-2.0-flash' };
  }

  // Large context - use Gemini Pro (2M tokens)
  if (criteria.contextSize === 'large') {
    return { provider: 'google', model: 'gemini-1.5-pro' };
  }

  // Default: balanced performance/cost
  return { provider: 'anthropic', model: 'claude-sonnet-4-5' };
}
```

## Testing Contract

### Mock Model for Testing

```typescript
// apps/api/tests/mocks/mock-ai-model.ts

export class MockAIModel {
  async generateText(params: any) {
    return {
      text: `Mock response for: ${params.messages[0].content}`,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      },
      finishReason: 'stop'
    };
  }

  async streamText(params: any) {
    async function* mockStream() {
      const words = ['Mock', 'streaming', 'response'];
      for (const word of words) {
        yield word + ' ';
        await sleep(10);
      }
    }

    return {
      textStream: mockStream(),
      usage: Promise.resolve({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      })
    };
  }
}
```

## Migration Path

### Phase 1: Anthropic Claude Only
- Start with Claude Sonnet 4.5 for all responses
- Claude Haiku 4 for summaries
- Simplifies initial implementation

### Phase 2: Add Google Gemini
- Implement ModelFactory with provider selection
- Add Gemini as alternative for cost optimization
- Allow tenant-specific provider preference

### Future: Multi-Model Routing
- Route different query types to optimal models
- Cost-based auto-selection
- A/B testing for model comparison

## Compliance and Safety

### Content Filtering

Both providers have built-in safety filters:
- Anthropic: Automatic content policy enforcement
- Google: Configurable safety settings

```typescript
// For sensitive business data, use conservative settings
const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
];
```

### Data Privacy

- Never send user passwords, API keys, or payment card details to AI models
- Sanitize data before sending (remove PII if not needed)
- Audit all prompts and responses (FR-007)
- Comply with tenant data residency requirements

## Summary

This contract establishes:
1. Unified abstraction via Vercel AI SDK
2. Support for Anthropic Claude and Google Gemini
3. Streaming and non-streaming response handling
4. Vision/multimodal document processing
5. Error handling and retry logic
6. Token usage tracking and cost estimation
7. Testing strategy with mocks
8. Migration path from single to multi-provider

All implementation code MUST adhere to this contract to ensure consistency, testability, and maintainability.
