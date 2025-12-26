/**
 * AI Document Service
 * Handles document upload, processing, and data extraction
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { AIDocumentRepository } from '../repositories/ai-document.repository';
import { AIUsageRepository } from '../repositories/ai-usage.repository';
import { AIAuditService } from './ai-audit.service';
import type { Document, ProcessingStatus } from '@erp-saas/shared';
import pdfParse from 'pdf-parse';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { startOfMonth } from 'date-fns';

type DocumentInsert = Database['public']['Tables']['ai_documents']['Insert'];

/**
 * Document upload options
 */
export interface DocumentUploadOptions {
  conversationId?: string;
  messageId?: string;
  tenantId: string;
  userId: string;
  userPermissions?: string[];
  file: Buffer;
  fileName: string;
  fileType: string;
  fileSize: number;
  subscriptionTier: 'free' | 'premium';
}

/**
 * Document processing result
 */
export interface DocumentProcessingResult {
  documentId: string;
  extractedText?: string;
  structuredData?: Record<string, any>;
  processingStatus: ProcessingStatus;
  error?: string;
}

/**
 * Service for AI document processing
 */
export class AIDocumentService {
  private documentRepository: AIDocumentRepository;
  private usageRepository: AIUsageRepository;
  private auditService: AIAuditService;
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
    this.documentRepository = new AIDocumentRepository(supabase);
    this.usageRepository = new AIUsageRepository(supabase);
    this.auditService = new AIAuditService();
  }

  /**
   * Upload a document for processing
   * Enforces tier limits and stores in Supabase Storage
   */
  async upload(options: DocumentUploadOptions): Promise<Document> {
    const {
      conversationId,
      messageId,
      tenantId,
      userId,
      file,
      fileName,
      fileType,
      fileSize,
      subscriptionTier,
    } = options;

    // Check tier limits
    await this.checkDocumentLimit(tenantId, userId, subscriptionTier);

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    if (!allowedTypes.includes(fileType)) {
      throw new Error(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (fileSize > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of 10MB`);
    }

    // Generate storage path
    const documentId = crypto.randomUUID();
    const extension = fileName.split('.').pop();
    const storagePath = `ai-documents/${tenantId}/${documentId}.${extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await this.supabase.storage
      .from('ai-documents')
      .upload(storagePath, file, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload document: ${uploadError.message}`);
    }

    // Create document record
    const documentData: DocumentInsert = {
      id: documentId,
      conversation_id: conversationId || null,
      message_id: messageId || null,
      tenant_id: tenantId,
      user_id: userId,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      storage_path: storagePath,
      processing_status: 'pending',
    };

    const document = await this.documentRepository.createDocument(documentData);

    // Track usage
    await this.usageRepository.createUsageRecord({
      tenant_id: tenantId,
      user_id: userId,
      action_type: 'document_upload',
      conversation_id: conversationId || null,
      metadata: {
        document_id: documentId,
        file_type: fileType,
        file_size: fileSize,
      },
    });

    // Audit log document upload
    await this.auditService.logDocumentUpload({
      tenantId,
      userId,
      conversationId,
      fileName,
      fileType,
      fileSize,
      processingStatus: 'pending',
      permissions: options.userPermissions,
    });

    // Start async processing
    this.processDocument(documentId, file, fileType, tenantId, userId, conversationId, options.userPermissions).catch((error) => {
      console.error(`Document processing failed for ${documentId}:`, error);
    });

    return document;
  }

  /**
   * Process a document with AI vision/extraction
   * @param documentId - Document ID
   * @param fileBuffer - File buffer
   * @param fileType - MIME type
   * @param tenantId - Tenant ID for audit logging
   * @param userId - User ID for audit logging
   * @param conversationId - Conversation ID for audit logging
   * @param userPermissions - User permissions for audit logging
   */
  async processDocument(
    documentId: string,
    fileBuffer: Buffer,
    fileType: string,
    tenantId?: string,
    userId?: string,
    conversationId?: string,
    userPermissions?: string[]
  ): Promise<DocumentProcessingResult> {
    try {
      // Update status to processing
      await this.documentRepository.updateProcessingStatus(
        documentId,
        'processing'
      );

      let extractedText = '';
      let structuredData: Record<string, any> | undefined;

      // Extract text based on file type
      if (fileType === 'application/pdf') {
        // PDF text extraction
        const pdfData = await pdfParse(fileBuffer);
        extractedText = pdfData.text;

        // Use AI to extract structured data from text
        structuredData = await this.extractStructuredDataFromText(
          extractedText
        );
      } else if (fileType.startsWith('image/')) {
        // Image processing with vision API
        const result = await this.processImageWithVision(fileBuffer, fileType);
        extractedText = result.extractedText;
        structuredData = result.structuredData;
      }

      // Update document with extracted data
      await this.documentRepository.updateProcessingStatus(
        documentId,
        'completed',
        extractedText
      );

      // Audit log successful processing
      if (tenantId && userId) {
        const doc = await this.documentRepository.findById(documentId);
        if (doc) {
          await this.auditService.logDocumentUpload({
            tenantId,
            userId,
            conversationId,
            fileName: doc.file_name,
            fileType: doc.file_type,
            fileSize: doc.file_size,
            processingStatus: 'completed',
            extractedDataSummary: structuredData ? {
              hasStructuredData: true,
              textLength: extractedText?.length || 0,
            } : undefined,
            permissions: userPermissions,
          });
        }
      }

      return {
        documentId,
        extractedText,
        structuredData,
        processingStatus: 'completed',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Document processing failed for ${documentId}:`, error);

      // Update document with error
      await this.documentRepository.updateProcessingStatus(
        documentId,
        'failed',
        undefined,
        errorMessage
      );

      return {
        documentId,
        processingStatus: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Process image with vision API
   * @param imageBuffer - Image buffer
   * @param mimeType - Image MIME type
   */
  private async processImageWithVision(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<{ extractedText: string; structuredData: Record<string, any> }> {
    const prompt = this.getExtractionPrompt();
    const provider = process.env.AI_DEFAULT_PROVIDER || 'anthropic';

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    try {
      let model;
      if (provider === 'anthropic') {
        model = anthropic('claude-3-5-sonnet-20241022');
      } else if (provider === 'google') {
        model = google('gemini-1.5-pro-latest');
      } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
      }

      const { text } = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: imageUrl },
            ],
          },
        ],
      });

      // Parse structured data from response
      const structuredData = this.parseStructuredData(text);

      return {
        extractedText: text,
        structuredData,
      };
    } catch (error) {
      console.error('Vision API processing failed:', error);
      throw new Error(
        `Vision API failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract structured data from text using AI
   * @param text - Extracted text
   */
  private async extractStructuredDataFromText(
    text: string
  ): Promise<Record<string, any>> {
    const prompt = this.getExtractionPrompt();
    const provider = process.env.AI_DEFAULT_PROVIDER || 'anthropic';

    try {
      let model;
      if (provider === 'anthropic') {
        model = anthropic('claude-3-5-sonnet-20241022');
      } else if (provider === 'google') {
        model = google('gemini-1.5-pro-latest');
      } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
      }

      const { text: aiResponse } = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nDocument text:\n${text}`,
          },
        ],
      });

      return this.parseStructuredData(aiResponse);
    } catch (error) {
      console.error('Text extraction failed:', error);
      return {};
    }
  }

  /**
   * Get document by ID
   * @param documentId - Document ID
   */
  async get(documentId: string): Promise<Document | null> {
    const { data, error } = await this.supabase
      .from('ai_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as Document;
  }

  /**
   * Get extraction prompt for AI
   * Instructs AI to extract structured data from documents
   */
  getExtractionPrompt(): string {
    return `You are an expert data extraction assistant for an ERP system. Extract structured data from the provided document.

IMPORTANT: This system supports multiple languages including English and Arabic (العربية). Extract text in its original language and detect:
- If the document is in Arabic, extract Arabic text as-is (e.g., names, items, descriptions in Arabic)
- If the document is in English, extract English text
- Preserve the original language in the extracted data
- For dates: convert to ISO format (YYYY-MM-DD) regardless of source language
- For numbers: use standard decimal notation (123.45)

Identify the document type (invoice, receipt, price list, purchase order, etc.) and extract relevant fields:

For INVOICES/RECEIPTS:
- Vendor/Supplier name (preserve original language)
- Invoice number
- Date (convert to YYYY-MM-DD format)
- Line items (item name in original language, quantity, unit price, total)
- Subtotal, tax, total amount
- Payment terms

For PRICE LISTS:
- Items/products with prices (preserve original language)
- Category/description
- Unit of measure
- Any applicable discounts

For PURCHASE ORDERS:
- PO number
- Vendor (preserve original language)
- Date (convert to YYYY-MM-DD format)
- Items ordered (name in original language, quantity, unit price)
- Total amount
- Delivery address

Return the data in JSON format with clear field names. If certain fields are not present, omit them or set to null.

Example response format (English):
{
  "document_type": "invoice",
  "language": "en",
  "vendor_name": "ABC Suppliers",
  "invoice_number": "INV-2024-001",
  "date": "2024-01-15",
  "line_items": [
    {
      "item_name": "Product A",
      "quantity": 10,
      "unit_price": 25.00,
      "total": 250.00
    }
  ],
  "subtotal": 250.00,
  "tax": 25.00,
  "total_amount": 275.00
}

Example response format (Arabic):
{
  "document_type": "invoice",
  "language": "ar",
  "vendor_name": "مورد الشرق",
  "invoice_number": "INV-2024-001",
  "date": "2024-01-15",
  "line_items": [
    {
      "item_name": "منتج أ",
      "quantity": 10,
      "unit_price": 25.00,
      "total": 250.00
    }
  ],
  "subtotal": 250.00,
  "tax": 25.00,
  "total_amount": 275.00
}`;
  }

  /**
   * Parse structured data from AI response
   * @param aiResponse - AI response text
   */
  private parseStructuredData(aiResponse: string): Record<string, any> {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.error('Failed to parse structured data:', error);
      return {};
    }
  }

  /**
   * Check if user has exceeded document upload limit
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param subscriptionTier - Subscription tier
   */
  private async checkDocumentLimit(
    tenantId: string,
    userId: string,
    subscriptionTier: 'free' | 'premium'
  ): Promise<void> {
    const monthStart = startOfMonth(new Date()).toISOString();
    const documentCount =
      await this.documentRepository.getDocumentCountByUser(
        tenantId,
        userId,
        monthStart
      );

    const limit = subscriptionTier === 'free' ? 3 : 100;

    if (documentCount >= limit) {
      throw new Error(
        `Monthly document limit reached (${documentCount}/${limit} for ${subscriptionTier} tier)`
      );
    }
  }

  /**
   * Get documents by conversation
   * @param conversationId - Conversation ID
   */
  async getDocumentsByConversation(
    conversationId: string
  ): Promise<Document[]> {
    return this.documentRepository.getDocumentsByConversation(conversationId);
  }

  /**
   * Delete document
   * @param tenantId - Tenant ID
   * @param documentId - Document ID
   */
  async delete(tenantId: string, documentId: string): Promise<void> {
    // Get document to find storage path
    const document = await this.get(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from('ai-documents')
      .remove([document.storage_path]);

    if (storageError) {
      console.error('Failed to delete from storage:', storageError);
    }

    // Delete record
    await this.documentRepository.deleteDocument(tenantId, documentId);
  }
}
