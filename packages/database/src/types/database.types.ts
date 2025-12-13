/**
 * Database Types
 *
 * Placeholder file for Supabase-generated types.
 * Run `pnpm --filter @erp/database generate-types` to regenerate.
 *
 * This placeholder provides the basic structure for development.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          subscription_plan: 'freemium' | 'premium';
          subscription_status: 'active' | 'trialing' | 'canceled' | 'past_due';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subscription_plan?: 'freemium' | 'premium';
          subscription_status?: 'active' | 'trialing' | 'canceled' | 'past_due';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          subscription_plan?: 'freemium' | 'premium';
          subscription_status?: 'active' | 'trialing' | 'canceled' | 'past_due';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          permissions: Json;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          permissions?: Json;
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          permissions?: Json;
          is_system?: boolean;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string | null;
          role_id: string | null;
          preferences: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          email: string;
          full_name?: string | null;
          role_id?: string | null;
          preferences?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          full_name?: string | null;
          role_id?: string | null;
          preferences?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_tenant_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_user_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      user_has_permission: {
        Args: {
          permission: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      subscription_plan: 'freemium' | 'premium';
      subscription_status: 'active' | 'trialing' | 'canceled' | 'past_due';
    };
  };
}
