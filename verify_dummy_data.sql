-- ============================================================================
-- VERIFICATION SCRIPT FOR DUMMY DATA
-- ============================================================================
-- Run this script after inserting dummy data to verify everything was created
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'DUMMY DATA VERIFICATION'
\echo '========================================='
\echo ''

-- Check Tenants
\echo '1. TENANTS:'
\echo '-----------'
SELECT
    id,
    name,
    subscription_plan,
    subscription_status,
    settings->>'default_currency' as currency,
    (settings->'modules'->>'stock')::boolean as stock_module,
    (settings->'modules'->>'accounting')::boolean as accounting_module,
    (settings->'modules'->>'hr')::boolean as hr_module,
    created_at
FROM tenants
WHERE name = 'Test Company Ltd';

\echo ''
\echo '2. USERS:'
\echo '----------'
SELECT
    u.id,
    u.email,
    u.full_name,
    r.name as role,
    u.is_active,
    u.created_at
FROM users u
LEFT JOIN roles r ON r.id = u.role_id
WHERE u.email = 'hosamsharif1990@gmail.com';

\echo ''
\echo '3. WAREHOUSES:'
\echo '---------------'
SELECT
    w.id,
    w.name,
    w.address,
    w.is_active,
    COUNT(inv.id) as item_count,
    SUM(inv.quantity) as total_stock
FROM warehouses w
LEFT JOIN inventory inv ON inv.warehouse_id = w.id
WHERE w.name = 'Main Warehouse'
GROUP BY w.id, w.name, w.address, w.is_active;

\echo ''
\echo '4. ITEMS & PRICES:'
\echo '-------------------'
SELECT
    i.name,
    i.sku,
    i.brand,
    c.name as category,
    i.tax_rate,
    json_agg(
        json_build_object(
            'tier', ip.price_tier,
            'price', ip.price,
            'currency', ip.currency
        ) ORDER BY ip.price_tier
    ) as prices
FROM items i
LEFT JOIN categories c ON c.id = i.category_id
LEFT JOIN item_prices ip ON ip.item_id = i.id
WHERE i.tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
GROUP BY i.id, i.name, i.sku, i.brand, c.name, i.tax_rate
ORDER BY i.name;

\echo ''
\echo '5. INVENTORY LEVELS:'
\echo '---------------------'
SELECT
    i.name as item_name,
    i.sku,
    w.name as warehouse,
    inv.quantity,
    inv.reserved_quantity,
    inv.low_stock_threshold,
    CASE
        WHEN inv.quantity <= COALESCE(inv.low_stock_threshold, 0) THEN 'LOW STOCK'
        ELSE 'OK'
    END as status
FROM inventory inv
JOIN items i ON i.id = inv.item_id
JOIN warehouses w ON w.id = inv.warehouse_id
WHERE w.name = 'Main Warehouse'
ORDER BY i.name;

\echo ''
\echo '6. PARTIES (Customers & Suppliers):'
\echo '-------------------------------------'
SELECT
    type,
    name,
    email,
    phone,
    tax_number,
    balance,
    is_active
FROM parties
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
ORDER BY type, name;

\echo ''
\echo '7. INVOICES:'
\echo '-------------'
SELECT
    inv.invoice_number,
    inv.type,
    inv.status,
    p.name as party,
    w.name as warehouse,
    inv.subtotal,
    inv.tax_amount,
    inv.discount_amount,
    inv.total,
    inv.currency,
    inv.created_at
FROM invoices inv
LEFT JOIN parties p ON p.id = inv.party_id
LEFT JOIN warehouses w ON w.id = inv.warehouse_id
WHERE inv.tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
ORDER BY inv.created_at;

\echo ''
\echo '8. INVOICE DETAILS:'
\echo '--------------------'
SELECT
    inv.invoice_number,
    inv.type as invoice_type,
    i.name as item,
    ii.quantity,
    ii.unit_price,
    ii.discount_percent,
    ii.tax_rate,
    ii.line_total
FROM invoice_items ii
JOIN invoices inv ON inv.id = ii.invoice_id
JOIN items i ON i.id = ii.item_id
WHERE inv.tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
ORDER BY inv.invoice_number, ii.sort_order;

\echo ''
\echo '9. SUMMARY STATISTICS:'
\echo '-----------------------'
SELECT
    'Total Items' as metric,
    COUNT(*)::text as value
FROM items
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
UNION ALL
SELECT
    'Total Inventory Value (at retail)' as metric,
    CONCAT('$', ROUND(SUM(inv.quantity * ip.price)::numeric, 2)::text) as value
FROM inventory inv
JOIN item_prices ip ON ip.item_id = inv.item_id AND ip.price_tier = 'retail'
WHERE inv.tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
UNION ALL
SELECT
    'Number of Suppliers' as metric,
    COUNT(*)::text as value
FROM parties
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
  AND type = 'supplier'
UNION ALL
SELECT
    'Number of Customers' as metric,
    COUNT(*)::text as value
FROM parties
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
  AND type = 'customer'
UNION ALL
SELECT
    'Draft Purchase Invoices' as metric,
    COUNT(*)::text as value
FROM invoices
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
  AND type = 'purchase'
  AND status = 'draft'
UNION ALL
SELECT
    'Draft Sales Invoices' as metric,
    COUNT(*)::text as value
FROM invoices
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Test Company Ltd')
  AND type = 'sale'
  AND status = 'draft';

\echo ''
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
