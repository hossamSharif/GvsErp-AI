import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service for comprehensive audit logging of all AI interactions
 * Implements FR-007 audit trail requirements
 */
export class AIAuditService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Log user interaction with AI (questions, responses)
   */
  async logInteraction(params: {
    tenantId: string;
    userId: string;
    conversationId?: string;
    prompt?: string;
    response?: string;
    dataAccessed?: Record<string, any>;
    permissions?: string[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabase.from("ai_audit_logs").insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        conversation_id: params.conversationId,
        action: "ask_question",
        prompt: params.prompt,
        response: this.truncateResponse(params.response),
        data_accessed: params.dataAccessed,
        permissions: params.permissions,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });

      if (error) {
        console.error("Failed to log AI interaction:", error);
        // Don't throw - audit logging should not break the main flow
      }
    } catch (err) {
      console.error("Unexpected error in logInteraction:", err);
    }
  }

  /**
   * Log task execution (invoice creation, order generation, etc.)
   */
  async logTaskExecution(params: {
    tenantId: string;
    userId: string;
    conversationId?: string;
    taskType: string;
    taskData: Record<string, any>;
    approvalStatus: string;
    resultId?: string;
    permissions?: string[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabase.from("ai_audit_logs").insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        conversation_id: params.conversationId,
        action: `execute_task_${params.taskType}`,
        prompt: JSON.stringify({
          task_type: params.taskType,
          approval_status: params.approvalStatus,
        }),
        response: params.resultId
          ? `Task executed successfully. Result ID: ${params.resultId}`
          : "Task execution pending approval",
        data_accessed: {
          task_data: this.sanitizeTaskData(params.taskData),
        },
        permissions: params.permissions,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });

      if (error) {
        console.error("Failed to log task execution:", error);
      }
    } catch (err) {
      console.error("Unexpected error in logTaskExecution:", err);
    }
  }

  /**
   * Log permission denial (user attempted action without proper permissions)
   */
  async logPermissionDenial(params: {
    tenantId: string;
    userId: string;
    conversationId?: string;
    attemptedAction: string;
    requiredPermissions: string[];
    userPermissions: string[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabase.from("ai_audit_logs").insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        conversation_id: params.conversationId,
        action: "permission_denied",
        prompt: `Attempted: ${params.attemptedAction}`,
        response: `Access denied. Required: ${params.requiredPermissions.join(", ")}`,
        data_accessed: {
          attempted_action: params.attemptedAction,
          required_permissions: params.requiredPermissions,
        },
        permissions: params.userPermissions,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });

      if (error) {
        console.error("Failed to log permission denial:", error);
      }
    } catch (err) {
      console.error("Unexpected error in logPermissionDenial:", err);
    }
  }

  /**
   * Log document upload and processing
   */
  async logDocumentUpload(params: {
    tenantId: string;
    userId: string;
    conversationId?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    processingStatus: string;
    extractedDataSummary?: Record<string, any>;
    permissions?: string[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabase.from("ai_audit_logs").insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        conversation_id: params.conversationId,
        action: "upload_document",
        prompt: `File: ${params.fileName} (${params.fileType}, ${params.fileSize} bytes)`,
        response: `Processing status: ${params.processingStatus}`,
        data_accessed: params.extractedDataSummary
          ? {
              extracted_data_summary: params.extractedDataSummary,
            }
          : null,
        permissions: params.permissions,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });

      if (error) {
        console.error("Failed to log document upload:", error);
      }
    } catch (err) {
      console.error("Unexpected error in logDocumentUpload:", err);
    }
  }

  /**
   * Log configuration changes
   */
  async logConfigChange(params: {
    tenantId: string;
    userId: string;
    configKey: string;
    oldValue?: Record<string, any>;
    newValue: Record<string, any>;
    permissions?: string[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabase.from("ai_audit_logs").insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        action: "config_change",
        prompt: `Config key: ${params.configKey}`,
        response: JSON.stringify({
          old_value: params.oldValue,
          new_value: params.newValue,
        }),
        data_accessed: {
          config_key: params.configKey,
        },
        permissions: params.permissions,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      });

      if (error) {
        console.error("Failed to log config change:", error);
      }
    } catch (err) {
      console.error("Unexpected error in logConfigChange:", err);
    }
  }

  /**
   * Truncate response to max 10,000 characters as per data-model.md
   */
  private truncateResponse(response?: string): string | undefined {
    if (!response) return undefined;
    if (response.length <= 10000) return response;
    return response.substring(0, 9997) + "...";
  }

  /**
   * Sanitize task data to remove sensitive information
   * Implements FR-008 data sanitization
   */
  private sanitizeTaskData(taskData: Record<string, any>): Record<string, any> {
    const sanitized = { ...taskData };

    // Remove sensitive fields
    const sensitiveFields = [
      "password",
      "api_key",
      "secret",
      "token",
      "credit_card",
      "cvv",
      "ssn",
      "tax_id",
    ];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some((field) =>
          lowerKey.includes(field)
        );

        if (isSensitive) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = sanitizeObject(value);
        }
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Query audit logs for admin dashboard
   */
  async getAuditLogs(params: {
    tenantId: string;
    userId?: string;
    conversationId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      let query = this.supabase
        .from("ai_audit_logs")
        .select("*")
        .eq("tenant_id", params.tenantId)
        .order("created_at", { ascending: false });

      if (params.userId) {
        query = query.eq("user_id", params.userId);
      }

      if (params.conversationId) {
        query = query.eq("conversation_id", params.conversationId);
      }

      if (params.action) {
        query = query.eq("action", params.action);
      }

      if (params.startDate) {
        query = query.gte("created_at", params.startDate.toISOString());
      }

      if (params.endDate) {
        query = query.lte("created_at", params.endDate.toISOString());
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch audit logs:", error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error("Unexpected error in getAuditLogs:", err);
      return [];
    }
  }
}
