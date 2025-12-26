-- ============================================================================
-- DUMMY DATA SCRIPT FOR ERP SYSTEM
-- Email: hosamsharif1990@gmail.com
-- ============================================================================
-- This script creates:
-- - 1 Tenant
-- - 1 Admin user
-- - 1 Warehouse
-- - 5 Items with multiple retail prices
-- - 1 Supplier and 1 Customer
-- - 1 Purchase Invoice
-- - 1 Sales Invoice
-- ============================================================================

-- Step 1: Create Tenant
-- ============================================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_admin_role_id UUID;
    v_user_id UUID;
    v_warehouse_id UUID;
    v_category_id UUID;
    v_item1_id UUID;
    v_item2_id UUID;
    v_item3_id UUID;
    v_item4_id UUID;
    v_item5_id UUID;
    v_supplier_id UUID;
    v_customer_id UUID;
    v_purchase_invoice_id UUID;
    v_purchase_invoice_number TEXT;
    v_sales_invoice_id UUID;
    v_sales_invoice_number TEXT;
BEGIN
    -- Check if tenant already exists for this email
    SELECT t.id INTO v_tenant_id
    FROM tenants t
    JOIN users u ON u.tenant_id = t.id
    WHERE u.email = 'hosamsharif1990@gmail.com'
    LIMIT 1;

    -- Create tenant if it doesn't exist
    IF v_tenant_id IS NULL THEN
        INSERT INTO tenants (name, subscription_plan, subscription_status, settings)
        VALUES (
            'Test Company Ltd',
            'premium',
            'active',
            '{
                "default_language": "en",
                "default_theme": "light",
                "default_currency": "USD",
                "modules": {
                    "stock": true,
                    "accounting": true,
                    "hr": true
                },
                "limits": {
                    "max_items": 1000,
                    "max_users": 10,
                    "max_transactions_per_month": 1000
                }
            }'::jsonb
        )
        RETURNING id INTO v_tenant_id;

        RAISE NOTICE 'Created tenant: %', v_tenant_id;
    ELSE
        RAISE NOTICE 'Using existing tenant: %', v_tenant_id;
    END IF;

    -- Get admin role for this tenant
    SELECT id INTO v_admin_role_id
    FROM roles
    WHERE tenant_id = v_tenant_id AND name = 'admin'
    LIMIT 1;

    -- Create user if doesn't exist
    -- Note: You'll need to create the auth.users entry separately in Supabase Auth
    -- This is just the application user record
    SELECT id INTO v_user_id
    FROM users
    WHERE tenant_id = v_tenant_id AND email = 'hosamsharif1990@gmail.com';

    IF v_user_id IS NULL THEN
        -- Generate a UUID for the user (should match auth.users.id in production)
        v_user_id := gen_random_uuid();

        INSERT INTO users (id, tenant_id, email, full_name, role_id, is_active)
        VALUES (
            v_user_id,
            v_tenant_id,
            'hosamsharif1990@gmail.com',
            'Hosam Sharif',
            v_admin_role_id,
            true
        );

        RAISE NOTICE 'Created user: %', v_user_id;
    ELSE
        RAISE NOTICE 'Using existing user: %', v_user_id;
    END IF;

    -- ========================================================================
    -- Step 2: Create Warehouse
    -- ========================================================================

    INSERT INTO warehouses (tenant_id, name, address, is_active)
    VALUES (
        v_tenant_id,
        'Main Warehouse',
        '123 Storage St, Industrial Zone, City',
        true
    )
    RETURNING id INTO v_warehouse_id;

    RAISE NOTICE 'Created warehouse: %', v_warehouse_id;

    -- ========================================================================
    -- Step 3: Create Category
    -- ========================================================================

    INSERT INTO categories (tenant_id, name)
    VALUES (v_tenant_id, 'Electronics')
    RETURNING id INTO v_category_id;

    RAISE NOTICE 'Created category: %', v_category_id;

    -- ========================================================================
    -- Step 4: Create 5 Items with Multiple Prices
    -- ========================================================================

    -- Item 1: Laptop
    INSERT INTO items (tenant_id, name, sku, barcode, brand, category_id, unit_of_measure, tax_rate, is_active)
    VALUES (
        v_tenant_id,
        'Dell Laptop XPS 15',
        'DELL-XPS-15',
        '1234567890001',
        'Dell',
        v_category_id,
        'piece',
        15.00,
        true
    )
    RETURNING id INTO v_item1_id;

    -- Item 1 Prices
    INSERT INTO item_prices (item_id, tenant_id, price_tier, price, currency)
    VALUES
        (v_item1_id, v_tenant_id, 'retail', 1299.99, 'USD'),
        (v_item1_id, v_tenant_id, 'wholesale', 1099.99, 'USD'),
        (v_item1_id, v_tenant_id, 'vip', 1199.99, 'USD');

    -- Item 2: Smartphone
    INSERT INTO items (tenant_id, name, sku, barcode, brand, category_id, unit_of_measure, tax_rate, is_active)
    VALUES (
        v_tenant_id,
        'iPhone 15 Pro',
        'APPLE-IP15-PRO',
        '1234567890002',
        'Apple',
        v_category_id,
        'piece',
        15.00,
        true
    )
    RETURNING id INTO v_item2_id;

    -- Item 2 Prices
    INSERT INTO item_prices (item_id, tenant_id, price_tier, price, currency)
    VALUES
        (v_item2_id, v_tenant_id, 'retail', 999.99, 'USD'),
        (v_item2_id, v_tenant_id, 'wholesale', 849.99, 'USD'),
        (v_item2_id, v_tenant_id, 'vip', 899.99, 'USD');

    -- Item 3: Wireless Mouse
    INSERT INTO items (tenant_id, name, sku, barcode, brand, category_id, unit_of_measure, tax_rate, is_active)
    VALUES (
        v_tenant_id,
        'Logitech MX Master 3',
        'LOGI-MX3',
        '1234567890003',
        'Logitech',
        v_category_id,
        'piece',
        10.00,
        true
    )
    RETURNING id INTO v_item3_id;

    -- Item 3 Prices
    INSERT INTO item_prices (item_id, tenant_id, price_tier, price, currency)
    VALUES
        (v_item3_id, v_tenant_id, 'retail', 99.99, 'USD'),
        (v_item3_id, v_tenant_id, 'wholesale', 79.99, 'USD'),
        (v_item3_id, v_tenant_id, 'vip', 89.99, 'USD');

    -- Item 4: Mechanical Keyboard
    INSERT INTO items (tenant_id, name, sku, barcode, brand, category_id, unit_of_measure, tax_rate, is_active)
    VALUES (
        v_tenant_id,
        'Keychron K8 Pro',
        'KEY-K8-PRO',
        '1234567890004',
        'Keychron',
        v_category_id,
        'piece',
        10.00,
        true
    )
    RETURNING id INTO v_item4_id;

    -- Item 4 Prices
    INSERT INTO item_prices (item_id, tenant_id, price_tier, price, currency)
    VALUES
        (v_item4_id, v_tenant_id, 'retail', 149.99, 'USD'),
        (v_item4_id, v_tenant_id, 'wholesale', 119.99, 'USD'),
        (v_item4_id, v_tenant_id, 'vip', 134.99, 'USD');

    -- Item 5: USB-C Hub
    INSERT INTO items (tenant_id, name, sku, barcode, brand, category_id, unit_of_measure, tax_rate, is_active)
    VALUES (
        v_tenant_id,
        'Anker USB-C Hub 7-in-1',
        'ANKER-HUB-7IN1',
        '1234567890005',
        'Anker',
        v_category_id,
        'piece',
        8.00,
        true
    )
    RETURNING id INTO v_item5_id;

    -- Item 5 Prices
    INSERT INTO item_prices (item_id, tenant_id, price_tier, price, currency)
    VALUES
        (v_item5_id, v_tenant_id, 'retail', 49.99, 'USD'),
        (v_item5_id, v_tenant_id, 'wholesale', 39.99, 'USD'),
        (v_item5_id, v_tenant_id, 'vip', 44.99, 'USD');

    RAISE NOTICE 'Created 5 items with multiple prices';

    -- ========================================================================
    -- Step 5: Create Initial Inventory
    -- ========================================================================

    INSERT INTO inventory (tenant_id, item_id, warehouse_id, quantity, reserved_quantity, low_stock_threshold)
    VALUES
        (v_tenant_id, v_item1_id, v_warehouse_id, 50, 0, 10),
        (v_tenant_id, v_item2_id, v_warehouse_id, 100, 0, 20),
        (v_tenant_id, v_item3_id, v_warehouse_id, 200, 0, 30),
        (v_tenant_id, v_item4_id, v_warehouse_id, 150, 0, 25),
        (v_tenant_id, v_item5_id, v_warehouse_id, 300, 0, 50);

    RAISE NOTICE 'Created initial inventory';

    -- ========================================================================
    -- Step 6: Create Supplier and Customer
    -- ========================================================================

    -- Create Supplier
    INSERT INTO parties (tenant_id, type, name, email, phone, address, tax_number, balance, is_active, notes)
    VALUES (
        v_tenant_id,
        'supplier',
        'TechSupply Global Inc.',
        'sales@techsupply.com',
        '+1-555-0100',
        '456 Supplier Ave, Tech Park, City',
        'TAX-SUP-12345',
        0,
        true,
        'Main electronics supplier'
    )
    RETURNING id INTO v_supplier_id;

    RAISE NOTICE 'Created supplier: %', v_supplier_id;

    -- Create Customer
    INSERT INTO parties (tenant_id, type, name, email, phone, address, tax_number, balance, is_active, notes)
    VALUES (
        v_tenant_id,
        'customer',
        'ABC Retail Store',
        'orders@abcretail.com',
        '+1-555-0200',
        '789 Customer Blvd, Shopping District, City',
        'TAX-CUS-67890',
        0,
        true,
        'Regular corporate customer'
    )
    RETURNING id INTO v_customer_id;

    RAISE NOTICE 'Created customer: %', v_customer_id;

    -- ========================================================================
    -- Step 7: Create Purchase Invoice
    -- ========================================================================

    -- Generate purchase invoice number
    v_purchase_invoice_number := generate_invoice_number(v_tenant_id, 'purchase');

    -- Create purchase invoice (draft)
    INSERT INTO invoices (
        tenant_id,
        invoice_number,
        type,
        status,
        party_id,
        warehouse_id,
        currency,
        exchange_rate,
        created_by,
        notes
    )
    VALUES (
        v_tenant_id,
        v_purchase_invoice_number,
        'purchase',
        'draft',
        v_supplier_id,
        v_warehouse_id,
        'USD',
        1.0,
        v_user_id,
        'Initial stock purchase from TechSupply'
    )
    RETURNING id INTO v_purchase_invoice_id;

    -- Add items to purchase invoice
    INSERT INTO invoice_items (invoice_id, tenant_id, item_id, description, quantity, unit_price, discount_percent, tax_rate, sort_order)
    VALUES
        (v_purchase_invoice_id, v_tenant_id, v_item1_id, 'Dell Laptop XPS 15', 10, 1099.99, 5.00, 0, 1),
        (v_purchase_invoice_id, v_tenant_id, v_item2_id, 'iPhone 15 Pro', 20, 849.99, 3.00, 0, 2),
        (v_purchase_invoice_id, v_tenant_id, v_item3_id, 'Logitech MX Master 3', 50, 79.99, 10.00, 0, 3);

    RAISE NOTICE 'Created purchase invoice: % (%)', v_purchase_invoice_number, v_purchase_invoice_id;

    -- ========================================================================
    -- Step 8: Create Sales Invoice
    -- ========================================================================

    -- Generate sales invoice number
    v_sales_invoice_number := generate_invoice_number(v_tenant_id, 'sale');

    -- Create sales invoice (draft)
    INSERT INTO invoices (
        tenant_id,
        invoice_number,
        type,
        status,
        party_id,
        warehouse_id,
        currency,
        exchange_rate,
        created_by,
        notes
    )
    VALUES (
        v_tenant_id,
        v_sales_invoice_number,
        'sale',
        'draft',
        v_customer_id,
        v_warehouse_id,
        'USD',
        1.0,
        v_user_id,
        'Sales order for ABC Retail Store'
    )
    RETURNING id INTO v_sales_invoice_id;

    -- Add items to sales invoice (using retail prices)
    INSERT INTO invoice_items (invoice_id, tenant_id, item_id, description, quantity, unit_price, discount_percent, tax_rate, sort_order)
    VALUES
        (v_sales_invoice_id, v_tenant_id, v_item1_id, 'Dell Laptop XPS 15', 2, 1299.99, 0, 15.00, 1),
        (v_sales_invoice_id, v_tenant_id, v_item2_id, 'iPhone 15 Pro', 3, 999.99, 5.00, 15.00, 2),
        (v_sales_invoice_id, v_tenant_id, v_item4_id, 'Keychron K8 Pro', 5, 149.99, 0, 10.00, 3),
        (v_sales_invoice_id, v_tenant_id, v_item5_id, 'Anker USB-C Hub 7-in-1', 10, 49.99, 10.00, 8.00, 4);

    RAISE NOTICE 'Created sales invoice: % (%)', v_sales_invoice_number, v_sales_invoice_id;

    -- ========================================================================
    -- Summary
    -- ========================================================================

    RAISE NOTICE '========================================';
    RAISE NOTICE 'DUMMY DATA CREATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tenant ID: %', v_tenant_id;
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Warehouse: Main Warehouse (ID: %)', v_warehouse_id;
    RAISE NOTICE 'Items Created: 5 (with 3 price tiers each)';
    RAISE NOTICE '  - Dell Laptop XPS 15';
    RAISE NOTICE '  - iPhone 15 Pro';
    RAISE NOTICE '  - Logitech MX Master 3';
    RAISE NOTICE '  - Keychron K8 Pro';
    RAISE NOTICE '  - Anker USB-C Hub 7-in-1';
    RAISE NOTICE 'Supplier: TechSupply Global Inc. (ID: %)', v_supplier_id;
    RAISE NOTICE 'Customer: ABC Retail Store (ID: %)', v_customer_id;
    RAISE NOTICE 'Purchase Invoice: % (ID: %)', v_purchase_invoice_number, v_purchase_invoice_id;
    RAISE NOTICE 'Sales Invoice: % (ID: %)', v_sales_invoice_number, v_sales_invoice_id;
    RAISE NOTICE '========================================';

END $$;
