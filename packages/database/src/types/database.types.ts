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
      items: {
        Row: {
          id: string; tenant_id: string; name: string; name_alias: string | null;
          sku: string | null; barcode: string | null; brand: string | null;
          category_id: string | null; unit_of_measure: string; tax_rate: number;
          images: string[]; is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; name: string; name_alias?: string | null;
          sku?: string | null; barcode?: string | null; brand?: string | null;
          category_id?: string | null; unit_of_measure: string; tax_rate?: number;
          images?: string[]; is_active?: boolean; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; name?: string; name_alias?: string | null;
          sku?: string | null; barcode?: string | null; brand?: string | null;
          category_id?: string | null; unit_of_measure?: string; tax_rate?: number;
          images?: string[]; is_active?: boolean; created_at?: string; updated_at?: string;
        };
      };
      categories: {
        Row: { id: string; tenant_id: string; name: string; parent_id: string | null; created_at: string; };
        Insert: { id?: string; tenant_id: string; name: string; parent_id?: string | null; created_at?: string; };
        Update: { id?: string; tenant_id?: string; name?: string; parent_id?: string | null; created_at?: string; };
      };
      item_prices: {
        Row: {
          id: string; tenant_id: string; item_id: string; price_tier: string;
          price: number; currency: string; effective_from: string | null;
          effective_to: string | null; created_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; item_id: string; price_tier: string;
          price: number; currency: string; effective_from?: string | null;
          effective_to?: string | null; created_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; item_id?: string; price_tier?: string;
          price?: number; currency?: string; effective_from?: string | null;
          effective_to?: string | null; created_at?: string;
        };
      };
      item_packagings: {
        Row: { id: string; tenant_id: string; item_id: string; name: string; quantity: number; barcode: string | null; created_at: string; };
        Insert: { id?: string; tenant_id: string; item_id: string; name: string; quantity: number; barcode?: string | null; created_at?: string; };
        Update: { id?: string; tenant_id?: string; item_id?: string; name?: string; quantity?: number; barcode?: string | null; created_at?: string; };
      };
      invoices: {
        Row: {
          id: string; tenant_id: string; invoice_number: string;
          type: 'sale' | 'purchase'; status: 'draft' | 'final' | 'returned' | 'canceled';
          party_id: string | null; warehouse_id: string; subtotal: number;
          tax_amount: number; discount_amount: number; total: number;
          currency: string; exchange_rate: number; notes: string | null;
          created_by: string | null; returned_from_id: string | null;
          created_at: string; updated_at: string; finalized_at: string | null;
        };
        Insert: {
          id?: string; tenant_id: string; invoice_number: string;
          type: 'sale' | 'purchase'; status?: 'draft' | 'final' | 'returned' | 'canceled';
          party_id?: string | null; warehouse_id: string; subtotal?: number;
          tax_amount?: number; discount_amount?: number; total?: number;
          currency?: string; exchange_rate?: number; notes?: string | null;
          created_by?: string | null; returned_from_id?: string | null;
          created_at?: string; updated_at?: string; finalized_at?: string | null;
        };
        Update: {
          id?: string; tenant_id?: string; invoice_number?: string;
          type?: 'sale' | 'purchase'; status?: 'draft' | 'final' | 'returned' | 'canceled';
          party_id?: string | null; warehouse_id?: string; subtotal?: number;
          tax_amount?: number; discount_amount?: number; total?: number;
          currency?: string; exchange_rate?: number; notes?: string | null;
          created_by?: string | null; returned_from_id?: string | null;
          created_at?: string; updated_at?: string; finalized_at?: string | null;
        };
      };
      invoice_items: {
        Row: {
          id: string; tenant_id: string; invoice_id: string; item_id: string;
          description: string | null; quantity: number; unit_price: number;
          discount_percent: number; tax_rate: number; line_total: number;
          sort_order: number; created_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; invoice_id: string; item_id: string;
          description?: string | null; quantity: number; unit_price: number;
          discount_percent?: number; tax_rate?: number; line_total?: number;
          sort_order?: number; created_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; invoice_id?: string; item_id?: string;
          description?: string | null; quantity?: number; unit_price?: number;
          discount_percent?: number; tax_rate?: number; line_total?: number;
          sort_order?: number; created_at?: string;
        };
      };
      parties: {
        Row: {
          id: string; tenant_id: string; type: 'customer' | 'supplier'; name: string;
          email: string | null; phone: string | null; address: string | null;
          tax_number: string | null; balance: number; is_active: boolean;
          notes: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; type: 'customer' | 'supplier'; name: string;
          email?: string | null; phone?: string | null; address?: string | null;
          tax_number?: string | null; balance?: number; is_active?: boolean;
          notes?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; type?: 'customer' | 'supplier'; name?: string;
          email?: string | null; phone?: string | null; address?: string | null;
          tax_number?: string | null; balance?: number; is_active?: boolean;
          notes?: string | null; created_at?: string; updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string; tenant_id: string; party_id: string; type: 'received' | 'made';
          amount: number; currency: string; exchange_rate: number;
          payment_method: string | null; reference: string | null;
          invoice_id: string | null; notes: string | null; payment_date: string;
          created_by: string | null; created_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; party_id: string; type: 'received' | 'made';
          amount: number; currency?: string; exchange_rate?: number;
          payment_method?: string | null; reference?: string | null;
          invoice_id?: string | null; notes?: string | null; payment_date: string;
          created_by?: string | null; created_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; party_id?: string; type?: 'received' | 'made';
          amount?: number; currency?: string; exchange_rate?: number;
          payment_method?: string | null; reference?: string | null;
          invoice_id?: string | null; notes?: string | null; payment_date?: string;
          created_by?: string | null; created_at?: string;
        };
      };
      warehouses: {
        Row: { id: string; tenant_id: string; name: string; address: string | null; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; tenant_id: string; name: string; address?: string | null; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; tenant_id?: string; name?: string; address?: string | null; is_active?: boolean; created_at?: string; updated_at?: string; };
      };
      inventory: {
        Row: { id: string; tenant_id: string; item_id: string; warehouse_id: string; quantity: number; reserved_quantity: number; low_stock_threshold: number | null; updated_at: string; };
        Insert: { id?: string; tenant_id: string; item_id: string; warehouse_id: string; quantity?: number; reserved_quantity?: number; low_stock_threshold?: number | null; updated_at?: string; };
        Update: { id?: string; tenant_id?: string; item_id?: string; warehouse_id?: string; quantity?: number; reserved_quantity?: number; low_stock_threshold?: number | null; updated_at?: string; };
      };
      transfers: {
        Row: {
          id: string; tenant_id: string; transfer_number: string;
          from_warehouse_id: string; to_warehouse_id: string;
          status: 'pending' | 'in_transit' | 'completed' | 'canceled';
          notes: string | null; created_by: string | null;
          created_at: string; updated_at: string; completed_at: string | null;
        };
        Insert: {
          id?: string; tenant_id: string; transfer_number: string;
          from_warehouse_id: string; to_warehouse_id: string;
          status?: 'pending' | 'in_transit' | 'completed' | 'canceled';
          notes?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string; completed_at?: string | null;
        };
        Update: {
          id?: string; tenant_id?: string; transfer_number?: string;
          from_warehouse_id?: string; to_warehouse_id?: string;
          status?: 'pending' | 'in_transit' | 'completed' | 'canceled';
          notes?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string; completed_at?: string | null;
        };
      };
      transfer_items: {
        Row: { id: string; tenant_id: string; transfer_id: string; item_id: string; quantity: number; created_at: string; };
        Insert: { id?: string; tenant_id: string; transfer_id: string; item_id: string; quantity: number; created_at?: string; };
        Update: { id?: string; tenant_id?: string; transfer_id?: string; item_id?: string; quantity?: number; created_at?: string; };
      };
      currencies: {
        Row: { id: string; tenant_id: string; code: string; name: string; symbol: string; is_default: boolean; created_at: string; };
        Insert: { id?: string; tenant_id: string; code: string; name: string; symbol?: string; is_default?: boolean; created_at?: string; };
        Update: { id?: string; tenant_id?: string; code?: string; name?: string; symbol?: string; is_default?: boolean; created_at?: string; };
      };
      exchange_rates: {
        Row: { id: string; tenant_id: string; from_currency: string; to_currency: string; rate: number; rate_type: 'formal' | 'black_market'; effective_date: string; };
        Insert: { id?: string; tenant_id: string; from_currency: string; to_currency: string; rate: number; rate_type: 'formal' | 'black_market'; effective_date: string; };
        Update: { id?: string; tenant_id?: string; from_currency?: string; to_currency?: string; rate?: number; rate_type?: 'formal' | 'black_market'; effective_date?: string; };
      };
      pos_locations: {
        Row: { id: string; tenant_id: string; name: string; warehouse_id: string; settings: Json; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; tenant_id: string; name: string; warehouse_id: string; settings?: Json; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; tenant_id?: string; name?: string; warehouse_id?: string; settings?: Json; is_active?: boolean; created_at?: string; updated_at?: string; };
      };
      accounts: {
        Row: {
          id: string; tenant_id: string; code: string; name: string;
          type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          parent_id: string | null; balance: number; is_active: boolean;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; code: string; name: string;
          type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          parent_id?: string | null; balance?: number; is_active?: boolean;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; code?: string; name?: string;
          type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          parent_id?: string | null; balance?: number; is_active?: boolean;
          created_at?: string; updated_at?: string;
        };
      };
      journal_entries: {
        Row: { id: string; tenant_id: string; entry_number: string; date: string; description: string | null; reference: string | null; is_auto: boolean; created_by: string | null; created_at: string; };
        Insert: { id?: string; tenant_id: string; entry_number: string; date: string; description?: string | null; reference?: string | null; is_auto?: boolean; created_by?: string | null; created_at?: string; };
        Update: { id?: string; tenant_id?: string; entry_number?: string; date?: string; description?: string | null; reference?: string | null; is_auto?: boolean; created_by?: string | null; created_at?: string; };
      };
      journal_lines: {
        Row: { id: string; tenant_id: string; journal_entry_id: string; account_id: string; debit: number; credit: number; description: string | null; created_at: string; };
        Insert: { id?: string; tenant_id: string; journal_entry_id: string; account_id: string; debit?: number; credit?: number; description?: string | null; created_at?: string; };
        Update: { id?: string; tenant_id?: string; journal_entry_id?: string; account_id?: string; debit?: number; credit?: number; description?: string | null; created_at?: string; };
      };
      employees: {
        Row: {
          id: string; tenant_id: string; user_id: string | null; employee_number: string;
          full_name: string; department: string | null; position: string | null;
          hire_date: string | null; salary: number | null; salary_currency: string | null;
          is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; user_id?: string | null; employee_number: string;
          full_name: string; department?: string | null; position?: string | null;
          hire_date?: string | null; salary?: number | null; salary_currency?: string | null;
          is_active?: boolean; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; user_id?: string | null; employee_number?: string;
          full_name?: string; department?: string | null; position?: string | null;
          hire_date?: string | null; salary?: number | null; salary_currency?: string | null;
          is_active?: boolean; created_at?: string; updated_at?: string;
        };
      };
      attendance: {
        Row: {
          id: string; tenant_id: string; employee_id: string; date: string;
          check_in: string | null; check_out: string | null;
          status: 'present' | 'absent' | 'leave' | 'holiday';
          notes: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; employee_id: string; date: string;
          check_in?: string | null; check_out?: string | null;
          status?: 'present' | 'absent' | 'leave' | 'holiday';
          notes?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; employee_id?: string; date?: string;
          check_in?: string | null; check_out?: string | null;
          status?: 'present' | 'absent' | 'leave' | 'holiday';
          notes?: string | null; created_at?: string; updated_at?: string;
        };
      };
      payroll_runs: {
        Row: {
          id: string; tenant_id: string; period_start: string; period_end: string;
          status: 'draft' | 'processing' | 'completed' | 'canceled';
          total_amount: number; currency: string; created_by: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; period_start: string; period_end: string;
          status?: 'draft' | 'processing' | 'completed' | 'canceled';
          total_amount?: number; currency?: string; created_by?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; period_start?: string; period_end?: string;
          status?: 'draft' | 'processing' | 'completed' | 'canceled';
          total_amount?: number; currency?: string; created_by?: string | null;
          created_at?: string; updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string; tenant_id: string; user_id: string; action: string;
          entity_type: string; entity_id: string | null;
          old_values: Json | null; new_values: Json | null;
          ip_address: string | null; user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; user_id: string; action: string;
          entity_type: string; entity_id?: string | null;
          old_values?: Json | null; new_values?: Json | null;
          ip_address?: string | null; user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; user_id?: string; action?: string;
          entity_type?: string; entity_id?: string | null;
          old_values?: Json | null; new_values?: Json | null;
          ip_address?: string | null; user_agent?: string | null;
          created_at?: string;
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
