# Database Migration Safety Guide

## Overview

This guide ensures safe database migrations and prevents accidental data loss scenarios like the one identified in `COMPREHENSIVE_SYSTEM_AUDIT_2026-01-05.md`.

## Critical Rules

### 1. Never Delete Data in Migrations

**❌ NEVER DO THIS:**
```sql
-- BAD: This will delete all tenant data
DROP TABLE IF EXISTS parties CASCADE;
CREATE TABLE parties (...);
```

**✅ ALWAYS DO THIS:**
```sql
-- GOOD: Only create if not exists
CREATE TABLE IF NOT EXISTS parties (...);

-- GOOD: Add columns safely
ALTER TABLE parties ADD COLUMN IF NOT EXISTS new_column TEXT;

-- GOOD: Modify with care
ALTER TABLE parties ALTER COLUMN existing_column TYPE VARCHAR(255);
```

### 2. Schema Changes Only in Migrations

Migrations should **ONLY** contain:
- Table creation (`CREATE TABLE IF NOT EXISTS`)
- Column additions (`ADD COLUMN IF NOT EXISTS`)
- Index creation (`CREATE INDEX IF NOT EXISTS`)
- Constraint additions
- Function/Trigger definitions

Migrations should **NEVER** contain:
- `TRUNCATE` statements
- `DELETE` statements (except for specific bad data)
- `DROP TABLE` without `IF EXISTS` check
- Data seeding (use seed scripts instead)

### 3. Use Transactions

Always wrap migrations in transactions:

```sql
BEGIN;

-- Your migration code here
CREATE TABLE IF NOT EXISTS new_table (...);

COMMIT;
```

### 4. Test Migrations Safely

Before running migrations on production:

1. **Backup First**: Always backup the database
2. **Test on Copy**: Run migration on a database copy
3. **Verify Data**: Check critical tables after migration
4. **Have Rollback Plan**: Know how to revert changes

## Data Seeding vs Migrations

### Migrations (Schema Only)
```sql
-- migrations/015_add_feature.sql
CREATE TABLE IF NOT EXISTS new_feature (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Seed Scripts (Data Only)
```typescript
// scripts/seed-data.ts
async function seedNewFeature(tenantId: string) {
  await supabase.from('new_feature').insert({
    tenant_id: tenantId,
    name: 'Default Feature'
  });
}
```

## Common Migration Patterns

### Adding a New Table

```sql
-- ✅ SAFE: Create table with proper checks
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_expense_categories_tenant
    ON expense_categories(tenant_id);
```

### Adding a Column

```sql
-- ✅ SAFE: Add column with default
ALTER TABLE parties
    ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- Add NOT NULL constraint later (after data migration)
-- Step 1: Add nullable column
-- Step 2: Populate data
-- Step 3: Add NOT NULL constraint if needed
```

### Modifying a Column

```sql
-- ✅ SAFE: Change column type carefully
-- Check data compatibility first!
ALTER TABLE items
    ALTER COLUMN sku TYPE VARCHAR(100);

-- If shrinking size, check existing data:
-- SELECT MAX(LENGTH(sku)) FROM items;
```

### Renaming a Table/Column

```sql
-- ⚠️ CAREFUL: This can break existing queries
ALTER TABLE old_name RENAME TO new_name;

-- Better: Create new table, migrate data, deprecate old
CREATE TABLE new_name AS SELECT * FROM old_name;
-- Update app code to use new_name
-- Keep old_name for compatibility
-- Drop old_name in future migration after confirming no usage
```

### Deleting a Column

```sql
-- ⚠️ CAREFUL: Data will be lost
-- Step 1: Ensure column is not used in application
-- Step 2: Remove from queries/code
-- Step 3: Drop in migration after deployed
ALTER TABLE items DROP COLUMN IF EXISTS deprecated_column;
```

## Migration Checklist

Before running a migration:

- [ ] Migration only contains schema changes
- [ ] All `CREATE` statements use `IF NOT EXISTS`
- [ ] No `TRUNCATE` or `DELETE` statements (unless documented)
- [ ] No `DROP` without `IF EXISTS` (and good reason)
- [ ] Foreign key relationships maintained
- [ ] Indexes created for foreign keys
- [ ] RLS policies updated if needed
- [ ] Migration wrapped in transaction
- [ ] Rollback script prepared
- [ ] Database backed up
- [ ] Tested on copy of production data

## Data Loss Prevention

### Automatic Checks

The system now includes data health monitoring:

```bash
# Check current data health
curl http://localhost:3001/api/v1/data-health

