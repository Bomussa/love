#!/usr/bin/env node
/**
 * اختبار الاتصال بقاعدة Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

async function testConnection() {
  console.log('='.repeat(80));
  console.log('اختبار الاتصال بقاعدة Supabase');
  console.log('='.repeat(80));
  console.log();

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const results = {
    connection: false,
    tables: [],
    errors: []
  };

  try {
    console.log('1️⃣ اختبار الاتصال الأساسي...');

    const { error: healthError } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);

    if (healthError && healthError.code !== 'PGRST116') {
      console.log('   ⚠️  خطأ:', healthError.message);
      results.errors.push({ step: 'connection', error: healthError.message });
    } else {
      console.log('   ✅ الاتصال ناجح');
      results.connection = true;
    }

    console.log('\n2️⃣ فحص الجداول الموجودة...');

    const candidateTables = [
      'queue',
      'queues',
      'unified_queue',
      'patients',
      'clinics',
      'notifications',
      'pathways'
    ];

    for (const table of candidateTables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (!error || error.code !== '42P01') {
        results.tables.push(table);
        console.log(`   ✅ ${table}`);
      }
    }

  } catch (error) {
    console.error('\n❌ خطأ عام:', error.message);
    results.errors.push({ step: 'general', error: error.message });
  }

  console.log('\n' + '='.repeat(80));
  console.log('ملخص النتائج');
  console.log('='.repeat(80));
  console.log(`الاتصال: ${results.connection ? '✅' : '❌'}`);
  console.log(`الجداول المكتشفة: ${results.tables.join(', ') || 'لا يوجد'}`);
  console.log(`عدد الأخطاء: ${results.errors.length}`);
  console.log('='.repeat(80));

  writeFileSync(
    __dirname + '/supabase-connection-result.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n📄 تم حفظ النتائج في diagnostics/supabase-connection-result.json');

  return results;
}

testConnection()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });