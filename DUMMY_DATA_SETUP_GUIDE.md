# Dummy Data Setup Guide

This guide explains how to add test data to your ERP system using the Supabase SQL Editor.

## What's Included

The `dummy_data_script.sql` file creates:

- **1 Tenant**: "Test Company Ltd" (Premium plan)
- **1 Admin User**: hosamsharif1990@gmail.com
- **1 Warehouse**: "Main Warehouse"
- **5 Items** with multiple price tiers:
  1. Dell Laptop XPS 15 (Retail: $1,299.99, Wholesale: $1,099.99, VIP: $1,199.99)
  2. iPhone 15 Pro (Retail: $999.99, Wholesale: $849.99, VIP: $899.99)
  3. Logitech MX Master 3 (Retail: $99.99, Wholesale: $79.99, VIP: $89.99)
  4. Keychron K8 Pro (Retail: $149.99, Wholesale: $119.99, VIP: $134.99)
  5. Anker USB-C Hub 7-in-1 (Retail: $49.99, Wholesale: $39.99, VIP: $44.99)
- **Initial Inventory**: Stock levels for all items in the warehouse
- **1 Supplier**: TechSupply Global Inc.
- **1 Customer**: ABC Retail Store
- **1 Purchase Invoice**: Draft purchase order from supplier (3 items)
- **1 Sales Invoice**: Draft sales order to customer (4 items)

## How to Execute the Script

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project: https://ahcwylvsjnsmbhtdeqws.supabase.co
2. Navigate to **SQL Editor** from the left sidebar
3. Click **New Query**
4. Copy the entire contents of `dummy_data_script.sql`
5. Paste it into the SQL editor
6. Click **Run** or press `Ctrl+Enter`
7. Check the output panel for success messages

### Option 2: Using Supabase CLI

```bash
# Make sure you're logged in
supabase login

# Link your project (if not already linked)
supabase link --project-ref ahcwylvsjnsmbhtdeqws

# Run the script
supabase db execute --file dummy_data_script.sql
```

## Important Notes

### User Authentication

The script creates a user record in the `users` table, but **you still need to create the corresponding authentication user** in Supabase Auth:

1. Go to **Authentication > Users** in your Supabase dashboard
2. Click **Add User**
3. Enter:
   - Email: `hosamsharif1990@gmail.com`
   - Password: (choose a password)
   - Auto-confirm: ✓ (checked)
4. Click **Create User**
5. **Important**: After creating the auth user, you need to update the `users` table to link them:
   ```sql
   -- Get the auth user ID
   SELECT id FROM auth.users WHERE email = 'hosamsharif1990@gmail.com';

   -- Update the users table with the correct auth user ID
   UPDATE users
   SET id = '<auth-user-id-from-above>'
   WHERE email = 'hosamsharif1990@gmail.com';
   ```

### Invoices Are Draft Status

Both invoices are created with `status = 'draft'`. This means:
- They don't affect inventory levels yet
- They don't affect party balances
- You can edit them in the UI

To finalize an invoice:
1. Navigate to the invoice in your app
2. Review the items and totals
3. Change status to "final" (this will update inventory and balances)

## Verification Queries

After running the script, you can verify the data was created correctly:

```sql
-- Check tenant
SELECT * FROM tenants WHERE name = 'Test Company Ltd';

-- Check user
SELECT * FROM users WHERE email = 'hosamsharif1990@gmail.com';

-- Check warehouse
SELECT * FROM warehouses WHERE name = 'Main Warehouse';

-- Check items and prices
SELECT i.name, i.sku, ip.price_tier, ip.price
FROM items i
JOIN item_prices ip ON ip.item_id = i.id
ORDER BY i.name, ip.price_tier;

-- Check inventory
SELECT i.name, inv.quantity, inv.low_stock_threshold
FROM inventory inv
JOIN items i ON i.id = inv.item_id;

-- Check parties
SELECT type, name, email FROM parties;

-- Check invoices
SELECT invoice_number, type, status, total
FROM invoices
ORDER BY created_at;

-- Check invoice details
SELECT
    inv.invoice_number,
    inv.type,
    i.name,
    ii.quantity,
    ii.unit_price,
    ii.line_total
FROM invoice_items ii
JOIN invoices inv ON inv.id = ii.invoice_id
JOIN items i ON i.id = ii.item_id
ORDER BY inv.invoice_number, ii.sort_order;
```

## Next Steps

After setting up the dummy data:

1. **Create the auth user** (see "User Authentication" section above)
2. **Log in** to your application with hosamsharif1990@gmail.com
3. **Test the features**:
   - View and edit items
   - Check inventory levels in the warehouse
   - View the purchase and sales invoices
   - Finalize invoices to see inventory changes
   - Create new transactions
   - View reports

## Troubleshooting

### Error: "relation does not exist"

Make sure all migrations have been applied to your database first:

```bash
supabase db push
```

### Error: "violates foreign key constraint"

The script has dependencies. Make sure you run the entire script at once, not in pieces.

### Data Already Exists

The script checks if a tenant with the same email exists and will reuse it. If you want to start fresh:

```sql
-- WARNING: This will delete all data for the test tenant
DELETE FROM tenants WHERE name = 'Test Company Ltd';
-- Then run the script again
```

## Support

If you encounter any issues, check the Supabase logs in the dashboard or contact support.
