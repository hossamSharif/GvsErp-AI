export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number | null
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          balance?: number | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          balance?: number | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          symbol: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          symbol?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          symbol?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          employee_number: string
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          position: string | null
          salary: number | null
          salary_currency: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          employee_number: string
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          position?: string | null
          salary?: number | null
          salary_currency?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          employee_number?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          position?: string | null
          salary?: number | null
          salary_currency?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          exchange_rate: number
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          reference: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          exchange_rate?: number
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          exchange_rate?: number
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          rate: number
          rate_type: Database["public"]["Enums"]["rate_type"]
          tenant_id: string
          to_currency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          from_currency: string
          id?: string
          rate: number
          rate_type?: Database["public"]["Enums"]["rate_type"]
          tenant_id: string
          to_currency?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          rate_type?: Database["public"]["Enums"]["rate_type"]
          tenant_id?: string
          to_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          id: string
          item_id: string
          low_stock_threshold: number | null
          quantity: number
          reserved_quantity: number | null
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          item_id: string
          low_stock_threshold?: number | null
          quantity?: number
          reserved_quantity?: number | null
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          item_id?: string
          low_stock_threshold?: number | null
          quantity?: number
          reserved_quantity?: number | null
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          invoice_id: string
          item_id: string
          line_total: number
          quantity: number
          sort_order: number
          tax_rate: number
          tenant_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id: string
          item_id: string
          line_total: number
          quantity: number
          sort_order?: number
          tax_rate?: number
          tenant_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id?: string
          item_id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          tax_rate?: number
          tenant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          created_at: string
          id: string
          last_number: number
          tenant_id: string
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
          year_month: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_number?: number
          tenant_id: string
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          year_month: string
        }
        Update: {
          created_at?: string
          id?: string
          last_number?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          exchange_rate: number
          finalized_at: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          party_id: string | null
          returned_from_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          exchange_rate?: number
          finalized_at?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          party_id?: string | null
          returned_from_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          exchange_rate?: number
          finalized_at?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          party_id?: string | null
          returned_from_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_returned_from_id_fkey"
            columns: ["returned_from_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      item_packagings: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          item_id: string
          name: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          item_id: string
          name: string
          quantity: number
          tenant_id: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          item_id?: string
          name?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_packagings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_packagings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_prices: {
        Row: {
          created_at: string
          currency: string
          effective_from: string | null
          effective_to: string | null
          id: string
          item_id: string
          price: number
          price_tier: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          item_id: string
          price: number
          price_tier?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          item_id?: string
          price?: number
          price_tier?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          barcode: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          id: string
          images: string[] | null
          is_active: boolean
          name: string
          name_alias: string | null
          sku: string | null
          tax_rate: number
          tenant_id: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_active?: boolean
          name: string
          name_alias?: string | null
          sku?: string | null
          tax_rate?: number
          tenant_id: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_active?: boolean
          name?: string
          name_alias?: string | null
          sku?: string | null
          tax_rate?: number
          tenant_id?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_number: string
          id: string
          is_posted: boolean | null
          source_id: string | null
          source_type: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date: string
          entry_number: string
          id?: string
          is_posted?: boolean | null
          source_id?: string | null
          source_type?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          is_posted?: boolean | null
          source_id?: string | null
          source_type?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number | null
          debit: number | null
          description: string | null
          id: string
          journal_entry_id: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number | null
          debit?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          address: string | null
          balance: number
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          tax_number: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["party_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["party_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["party_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sequences: {
        Row: {
          created_at: string
          id: string
          last_number: number
          tenant_id: string
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string
          year_month: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_number?: number
          tenant_id: string
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
          year_month: string
        }
        Update: {
          created_at?: string
          id?: string
          last_number?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          exchange_rate: number
          id: string
          invoice_id: string | null
          notes: string | null
          party_id: string
          payment_date: string
          payment_method: string | null
          reference: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          party_id: string
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          party_id?: string
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          created_at: string
          currency: string | null
          days_worked: number | null
          deductions: number | null
          employee_id: string
          gross_salary: number
          id: string
          net_salary: number
          notes: string | null
          payroll_run_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          days_worked?: number | null
          deductions?: number | null
          employee_id: string
          gross_salary: number
          id?: string
          net_salary: number
          notes?: string | null
          payroll_run_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          days_worked?: number | null
          deductions?: number | null
          employee_id?: string
          gross_salary?: number
          id?: string
          net_salary?: number
          notes?: string | null
          payroll_run_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["payroll_status"] | null
          tenant_id: string
          total_deductions: number | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["payroll_status"] | null
          tenant_id: string
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["payroll_status"] | null
          tenant_id?: string
          total_deductions?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_locations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          name: string
          permissions: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          permissions?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          permissions?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: []
      }
      transfer_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          tenant_id: string
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          tenant_id: string
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          tenant_id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          tenant_id: string
          to_warehouse_id: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          tenant_id: string
          to_warehouse_id: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          tenant_id?: string
          to_warehouse_id?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          preferences: Json
          role_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          preferences?: Json
          role_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          preferences?: Json
          role_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_inventory: {
        Args: {
          p_item_id: string
          p_quantity_change: number
          p_reserved_change?: number
          p_tenant_id: string
          p_warehouse_id: string
        }
        Returns: undefined
      }
      calculate_line_total: {
        Args: {
          p_discount_percent: number
          p_quantity: number
          p_tax_rate: number
          p_unit_price: number
        }
        Returns: number
      }
      count_audit_logs: {
        Args: {
          p_action?: string
          p_date_from?: string
          p_date_to?: string
          p_entity_id?: string
          p_entity_type?: string
          p_tenant_id: string
          p_user_id?: string
        }
        Returns: number
      }
      create_default_roles: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      generate_invoice_number: {
        Args: {
          p_tenant_id: string
          p_type: Database["public"]["Enums"]["invoice_type"]
        }
        Returns: string
      }
      generate_payment_reference: {
        Args: {
          p_tenant_id: string
          p_type: Database["public"]["Enums"]["payment_type"]
        }
        Returns: string
      }
      generate_transfer_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      get_audit_logs: {
        Args: {
          p_action?: string
          p_date_from?: string
          p_date_to?: string
          p_entity_id?: string
          p_entity_type?: string
          p_limit?: number
          p_offset?: number
          p_tenant_id: string
          p_user_id?: string
        }
        Returns: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json
          old_values: Json
          user_agent: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_item_price: {
        Args: {
          p_currency?: string
          p_date?: string
          p_item_id: string
          p_price_tier?: string
        }
        Returns: number
      }
      get_low_stock_items: {
        Args: { p_tenant_id: string; p_warehouse_id?: string }
        Returns: {
          item_id: string
          item_name: string
          low_stock_threshold: number
          quantity: number
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      get_or_create_inventory: {
        Args: { p_item_id: string; p_tenant_id: string; p_warehouse_id: string }
        Returns: string
      }
      get_tenant_id: { Args: never; Returns: string }
      get_user_id: { Args: never; Returns: string }
      log_audit: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_ip_address?: unknown
          p_new_values?: Json
          p_old_values?: Json
          p_tenant_id: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      recalculate_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      user_has_permission: { Args: { permission: string }; Returns: boolean }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      attendance_status: "present" | "absent" | "leave" | "holiday"
      invoice_status: "draft" | "final" | "returned" | "canceled"
      invoice_type: "sale" | "purchase"
      party_type: "customer" | "supplier"
      payment_type: "received" | "made"
      payroll_status: "draft" | "processing" | "completed"
      rate_type: "formal" | "black_market"
      subscription_plan: "freemium" | "premium"
      subscription_status: "active" | "trialing" | "canceled" | "past_due"
      transfer_status: "pending" | "in_transit" | "completed" | "canceled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      attendance_status: ["present", "absent", "leave", "holiday"],
      invoice_status: ["draft", "final", "returned", "canceled"],
      invoice_type: ["sale", "purchase"],
      party_type: ["customer", "supplier"],
      payment_type: ["received", "made"],
      payroll_status: ["draft", "processing", "completed"],
      rate_type: ["formal", "black_market"],
      subscription_plan: ["freemium", "premium"],
      subscription_status: ["active", "trialing", "canceled", "past_due"],
      transfer_status: ["pending", "in_transit", "completed", "canceled"],
    },
  },
} as const
