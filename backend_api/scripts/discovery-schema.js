#!/usr/bin/env node
/**
 * Discovery Script - Extract Real Schema from Supabase
 * استخراج Schema الحقيقي من قاعدة البيانات
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function introspectSchema() {
  console.log('🔍 Starting Schema Discovery...\n');
  
  const schema = {
    timestamp: new Date().toISOString(),
    database_url: SUPABASE_URL,
    tables: {},
    summary: {
      total_tables: 0,
      core_tables: [],
      queue_tables: [],
      route_tables: [],
      settings_tables: [],
      qa_tables: []
    }
  };

  try {
    // استعلام للحصول على جميع الجداول والأعمدة
    const { data: tables, error } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT 
            t.table_name,
            json_agg(
              json_build_object(
                'column_name', c.column_name,
                'data_type', c.data_type,
                'is_nullable', c.is_nullable,
                'column_default', c.column_default
              ) ORDER BY c.ordinal_position
            ) as columns
          FROM information_schema.tables t
          JOIN information_schema.columns c ON t.table_name = c.table_name
          WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          GROUP BY t.table_name
          ORDER BY t.table_name;
        `
      });

    if (error) {
      // طريقة بديلة: جلب الجداول واحدة واحدة
      console.log('⚠️  RPC failed, using alternative method...\n');
      await introspectTablesManually(schema);
    } else {
      tables.forEach(table => {
        schema.tables[table.table_name] = {
          columns: table.columns,
          row_count: 0
        };
      });
    }

    // تصنيف الجداول
    for (const tableName of Object.keys(schema.tables)) {
      if (tableName.includes('queue')) {
        schema.summary.queue_tables.push(tableName);
      } else if (tableName.includes('route') || tableName.includes('path')) {
        schema.summary.route_tables.push(tableName);
      } else if (tableName.includes('setting') || tableName.includes('config')) {
        schema.summary.settings_tables.push(tableName);
      } else if (tableName.includes('qa_') || tableName.includes('repair_')) {
        schema.summary.qa_tables.push(tableName);
      } else if (['clinics', 'pins', 'patients', 'notifications'].includes(tableName)) {
        schema.summary.core_tables.push(tableName);
      }
    }

    schema.summary.total_tables = Object.keys(schema.tables).length;

    // حفظ النتائج
    const artifactsDir = path.join(process.cwd(), 'artifacts');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const outputPath = path.join(artifactsDir, 'schema_snapshot.json');
    fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));

    console.log('✅ Schema Discovery Complete!\n');
    console.log(`📊 Total Tables: ${schema.summary.total_tables}`);
    console.log(`📦 Core Tables: ${schema.summary.core_tables.join(', ')}`);
    console.log(`🔄 Queue Tables: ${schema.summary.queue_tables.join(', ')}`);
    console.log(`🛤️  Route Tables: ${schema.summary.route_tables.join(', ')}`);
    console.log(`⚙️  Settings Tables: ${schema.summary.settings_tables.join(', ')}`);
    console.log(`🔬 QA Tables: ${schema.summary.qa_tables.join(', ') || 'None (will be created)'}\n`);
    console.log(`💾 Saved to: ${outputPath}\n`);

    return schema;
  } catch (error) {
    console.error('❌ Error during schema discovery:', error);
    throw error;
  }
}

async function introspectTablesManually(schema) {
  // قائمة الجداول المتوقعة
  const expectedTables = [
    'clinics', 'pins', 'patients', 'unified_queue', 'queues', 'queue',
    'routes', 'route_steps', 'pathways', 'patient_routes',
    'settings', 'system_settings', 'app_settings',
    'notifications', 'events', 'activity_logs',
    'qa_runs', 'qa_findings', 'repair_runs', 'repair_artifacts',
    'contract_snapshots', 'performance_snapshots'
  ];

  for (const tableName of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!error) {
        const columns = data && data.length > 0 ? 
          Object.keys(data[0]).map(key => ({
            column_name: key,
            data_type: typeof data[0][key],
            is_nullable: 'YES'
          })) : [];

        schema.tables[tableName] = {
          columns,
          exists: true
        };
        console.log(`✓ Found table: ${tableName}`);
      }
    } catch (e) {
      // الجدول غير موجود
    }
  }
}

// تشغيل
introspectSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
