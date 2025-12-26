# How to Apply AI Agent Migration

The migration file `packages/database/migrations/013_ai_agent_schema.sql` is ready to be applied to your Supabase database.

## Option 1: Using Supabase Dashboard (RECOMMENDED)

This is the easiest and most reliable method:

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/ahcwylvsjnsmbhtdeqws
   - Navigate to: **SQL Editor** (left sidebar)

2. **Create a New Query**
   - Click "+ New query" button

3. **Copy and Paste the Migration**
   - Open the file: `packages/database/migrations/013_ai_agent_schema.sql`
   - Copy ALL contents (Ctrl+A, Ctrl+C)
   - Paste into the SQL Editor

4. **Execute the Migration**
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for execution to complete (should take 5-10 seconds)

5. **Verify Success**
   - You should see "Success. No rows returned" message
   - Check the Tables section (left sidebar) - you should see 7 new tables:
     - `ai_conversations`
     - `ai_messages`
     - `ai_documents`
     - `ai_tasks`
     - `ai_usage_records`
     - `ai_audit_logs`
     - `ai_configurations`

## Option 2: Using psql Command Line

If you have PostgreSQL client installed:

```bash
# Get the connection string from your .env file
SUPABASE_URL=https://ahcwylvsjnsmbhtdeqws.supabase.co

# Execute the migration
psql "postgresql://postgres.ahcwylvsjnsmbhtdeqws:[YOUR_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -f packages/database/migrations/013_ai_agent_schema.sql
```

Replace `[YOUR_PASSWORD]` with your database password (found in Supabase Dashboard > Settings > Database > Connection string).

## Option 3: Using Node.js Script

Run the provided script (requires database connection):

```bash
# Install dependencies first
npm install pg

# Run the migration script
node scripts/apply-migration-direct.js
```

## Verification

After applying the migration, verify the tables were created:

1. **Via Supabase Dashboard:**
   - Go to: Table Editor (left sidebar)
   - You should see all 7 new AI tables listed

2. **Via SQL Query:**
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name LIKE 'ai_%'
   ORDER BY table_name;
   ```

   Expected output:
   ```
   ai_audit_logs
   ai_configurations
   ai_conversations
   ai_documents
   ai_messages
   ai_tasks
   ai_usage_records
   ```

3. **Check RLS Policies:**
   ```sql
   SELECT tablename, policyname
   FROM pg_policies
   WHERE tablename LIKE 'ai_%'
   ORDER BY tablename, policyname;
   ```

   You should see multiple policies for each table.

## Troubleshooting

### Error: "role does not exist"
- Make sure you're using the service_role key, not anon key
- Check your connection has proper permissions

### Error: "type already exists"
- The migration might have partially run
- Check which types/tables exist and comment out the already-created ones

### Error: "extension pg_cron does not exist"
- pg_cron might not be enabled on your Supabase plan
- You can skip the pg_cron section (lines 420-433) - cleanup can be done manually

## After Migration

Once the migration is successfully applied:

1. Update `specs/002-ai-agent/tasks.md` to mark T016 as completed: `[X]`
2. Proceed with the next phase (Phase 2 continued - TypeScript types and validation)
3. Run the verification script: `node scripts/verify-ai-schema.js`

## Need Help?

If you encounter any issues:
1. Check the Supabase logs in Dashboard > Logs
2. Verify your database connection string
3. Ensure the service role key has proper permissions
