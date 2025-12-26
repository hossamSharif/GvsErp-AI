#!/usr/bin/env node

/**
 * Direct Migration Application Script
 * Applies AI Agent migration directly to Supabase using pg library
 *
 * Usage: node scripts/apply-migration-direct.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/api/.env') });

async function applyMigration() {
  console.log('🚀 AI Agent Migration Application Script\n');
  console.log('='.repeat(60));

  // Check if pg is installed
  let pg;
  try {
    pg = require('pg');
  } catch (error) {
    console.error('❌ Error: pg library not found');
    console.error('   Please install it with: npm install pg');
    console.error('   Or use the Supabase Dashboard method (see APPLY_AI_MIGRATION.md)\n');
    process.exit(1);
  }

  const { Client } = pg;

  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    console.error('❌ Error: SUPABASE_URL not found in .env file\n');
    process.exit(1);
  }

  // Extract project ref from URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!projectRef) {
    console.error('❌ Error: Could not extract project reference from SUPABASE_URL\n');
    process.exit(1);
  }

  console.log(`📍 Project: ${projectRef}`);
  console.log(`📍 URL: ${supabaseUrl}\n`);

  // Construct connection string
  // You'll need to provide the database password
  console.log('⚠️  Database Password Required:');
  console.log('   Go to: Supabase Dashboard > Settings > Database');
  console.log('   Copy your database password\n');
  console.log('   Then set it as environment variable:');
  console.log('   export SUPABASE_DB_PASSWORD="your-password"\n');

  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!dbPassword) {
    console.error('❌ Error: SUPABASE_DB_PASSWORD not set');
    console.error('   Set it with: export SUPABASE_DB_PASSWORD="your-password"');
    console.error('   Or use the Supabase Dashboard method (see APPLY_AI_MIGRATION.md)\n');
    process.exit(1);
  }

  const connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  console.log('🔌 Connecting to database...\n');

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../packages/database/migrations/013_ai_agent_schema.sql');
    console.log(`📄 Reading migration: ${path.basename(migrationPath)}\n`);

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log(`📊 Migration size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);
    console.log(`📊 Lines: ${migrationSQL.split('\n').length}\n`);

    console.log('⚙️  Executing migration...\n');
    console.log('   This may take 10-30 seconds...\n');

    const startTime = Date.now();

    // Execute the entire migration as a single transaction
    await client.query('BEGIN');

    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('✅ Migration executed successfully!');
      console.log(`⏱️  Duration: ${duration}s\n`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    // Verify tables were created
    console.log('🔍 Verifying migration...\n');

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'ai_%'
      ORDER BY table_name;
    `);

    const expectedTables = [
      'ai_audit_logs',
      'ai_configurations',
      'ai_conversations',
      'ai_documents',
      'ai_messages',
      'ai_tasks',
      'ai_usage_records'
    ];

    console.log('📋 Tables created:');
    result.rows.forEach(row => {
      const isExpected = expectedTables.includes(row.table_name);
      console.log(`   ${isExpected ? '✅' : '⚠️ '} ${row.table_name}`);
    });

    const foundCount = result.rows.length;
    const expectedCount = expectedTables.length;

    console.log(`\n📊 Found ${foundCount}/${expectedCount} expected tables\n`);

    if (foundCount === expectedCount) {
      console.log('✨ Migration completed successfully!\n');
      console.log('Next steps:');
      console.log('1. Mark T016 as [X] in specs/002-ai-agent/tasks.md');
      console.log('2. Proceed with Phase 2 continued (TypeScript types)\n');
    } else {
      console.log('⚠️  Some tables may be missing. Please verify in Supabase Dashboard.\n');
    }

  } catch (error) {
    console.error('\n❌ Error during migration:');
    console.error(`   ${error.message}\n`);

    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }

    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }

    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if tables already exist (run: SELECT * FROM ai_conversations LIMIT 1)');
    console.error('   2. Verify database permissions');
    console.error('   3. Try using Supabase Dashboard SQL Editor instead\n');

    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
applyMigration().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
