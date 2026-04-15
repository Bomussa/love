#!/usr/bin/env node
/**
 * اختبار الاتصال بقاعدة Supabase
 * بدون أي تعديل على الكود الأصلي
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

async function testConnection() {
  console.log('='.repeat(80));
  console.log('اختبار الاتصال بقاعدة Supabase');
  console.log('='.repeat(80));
  console.log();

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const results = {
    connection: false,
    tables: [],
    testInsert: false,
    testSelect: false,
    testUpdate: false,
    testDelete: false,
    errors: []
  };

  try {
    // 1. اختبار الاتصال الأساسي
    console.log('1️⃣ اختبار الاتصال الأساسي...');
    const { data: healthCheck, error: healthError } = await supabase
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

    // 2. الحصول على قائمة الجداول
    console.log('\n2️⃣ فحص الجداول الموجودة...');
    
    // محاولة الوصول لجدول test_crud
    const { data: testTable, error: testError } = await supabase
      .from('test_crud')
      .select('count')
      .limit(0);
    
    if (testError) {
      if (testError.code === '42P01') {
        console.log('   ℹ️  لا توجد جداول بعد (قاعدة بيانات جديدة)');
        results.tables = [];
      } else {
        console.log('   ⚠️  خطأ:', testError.message);
        results.errors.push({ step: 'tables', error: testError.message });
      }
    } else {
      console.log('   ✅ جدول test_crud موجود');
      results.tables.push({ table_name: 'test_crud' });
    }

    // 3. اختبار CRUD
    console.log('\n3️⃣ اختبار CRUD على جدول مؤقت...');
    console.log('   ℹ️  يتطلب إنشاء جدول test_crud يدوياً في Supabase Dashboard');
    console.log('   ℹ️  SQL: CREATE TABLE test_crud (id SERIAL PRIMARY KEY, test_field TEXT, created_at TIMESTAMPTZ);');

  } catch (error) {
    console.error('\n❌ خطأ عام:', error.message);
    results.errors.push({ step: 'general', error: error.message });
  }

  console.log('\n' + '='.repeat(80));
  console.log('ملخص النتائج');
  console.log('='.repeat(80));
  console.log(`الاتصال: ${results.connection ? '✅' : '❌'}`);
  console.log(`عدد الجداول: ${results.tables.length}`);
  console.log(`عدد الأخطاء: ${results.errors.length}`);
  console.log('='.repeat(80));

  // حفظ النتائج
  writeFileSync(
    __dirname + '/supabase-connection-result.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n📄 تم حفظ النتائج في: diagnostics/supabase-connection-result.json');

  return results;
}

testConnection()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