# Quick check for critical issues
curl http://localhost:3001/api/v1/data-health/quick

# Check if tenant is fresh (no data)
curl http://localhost:3001/api/v1/data-health/is-fresh
```

### Seed Scripts for Recovery

If data is lost, use seed scripts to restore:

```bash
# Development data (5-10 records per table)
pnpm seed:dev

# Demo data (10-20 records per table)
pnpm seed:demo

# Minimal test data
pnpm seed:test

# Seed specific tenant
pnpm seed:dev --tenant-id=<tenant-id>

# Force overwrite existing data
pnpm seed:dev --force
```

## Emergency Recovery

If data loss occurs:

1. **Don't Panic**: Stop any further migrations
2. **Check Backups**: Restore from most recent backup
3. **Use Seed Scripts**: If no backup, use seed scripts
4. **Verify Health**: Run health check to confirm
5. **Document Incident**: Record what happened and how to prevent

```bash
# Emergency recovery steps:

# 1. Check what's missing
curl http://localhost:3001/api/v1/data-health | jq

# 2. Seed missing data
pnpm seed:dev --tenant-id=<affected-tenant-id>

# 3. Verify recovery
curl http://localhost:3001/api/v1/data-health/quick | jq
```

## Development Workflow

### Safe Development Process

1. **Create Migration File**
   ```bash
   touch packages/database/migrations/016_feature_name.sql
   ```

2. **Write Schema Changes Only**
   ```sql
   -- Only schema changes, no data manipulation
   CREATE TABLE IF NOT EXISTS ...
   ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
   ```

3. **Create Seed Script Updates**
   ```typescript
   // Update scripts/seed-data.ts to include new data
   async function seedNewFeature() { ... }
   ```

4. **Test Locally**
   ```bash
   # Apply migration
   supabase db reset

   # Run seed script
   pnpm seed:dev

   # Verify
   curl http://localhost:3001/api/v1/data-health
   ```

5. **Deploy**
   ```bash
   # Production migration (schema only)
   supabase db push

   # Seed production data if needed (manually)
   ```

## Monitoring

### Set Up Alerts

Consider implementing alerts for:

- Critical tables becoming empty
- Sudden drop in record counts
- Failed migrations
- Data integrity violations

### Regular Health Checks

Run health checks periodically:

```bash
# Add to cron or scheduled task
0 */6 * * * curl http://localhost:3001/api/v1/data-health/scan-all | \
  jq '.data.unhealthy' | \
  mail -s "Data Health Alert" admin@example.com
```

## Best Practices Summary

1. ✅ **Separate concerns**: Schema (migrations) vs Data (seeds)
2. ✅ **Always use IF EXISTS/IF NOT EXISTS**: Idempotent migrations
3. ✅ **Test before production**: On database copy with production data
4. ✅ **Backup before migrations**: Always have rollback option
5. ✅ **Monitor data health**: Regular automated checks
6. ✅ **Document changes**: Clear migration descriptions
7. ✅ **Use transactions**: Atomic changes
8. ✅ **Version control**: All migrations in git
9. ✅ **No data in migrations**: Use seed scripts instead
10. ✅ **Plan rollbacks**: Know how to undo changes

## Related Documentation

- `COMPREHENSIVE_SYSTEM_AUDIT_2026-01-05.md` - Original data loss incident
- `packages/database/scripts/seed-data.ts` - Data seeding script
- `apps/api/src/services/data-health.service.ts` - Health monitoring
- `packages/database/migrations/` - All schema migrations

---

**Remember**: Migrations change structure, seeds create data. Never mix them!
