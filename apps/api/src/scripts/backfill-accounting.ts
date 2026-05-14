/**
 * Backfill historical accounting entries.
 *
 * Posts auto-generated journal entries for every finalized sale/purchase
 * invoice, payment, and expense that does NOT already have a posted entry
 * in journal_entries. Idempotent — the partial unique index added in
 * migration 021 ensures a re-run cannot double-post.
 *
 * Use cases:
 *   - One-shot historical catch-up after activating accounting on a tenant.
 *   - Recovery after a missed post (e.g. service was offline during a
 *     finalize event).
 *
 * Usage (from apps/api/):
 *   pnpm tsx src/scripts/backfill-accounting.ts --tenant <uuid> [--dry-run]
 *   pnpm tsx src/scripts/backfill-accounting.ts --all [--dry-run]
 *
 * Flags:
 *   --tenant <uuid>   Backfill only this tenant.
 *   --all             Backfill every tenant whose accounting module is
 *                     enabled (tenants.settings.modules.accounting.enabled).
 *   --dry-run         Report what would be posted, post nothing.
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY must be set (.env at repo root).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { AccountingService } from '../services/accounting.service';

interface CliArgs {
  tenantId?: string;
  all: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { all: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tenant') {
      out.tenantId = argv[++i];
    } else if (arg === '--all') {
      out.all = true;
    } else if (arg === '--dry-run') {
      out.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(__filename + '\n');
      console.log('Flags: --tenant <uuid> | --all | --dry-run');
      process.exit(0);
    }
  }
  if (!out.tenantId && !out.all) {
    console.error('Specify --tenant <uuid> or --all');
    process.exit(1);
  }
  return out;
}

interface Counts {
  sales: { eligible: number; posted: number; skipped: number; failed: number };
  purchases: { eligible: number; posted: number; skipped: number; failed: number };
  payments: { eligible: number; posted: number; skipped: number; failed: number };
  expenses: { eligible: number; posted: number; skipped: number; failed: number };
}

function emptyCounts(): Counts {
  return {
    sales: { eligible: 0, posted: 0, skipped: 0, failed: 0 },
    purchases: { eligible: 0, posted: 0, skipped: 0, failed: 0 },
    payments: { eligible: 0, posted: 0, skipped: 0, failed: 0 },
    expenses: { eligible: 0, posted: 0, skipped: 0, failed: 0 },
  };
}

type SupabaseSrv = ReturnType<typeof createClient<Database>>;

async function listEnabledTenants(supabase: SupabaseSrv): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, settings');
  if (error) throw error;
  return (data ?? [])
    .filter((t) => {
      const settings = (t.settings ?? {}) as Record<string, any>;
      return Boolean(settings?.modules?.accounting?.enabled);
    })
    .map((t) => t.id as string);
}

/**
 * Return finalized invoice ids that don't yet have a posted JE matching
 * (source_type, source_id). We page through the existing JEs once instead
 * of doing a NOT EXISTS subquery per invoice — Supabase's JS client doesn't
 * expose the latter cleanly.
 */
async function findUnpostedSources<T extends { id: string }>(
  supabase: SupabaseSrv,
  tenantId: string,
  sourceType: string,
  candidates: T[]
): Promise<T[]> {
  if (candidates.length === 0) return [];

  const { data, error } = await supabase
    .from('journal_entries')
    .select('source_id')
    .eq('tenant_id', tenantId)
    .eq('source_type', sourceType)
    .eq('is_posted', true);
  if (error) throw error;

  const alreadyPosted = new Set((data ?? []).map((r) => r.source_id));
  return candidates.filter((c) => !alreadyPosted.has(c.id));
}

