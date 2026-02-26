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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "users_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      categories: {
        Row: { id: string; tenant_id: string; name: string; parent_id: string | null; created_at: string; };
        Insert: { id?: string; tenant_id: string; name: string; parent_id?: string | null; created_at?: string; };
        Update: { id?: string; tenant_id?: string; name?: string; parent_id?: string | null; created_at?: string; };
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "item_prices_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          }
        ];
      };
      item_packagings: {
        Row: { id: string; tenant_id: string; item_id: string; name: string; quantity: number; barcode: string | null; created_at: string; };
        Insert: { id?: string; tenant_id: string; item_id: string; name: string; quantity: number; barcode?: string | null; created_at?: string; };
        Update: { id?: string; tenant_id?: string; item_id?: string; name?: string; quantity?: number; barcode?: string | null; created_at?: string; };
        Relationships: [
          {
            foreignKeyName: "item_packagings_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "invoices_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "parties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "parties_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "payments_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "parties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          }
        ];
      };
      warehouses: {
        Row: { id: string; tenant_id: string; name: string; address: string | null; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; tenant_id: string; name: string; address?: string | null; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; tenant_id?: string; name?: string; address?: string | null; is_active?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [
          {
            foreignKeyName: "warehouses_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      inventory: {
        Row: { id: string; tenant_id: string; item_id: string; warehouse_id: string; quantity: number; reserved_quantity: number; low_stock_threshold: number | null; updated_at: string; };
        Insert: { id?: string; tenant_id: string; item_id: string; warehouse_id: string; quantity?: number; reserved_quantity?: number; low_stock_threshold?: number | null; updated_at?: string; };
        Update: { id?: string; tenant_id?: string; item_id?: string; warehouse_id?: string; quantity?: number; reserved_quantity?: number; low_stock_threshold?: number | null; updated_at?: string; };
        Relationships: [
          {
            foreignKeyName: "inventory_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "transfers_from_warehouse_id_fkey";
            columns: ["from_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfers_to_warehouse_id_fkey";
            columns: ["to_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          }
        ];
      };
      transfer_items: {
        Row: { id: string; tenant_id: string; transfer_id: string; item_id: string; quantity: number; created_at: string; };
        Insert: { id?: string; tenant_id: string; transfer_id: string; item_id: string; quantity: number; created_at?: string; };
        Update: { id?: string; tenant_id?: string; transfer_id?: string; item_id?: string; quantity?: number; created_at?: string; };
        Relationships: [
          {
            foreignKeyName: "transfer_items_transfer_id_fkey";
            columns: ["transfer_id"];
            isOneToOne: false;
            referencedRelation: "transfers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          }
        ];
      };
      currencies: {
        Row: { id: string; tenant_id: string; code: string; name: string; symbol: string; is_default: boolean; created_at: string; };
        Insert: { id?: string; tenant_id: string; code: string; name: string; symbol?: string; is_default?: boolean; created_at?: string; };
        Update: { id?: string; tenant_id?: string; code?: string; name?: string; symbol?: string; is_default?: boolean; created_at?: string; };
        Relationships: [];
      };
      exchange_rates: {
        Row: { id: string; tenant_id: string; from_currency: string; to_currency: string; rate: number; rate_type: 'formal' | 'black_market'; effective_date: string; };
        Insert: { id?: string; tenant_id: string; from_currency: string; to_currency: string; rate: number; rate_type: 'formal' | 'black_market'; effective_date: string; };
        Update: { id?: string; tenant_id?: string; from_currency?: string; to_currency?: string; rate?: number; rate_type?: 'formal' | 'black_market'; effective_date?: string; };
        Relationships: [];
      };
      pos_locations: {
        Row: { id: string; tenant_id: string; name: string; warehouse_id: string; settings: Json; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; tenant_id: string; name: string; warehouse_id: string; settings?: Json; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; tenant_id?: string; name?: string; warehouse_id?: string; settings?: Json; is_active?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [
          {
            foreignKeyName: "pos_locations_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      journal_entries: {
        Row: { id: string; tenant_id: string; entry_number: string; date: string; description: string | null; reference: string | null; is_auto: boolean; created_by: string | null; created_at: string; };
        Insert: { id?: string; tenant_id: string; entry_number: string; date: string; description?: string | null; reference?: string | null; is_auto?: boolean; created_by?: string | null; created_at?: string; };
        Update: { id?: string; tenant_id?: string; entry_number?: string; date?: string; description?: string | null; reference?: string | null; is_auto?: boolean; created_by?: string | null; created_at?: string; };
        Relationships: [];
      };
      journal_lines: {
        Row: { id: string; tenant_id: string; journal_entry_id: string; account_id: string; debit: number; credit: number; description: string | null; created_at: string; };
        Insert: { id?: string; tenant_id: string; journal_entry_id: string; account_id: string; debit?: number; credit?: number; description?: string | null; created_at?: string; };
        Update: { id?: string; tenant_id?: string; journal_entry_id?: string; account_id?: string; debit?: number; credit?: number; description?: string | null; created_at?: string; };
        Relationships: [
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey";
            columns: ["journal_entry_id"];
            isOneToOne: false;
            referencedRelation: "journal_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "employees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
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
        Relationships: [];
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
        Relationships: [];
      };
      settings: {
        Row: {
          id: string; tenant_id: string; key: string; value: Json;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; key: string; value: Json;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; tenant_id?: string; key?: string; value?: Json;
          created_at?: string; updated_at?: string;
        };
        Relationships: [];
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
      log_audit: {
        Args: {
          p_tenant_id: string;
          p_user_id: string;
          p_action: string;
          p_entity_type: string;
          p_entity_id: string | null;
          p_old_values: Json | null;
          p_new_values: Json | null;
          p_ip_address: string | null;
          p_user_agent: string | null;
        };
        Returns: string;
      };
      count_audit_logs: {
        Args: {
          p_tenant_id: string;
          p_user_id: string | null;
          p_entity_type: string | null;
          p_entity_id: string | null;
          p_action: string | null;
          p_date_from: string | null;
          p_date_to: string | null;
        };
        Returns: number;
      };
      get_audit_logs: {
        Args: {
          p_tenant_id: string;
          p_user_id: string | null;
          p_entity_type: string | null;
          p_entity_id: string | null;
          p_action: string | null;
          p_date_from: string | null;
          p_date_to: string | null;
          p_limit: number;
          p_offset: number;
        };
        Returns: {
          id: string;
          tenant_id: string;
          user_id: string;
          user_email: string | null;
          user_name: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        }[];
      };
      generate_invoice_number: {
        Args: {
          p_tenant_id: string;
          p_type: string;
        };
        Returns: string;
      };
      generate_payment_reference: {
        Args: {
          p_tenant_id: string;
          p_type: string;
        };
        Returns: string;
      };
      get_category_descendants: {
        Args: {
          p_tenant_id: string;
          p_parent_id: string;
        };
        Returns: {
          id: string;
          tenant_id: string;
          name: string;
          parent_id: string | null;
          created_at: string;
        }[];
      };
      recalculate_party_balance: {
        Args: {
          p_party_id: string;
        };
        Returns: number;
      };
      get_party_balance_summary: {
        Args: {
          p_tenant_id: string;
          p_party_type: string | null;
        };
        Returns: {
          party_id: string;
          party_name: string;
          party_type: string;
          balance: number;
          total_invoiced: number;
          total_paid: number;
        }[];
      };
    };
    Enums: {
      subscription_plan: 'freemium' | 'premium';
      subscription_status: 'active' | 'trialing' | 'canceled' | 'past_due';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
