/**
 * Comprehensive Seed Data Script for Development/Testing
 *
 * This script creates realistic test data across all ERP modules to prevent
 * empty database scenarios during development.
 *
 * Usage:
 *   pnpm seed:dev          # Seed with development data
 *   pnpm seed:demo         # Seed with demo data
 *   pnpm seed:test         # Seed minimal test data
 *
 * Safety:
 *   - Only runs in development/staging environments
 *   - Checks for existing data before seeding
 *   - Tenant-isolated (won't affect other tenants)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

// Prevent accidental seeding in production
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Cannot run seed script in production environment');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

interface SeedOptions {
  tenantId?: string;
  mode: 'dev' | 'demo' | 'test';
  force?: boolean;
}

/**
 * Main seed function
 */
async function seedDatabase(options: SeedOptions) {
  const { tenantId, mode, force = false } = options;

  console.log('\n🌱 Starting database seeding...');
  console.log(`   Mode: ${mode}`);
  console.log(`   Tenant ID: ${tenantId || 'Will create new tenant'}`);
  console.log(`   Force: ${force ? 'Yes' : 'No'}\n`);

  try {
    // Get or create tenant
    const tenant = await getOrCreateTenant(tenantId);
    console.log(`✅ Using tenant: ${tenant.name} (${tenant.id})\n`);

    // Check existing data
    if (!force) {
      const hasData = await checkExistingData(tenant.id);
      if (hasData) {
        console.log('⚠️  Tenant already has data. Use --force to overwrite.');
        console.log('   Or specify a different tenant with --tenant-id=<id>\n');
        return;
      }
    }

    // Seed data based on mode
    const dataVolume = {
      dev: { parties: 5, items: 10, invoices: 5, payments: 3 },
      demo: { parties: 10, items: 20, invoices: 15, payments: 10 },
      test: { parties: 2, items: 3, invoices: 2, payments: 1 },
    }[mode];

    // Create seed data
    await seedCategories(tenant.id);
    await seedItems(tenant.id, dataVolume.items);
    await seedWarehouses(tenant.id);
    await seedParties(tenant.id, dataVolume.parties);
    await seedInventory(tenant.id);
    await seedInvoices(tenant.id, dataVolume.invoices);
    await seedPayments(tenant.id, dataVolume.payments);

    if (mode !== 'test') {
      await seedExpenses(tenant.id);
      await seedTransfers(tenant.id);
    }

    console.log('\n🎉 Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    const summary = await getDataSummary(tenant.id);
    console.table(summary);

    console.log('\n📝 Next steps:');
    console.log('   1. Refresh your browser');
    console.log('   2. Login with your test account');
    console.log(`   3. View data for tenant: ${tenant.name}\n`);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

/**
 * Get existing tenant or create a test tenant
 */
async function getOrCreateTenant(tenantId?: string) {
  if (tenantId) {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    return data;
  }

  // Create test tenant
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: `Test Company ${new Date().toISOString().split('T')[0]}`,
      subscription_plan: 'premium',
      subscription_status: 'active',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error('Failed to create test tenant');
  }

  return data;
}

/**
 * Check if tenant already has data
 */
async function checkExistingData(tenantId: string): Promise<boolean> {
  const checks = await Promise.all([
    supabase.from('parties').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  return checks.some(result => (result.count || 0) > 0);
}

/**
 * Seed categories
 */
async function seedCategories(tenantId: string) {
  console.log('📁 Seeding categories...');

  const categories = [
    { name: 'Electronics', description: 'Electronic devices and accessories' },
    { name: 'Office Supplies', description: 'Office equipment and supplies' },
    { name: 'Furniture', description: 'Office and home furniture' },
  ];

  const { error } = await supabase
    .from('categories')
    .upsert(
      categories.map(cat => ({
        ...cat,
        tenant_id: tenantId,
      })),
      { onConflict: 'tenant_id,name' }
    );

  if (error) throw error;
  console.log(`   ✓ Created ${categories.length} categories`);
}

/**
 * Seed items
 */
async function seedItems(tenantId: string, count: number) {
  console.log(`📦 Seeding ${count} items...`);

  const { data: categories } = await supabase
    .from('categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(3);

  if (!categories || categories.length === 0) {
    throw new Error('No categories found. Seed categories first.');
  }

  const itemTemplates = [
    { name: 'Laptop Dell XPS 15', sku: 'LAP-001', price: 1299.99, cost: 1100.00, category: 0 },
    { name: 'Monitor LG 27" 4K', sku: 'MON-001', price: 449.99, cost: 380.00, category: 0 },
    { name: 'Mechanical Keyboard', sku: 'KEY-001', price: 129.99, cost: 95.00, category: 0 },
    { name: 'Wireless Mouse', sku: 'MOU-001', price: 39.99, cost: 25.00, category: 0 },
    { name: 'USB-C Hub', sku: 'HUB-001', price: 79.99, cost: 55.00, category: 0 },
    { name: 'Office Chair', sku: 'CHR-001', price: 299.99, cost: 220.00, category: 2 },
    { name: 'Standing Desk', sku: 'DSK-001', price: 599.99, cost: 450.00, category: 2 },
    { name: 'Printer Paper (Pack)', sku: 'PAP-001', price: 24.99, cost: 18.00, category: 1 },
    { name: 'Pen Set (12 pcs)', sku: 'PEN-001', price: 9.99, cost: 5.00, category: 1 },
    { name: 'Notebook (A4)', sku: 'NOT-001', price: 4.99, cost: 2.50, category: 1 },
  ];

  const items = itemTemplates.slice(0, count).map(item => ({
    tenant_id: tenantId,
    name: item.name,
    sku: item.sku,
    category_id: categories[item.category].id,
    price: item.price,
    cost: item.cost,
    type: 'good' as const,
    track_stock: true,
    tax_rate: 14.00, // Egypt VAT
  }));

  const { error } = await supabase.from('items').upsert(items, { onConflict: 'tenant_id,sku' });

  if (error) throw error;
  console.log(`   ✓ Created ${items.length} items`);
}

/**
 * Seed warehouses
 */
async function seedWarehouses(tenantId: string) {
  console.log('🏭 Seeding warehouses...');

  const warehouses = [
    { name: 'Main Warehouse - Cairo', code: 'WH-CAI', address: '123 Industrial Road, Cairo, Egypt' },
    { name: 'Branch Warehouse - Alexandria', code: 'WH-ALX', address: '456 Port Street, Alexandria, Egypt' },
    { name: 'Distribution Center - Giza', code: 'WH-GIZ', address: '789 Logistics Park, Giza, Egypt' },
  ];

  const { error } = await supabase
    .from('warehouses')
    .upsert(
      warehouses.map(wh => ({ ...wh, tenant_id: tenantId })),
      { onConflict: 'tenant_id,code' }
    );

  if (error) throw error;
  console.log(`   ✓ Created ${warehouses.length} warehouses`);
}

/**
 * Seed parties (customers & suppliers)
 */
async function seedParties(tenantId: string, count: number) {
  console.log(`👥 Seeding ${count} parties...`);

  const partyTemplates = [
    { type: 'customer', name: 'Tech Solutions Ltd', email: 'contact@techsolutions.eg', phone: '+20 100 123 4567' },
    { type: 'customer', name: 'Global Trading Co', email: 'info@globaltrading.com', phone: '+20 100 234 5678' },
    { type: 'customer', name: 'Digital Innovations', email: 'hello@digitalinno.com', phone: '+20 100 345 6789' },
    { type: 'supplier', name: 'Electronics Wholesale Inc', email: 'sales@electrowholesale.com', phone: '+20 100 456 7890' },
    { type: 'supplier', name: 'Tech Imports Egypt', email: 'orders@techimports.eg', phone: '+20 100 567 8901' },
    { type: 'supplier', name: 'Office Supplies Direct', email: 'supply@officedirect.com', phone: '+20 100 678 9012' },
    { type: 'customer', name: 'Smart Systems LLC', email: 'business@smartsys.com', phone: '+20 100 789 0123' },
    { type: 'customer', name: 'Future Tech Corp', email: 'contact@futuretech.eg', phone: '+20 100 890 1234' },
    { type: 'supplier', name: 'Premium Hardware', email: 'info@premiumhw.com', phone: '+20 100 901 2345' },
    { type: 'supplier', name: 'Global Distributors', email: 'sales@globaldist.com', phone: '+20 100 012 3456' },
  ];

  const parties = partyTemplates.slice(0, count).map((party, idx) => ({
    tenant_id: tenantId,
    type: party.type as 'customer' | 'supplier',
    name: party.name,
    email: party.email,
    phone: party.phone,
    contact_person: `Contact Person ${idx + 1}`,
    address: `${idx + 1} Business Street, Cairo, Egypt`,
    balance: 0,
  }));

  const { error } = await supabase.from('parties').insert(parties);

  if (error) throw error;
  console.log(`   ✓ Created ${parties.length} parties`);
}

/**
 * Seed inventory
 */
async function seedInventory(tenantId: string) {
  console.log('📊 Seeding inventory...');

  const { data: items } = await supabase
    .from('items')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(5);

  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id')
    .eq('tenant_id', tenantId);

  if (!items || !warehouses) {
    throw new Error('No items or warehouses found');
  }

  const inventory = [];
  for (const warehouse of warehouses) {
    for (const item of items) {
      inventory.push({
        tenant_id: tenantId,
        item_id: item.id,
        warehouse_id: warehouse.id,
        quantity: Math.floor(Math.random() * 100) + 20,
        reserved_quantity: Math.floor(Math.random() * 10),
        reorder_point: 10,
      });
    }
  }

  const { error } = await supabase.from('inventory').upsert(
    inventory,
    { onConflict: 'tenant_id,item_id,warehouse_id' }
  );

  if (error) throw error;
  console.log(`   ✓ Created ${inventory.length} inventory records`);
}

/**
 * Seed invoices
 */
async function seedInvoices(tenantId: string, count: number) {
  console.log(`📄 Seeding ${count} invoices...`);

  const { data: items } = await supabase
    .from('items')
    .select('id, price, cost')
    .eq('tenant_id', tenantId)
    .limit(5);

  const { data: customers } = await supabase
    .from('parties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'customer')
    .limit(3);

  const { data: suppliers } = await supabase
    .from('parties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'supplier')
    .limit(3);

  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!items || !customers || !suppliers || !warehouses) {
    throw new Error('Missing required data for invoices');
  }

  const invoices = [];
  const salesCount = Math.ceil(count * 0.6);
  const purchaseCount = count - salesCount;

  // Sales invoices
  for (let i = 0; i < salesCount; i++) {
    const customer = customers[i % customers.length];
    const selectedItems = [items[i % items.length], items[(i + 1) % items.length]];

    const invoiceItems = selectedItems.map(item => ({
      item_id: item.id,
      quantity: Math.floor(Math.random() * 5) + 1,
      price: item.price,
      discount_percentage: Math.random() > 0.7 ? 5 : 0,
    }));

    const subtotal = invoiceItems.reduce((sum, item) => {
      const itemTotal = item.quantity * item.price;
      const discount = itemTotal * (item.discount_percentage / 100);
      return sum + itemTotal - discount;
    }, 0);

    const tax = subtotal * 0.14;
    const total = subtotal + tax;

    invoices.push({
      tenant_id: tenantId,
      type: 'sale' as const,
      party_id: customer.id,
      warehouse_id: warehouses[0].id,
      invoice_number: `SAL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
      status: i % 3 === 0 ? 'draft' : 'posted',
      subtotal,
      tax,
      total,
      items: invoiceItems,
    });
  }

  // Purchase invoices
  for (let i = 0; i < purchaseCount; i++) {
    const supplier = suppliers[i % suppliers.length];
    const selectedItems = [items[i % items.length]];

    const invoiceItems = selectedItems.map(item => ({
      item_id: item.id,
      quantity: Math.floor(Math.random() * 10) + 5,
      price: item.cost,
      discount_percentage: 0,
    }));

    const subtotal = invoiceItems.reduce((sum, item) => {
      return sum + item.quantity * item.price;
    }, 0);

    const tax = subtotal * 0.14;
    const total = subtotal + tax;

    invoices.push({
      tenant_id: tenantId,
      type: 'purchase' as const,
      party_id: supplier.id,
      warehouse_id: warehouses[0].id,
      invoice_number: `PUR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
      status: 'posted',
      subtotal,
      tax,
      total,
      items: invoiceItems,
    });
  }

  for (const invoice of invoices) {
    const items = invoice.items;
    delete (invoice as any).items;

    const { data: createdInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(
        items.map(item => ({
          ...item,
          tenant_id: tenantId,
          invoice_id: createdInvoice.id,
        }))
      );

    if (itemsError) throw itemsError;
  }

  console.log(`   ✓ Created ${invoices.length} invoices`);
}

/**
 * Seed payments
 */
async function seedPayments(tenantId: string, count: number) {
  console.log(`💰 Seeding ${count} payments...`);

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, party_id, total, type')
    .eq('tenant_id', tenantId)
    .eq('status', 'posted')
    .limit(count);

  if (!invoices || invoices.length === 0) {
    console.log('   ⚠ No posted invoices found, skipping payments');
    return;
  }

  const payments = invoices.map((invoice, idx) => ({
    tenant_id: tenantId,
    type: invoice.type === 'sale' ? ('received' as const) : ('made' as const),
    party_id: invoice.party_id,
    amount: Math.random() > 0.5 ? invoice.total : invoice.total / 2,
    payment_method: ['cash', 'bank_transfer', 'check'][idx % 3] as 'cash' | 'bank_transfer' | 'check',
    reference_number: `PAY-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
    notes: `Payment for invoice`,
  }));

  const { error } = await supabase.from('payments').insert(payments);

  if (error) throw error;
  console.log(`   ✓ Created ${payments.length} payments`);
}

/**
 * Seed expenses
 */
async function seedExpenses(tenantId: string) {
  console.log('💸 Seeding expenses...');

  const { error: catError } = await supabase
    .from('expense_categories')
    .upsert([
      { tenant_id: tenantId, name: 'Office Rent', description: 'Monthly office rent' },
      { tenant_id: tenantId, name: 'Utilities', description: 'Electricity, water, internet' },
      { tenant_id: tenantId, name: 'Salaries', description: 'Employee salaries' },
    ], { onConflict: 'tenant_id,name' });

  if (catError) throw catError;

  const { data: categories } = await supabase
    .from('expense_categories')
    .select('id')
    .eq('tenant_id', tenantId);

  if (!categories) return;

  const expenses = categories.map((cat, idx) => ({
    tenant_id: tenantId,
    category_id: cat.id,
    amount: [5000, 1500, 25000][idx % 3],
    date: new Date().toISOString().split('T')[0],
    description: `Monthly ${['rent', 'utilities', 'salaries'][idx % 3]} payment`,
    payment_method: 'bank_transfer' as const,
  }));

  const { error } = await supabase.from('expenses').insert(expenses);

  if (error) throw error;
  console.log(`   ✓ Created ${expenses.length} expenses`);
}

/**
 * Seed transfers
 */
async function seedTransfers(tenantId: string) {
  console.log('🔄 Seeding transfers...');

  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(2);

  const { data: items } = await supabase
    .from('items')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(2);

  if (!warehouses || warehouses.length < 2 || !items) {
    console.log('   ⚠ Not enough warehouses or items, skipping transfers');
    return;
  }

  const transfers = [{
    tenant_id: tenantId,
    from_warehouse_id: warehouses[0].id,
    to_warehouse_id: warehouses[1].id,
    status: 'completed' as const,
    notes: 'Monthly stock transfer',
  }];

  const { data: createdTransfers, error: transferError } = await supabase
    .from('transfers')
    .insert(transfers)
    .select();

  if (transferError) throw transferError;

  const transferItems = items.map(item => ({
    tenant_id: tenantId,
    transfer_id: createdTransfers[0].id,
    item_id: item.id,
    quantity: 10,
  }));

  const { error: itemsError } = await supabase
    .from('transfer_items')
    .insert(transferItems);

  if (itemsError) throw itemsError;
  console.log(`   ✓ Created ${transfers.length} transfers`);
}

/**
 * Get data summary for tenant
 */
async function getDataSummary(tenantId: string) {
  const tables = [
    'parties',
    'items',
    'categories',
    'warehouses',
    'inventory',
    'invoices',
    'payments',
    'expenses',
    'transfers',
  ];

  const summary: Record<string, number> = {};

  for (const table of tables) {
    const { count } = await supabase
      .from(table as any)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    summary[table] = count || 0;
  }

  return summary;
}

// CLI execution
const args = process.argv.slice(2);
const mode = (args.find(arg => ['dev', 'demo', 'test'].includes(arg)) || 'dev') as 'dev' | 'demo' | 'test';
const tenantId = args.find(arg => arg.startsWith('--tenant-id='))?.split('=')[1];
const force = args.includes('--force');

seedDatabase({ mode, tenantId, force })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