async function backfillTenant(
  supabase: SupabaseSrv,
  tenantId: string,
  dryRun: boolean
): Promise<Counts> {
  const counts = emptyCounts();
  const accounting = new AccountingService(supabase);

  const enabled = await accounting.isEnabled(tenantId);
  if (!enabled) {
    console.log(`  [tenant ${tenantId}] accounting not enabled — skipping`);
    return counts;
  }

  // -------- Sales + purchases (both stored in `invoices`) --------
  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('id, type, total, subtotal, tax_amount, party_id, finalized_at, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'final');
  if (invErr) throw invErr;

  const finalSales = (invoices ?? []).filter((i) => i.type === 'sale');
  const finalPurchases = (invoices ?? []).filter((i) => i.type === 'purchase');

  const salesToPost = await findUnpostedSources(supabase, tenantId, 'sale', finalSales);
  counts.sales.eligible = salesToPost.length;

  for (const inv of salesToPost) {
    if (dryRun) {
      counts.sales.skipped++;
      continue;
    }
    try {
      const entryDate = inv.finalized_at
        ? String(inv.finalized_at).split('T')[0]
        : undefined;
      const result = await accounting.generateJournalEntryFromSale(
        tenantId,
        null,
        inv.id as string,
        {
          total: Number(inv.total ?? 0),
          subtotal: Number(inv.subtotal ?? 0),
          tax_amount: Number(inv.tax_amount ?? 0),
          party_id: (inv.party_id as string | null) ?? undefined,
        },
        entryDate
      );
      if (result) counts.sales.posted++;
      else counts.sales.skipped++;
    } catch (err) {
      counts.sales.failed++;
      console.error(`    sale ${inv.id}: ${(err as Error).message}`);
    }
  }

  const purchasesToPost = await findUnpostedSources(
    supabase,
    tenantId,
    'purchase',
    finalPurchases
  );
  counts.purchases.eligible = purchasesToPost.length;

  for (const inv of purchasesToPost) {
    if (dryRun) {
      counts.purchases.skipped++;
      continue;
    }
    try {
      const entryDate = inv.finalized_at
        ? String(inv.finalized_at).split('T')[0]
        : undefined;
      const result = await accounting.generateJournalEntryFromPurchase(
        tenantId,
        null,
        inv.id as string,
        {
          total: Number(inv.total ?? 0),
          subtotal: Number(inv.subtotal ?? 0),
          tax_amount: Number(inv.tax_amount ?? 0),
          party_id: (inv.party_id as string | null) ?? undefined,
        },
        entryDate
      );
      if (result) counts.purchases.posted++;
      else counts.purchases.skipped++;
    } catch (err) {
      counts.purchases.failed++;
      console.error(`    purchase ${inv.id}: ${(err as Error).message}`);
    }
  }

  // -------- Payments --------
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, type, amount, payment_date, party_id')
    .eq('tenant_id', tenantId);
  if (payErr) throw payErr;

  const paymentsToPost = await findUnpostedSources(
    supabase,
    tenantId,
    'payment',
    payments ?? []
  );
  counts.payments.eligible = paymentsToPost.length;

  for (const p of paymentsToPost) {
    if (dryRun) {
      counts.payments.skipped++;
      continue;
    }
    try {
      const result = await accounting.generateJournalEntryFromPayment(
        tenantId,
        null,
        p.id as string,
        {
          amount: Number(p.amount ?? 0),
          type: p.type as 'received' | 'made',
          party_id: (p.party_id as string | null) ?? undefined,
        },
        (p.payment_date as string | null) ?? undefined
      );
      if (result) counts.payments.posted++;
      else counts.payments.skipped++;
    } catch (err) {
      counts.payments.failed++;
      console.error(`    payment ${p.id}: ${(err as Error).message}`);
    }
  }

  // -------- Expenses --------
  const { data: expenses, error: expErr } = await supabase
    .from('expenses')
    .select('id, amount, category, expense_date')
    .eq('tenant_id', tenantId);
  if (expErr) throw expErr;

  const expensesToPost = await findUnpostedSources(
    supabase,
    tenantId,
    'expense',
    expenses ?? []
  );
  counts.expenses.eligible = expensesToPost.length;

  for (const e of expensesToPost) {
    if (dryRun) {
      counts.expenses.skipped++;
      continue;
    }
    try {
      const result = await accounting.generateJournalEntryFromExpense(
        tenantId,
        null,
        e.id as string,
        {
          amount: Number(e.amount ?? 0),
          category_name: (e.category as string) ?? 'expense',
        },
        (e.expense_date as string | null) ?? undefined
      );
      if (result) counts.expenses.posted++;
      else counts.expenses.skipped++;
    } catch (err) {
      counts.expenses.failed++;
      console.error(`    expense ${e.id}: ${(err as Error).message}`);
    }
  }

  return counts;
}

function printCounts(tenantId: string, counts: Counts, dryRun: boolean) {
  const verb = dryRun ? 'would post' : 'posted';
  console.log(`\n[tenant ${tenantId}]`);
  for (const [kind, c] of Object.entries(counts)) {
    if (c.eligible === 0 && c.posted === 0 && c.failed === 0) continue;
    console.log(
      `  ${kind.padEnd(10)} eligible=${c.eligible} ${verb}=${c.posted} skipped=${c.skipped} failed=${c.failed}`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tenants = args.tenantId
    ? [args.tenantId]
    : await listEnabledTenants(supabase);

  if (tenants.length === 0) {
    console.log('No tenants to process.');
    return;
  }

  console.log(
    `Backfilling ${tenants.length} tenant(s)${args.dryRun ? ' [DRY RUN]' : ''}`
  );

  for (const tenantId of tenants) {
    try {
      const counts = await backfillTenant(supabase, tenantId, args.dryRun);
      printCounts(tenantId, counts, args.dryRun);
    } catch (err) {
      console.error(`[tenant ${tenantId}] failed: ${(err as Error).message}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
