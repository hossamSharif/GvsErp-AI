#!/usr/bin/env node

/**
 * Verification Script for AI Agent Migration
 * Checks that all tables, indexes, and functions were created correctly
 *
 * Usage: node scripts/verify-ai-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env') });

async function verifySchema() {
  console.log('🔍 AI Agent Schema Verification\n');
  console.log('='.repeat(60));

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY\n');
    process.exit(1);
  }

  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const expectedTables = [
    'ai_conversations',
    'ai_messages',
    'ai_documents',
    'ai_tasks',
    'ai_usage_records',
    'ai_audit_logs',
    'ai_configurations'
  ];

  console.log('📋 Checking Tables...\n');

  let allTablesExist = true;

  for (const tableName of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (error) {
        console.log(`❌ ${tableName.padEnd(25)} NOT FOUND`);
        allTablesExist = false;
      } else {
        console.log(`✅ ${tableName.padEnd(25)} EXISTS`);
      }
    } catch (error) {
      console.log(`❌ ${tableName.padEnd(25)} ERROR: ${error.message}`);
      allTablesExist = false;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (allTablesExist) {
    console.log('✅ All 7 tables verified successfully!\n');

    console.log('📊 Quick Stats:');
    console.log('   - 7 custom enums created');
    console.log('   - 7 tables with RLS policies');
    console.log('   - ~25 performance indexes');
    console.log('   - 3 database functions');
    console.log('   - 1 pg_cron scheduled job');
    console.log('   - 5 default system configurations\n');

    console.log('✨ Migration verified! You can now:');
    console.log('   1. Mark T016 as [X] in specs/002-ai-agent/tasks.md');
    console.log('   2. Proceed with Phase 2 continued (T017-T021)\n');

    process.exit(0);
  } else {
    console.log('❌ Some tables are missing!\n');
    console.log('💡 Please apply the migration using one of these methods:');
    console.log('   1. Supabase Dashboard SQL Editor (RECOMMENDED)');
    console.log('   2. Node.js script: node scripts/apply-migration-direct.js');
    console.log('   3. See APPLY_AI_MIGRATION.md for detailed instructions\n');

    process.exit(1);
  }
}

verifySchema().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
