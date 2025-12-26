#!/usr/bin/env node

/**
 * Script to apply AI Agent migration to Supabase
 * Run: node scripts/apply-ai-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env') });

async function applyMigration() {
  console.log('🚀 Starting AI Agent migration...\n');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Read migration file
  const migrationPath = path.join(__dirname, '../packages/database/migrations/013_ai_agent_schema.sql');
  console.log(`📄 Reading migration file: ${migrationPath}\n`);

  let migrationSQL;
  try {
    migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  } catch (error) {
    console.error('❌ Error reading migration file:', error.message);
    process.exit(1);
  }

  console.log(`✅ Migration file loaded (${migrationSQL.length} characters)\n`);

  // Split the migration into individual statements
  // We need to execute them one by one because Supabase JS client doesn't support multi-statement SQL
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📊 Found ${statements.length} SQL statements to execute\n`);
  console.log('⚙️  Executing migration...\n');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments
    if (statement.startsWith('--') || statement.trim().length === 0) {
      continue;
    }

    // Extract a preview of the statement for logging
    const preview = statement.substring(0, 60).replace(/\n/g, ' ');
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

      if (error) {
        // If exec_sql doesn't exist, try direct execution
        console.log('\n⚠️  exec_sql function not available, using direct SQL execution via Postgres connection\n');
        throw new Error('Need to use Postgres connection directly');
      }

      console.log('✅');
      successCount++;
    } catch (error) {
      console.log('❌');
      console.error(`Error: ${error.message}\n`);
      errorCount++;

      // Continue with other statements
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully executed: ${successCount} statements`);
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} statements`);
  }
  console.log('='.repeat(60) + '\n');

  // Verify tables were created
  console.log('🔍 Verifying migration...\n');

  const expectedTables = [
    'ai_conversations',
    'ai_messages',
    'ai_documents',
    'ai_tasks',
    'ai_usage_records',
    'ai_audit_logs',
    'ai_configurations'
  ];

  for (const tableName of expectedTables) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);

    if (error) {
      console.log(`❌ Table ${tableName}: NOT FOUND (${error.message})`);
    } else {
      console.log(`✅ Table ${tableName}: EXISTS`);
    }
  }

  console.log('\n✨ Migration process completed!\n');
  console.log('⚠️  NOTE: If some statements failed, you may need to apply the migration');
  console.log('   directly via Supabase SQL Editor due to RPC limitations.\n');
}

applyMigration().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
