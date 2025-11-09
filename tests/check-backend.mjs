#!/usr/bin/env node
/**
 * فحص اتصال الباك اند (Supabase)
 * التحقق من:
 * 1. الاتصال بـ Supabase
 * 2. وجود الجداول المطلوبة
 * 3. البيانات الأساسية (admins, clinics)
 * 4. الـ API endpoints
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ألوان
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
}

async function checkConnection() {
  section('1. فحص الاتصال بـ Supabase');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    error('المتغيرات البيئية غير موجودة!');
    error('يرجى تعيين SUPABASE_URL و SUPABASE_ANON_KEY');
    return null;
  }
  
  info(`URL: ${SUPABASE_URL}`);
  info(`ANON_KEY: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // اختبار بسيط
    const { data, error: err } = await supabase.from('clinics').select('count', { count: 'exact', head: true });
    
    if (err) {
      error(`فشل الاتصال: ${err.message}`);
      return null;
    }
    
    success('الاتصال بـ Supabase نجح!');
    return supabase;
  } catch (err) {
    error(`خطأ في الاتصال: ${err.message}`);
    return null;
  }
}

async function checkTables(supabase) {
  section('2. فحص الجداول المطلوبة');
  
  const requiredTables = [
    'clinics',
    'patients', 
    'queues',
    'queue_history',
    'notifications',
    'pathways',
    'system_settings'
  ];
  
  let allTablesExist = true;
  
  for (const table of requiredTables) {
    try {
      const { error: err } = await supabase.from(table).select('count', { count: 'exact', head: true });
      
      if (err) {
        error(`الجدول ${table} غير موجود أو لا يمكن الوصول إليه`);
        allTablesExist = false;
      } else {
        success(`الجدول ${table} موجود`);
      }
    } catch (err) {
      error(`خطأ في فحص الجدول ${table}: ${err.message}`);
      allTablesExist = false;
    }
  }
  
  return allTablesExist;
}

async function checkAdmins(supabase) {
  section('3. فحص بيانات المسؤولين (Admins)');
  
  try {
    // استخدام service key إن وجد
    const client = SUPABASE_SERVICE_KEY 
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      : supabase;
    
    const { data: admins, error: err } = await client
      .from('admins')
      .select('id, username, role, name')
      .limit(5);
    
    if (err) {
      error(`فشل جلب بيانات المسؤولين: ${err.message}`);
      info('ملاحظة: قد يكون جدول admins غير موجود أو محمي بـ RLS');
      return false;
    }
    
    if (!admins || admins.length === 0) {
      error('لا يوجد مسؤولين في قاعدة البيانات!');
      info('يرجى إضافة مسؤول واحد على الأقل');
      return false;
    }
    
    success(`تم العثور على ${admins.length} مسؤول(ين)`);
    admins.forEach(admin => {
      info(`  - ${admin.username} (${admin.role}) - ${admin.name || 'لا يوجد اسم'}`);
    });
    
    return true;
  } catch (err) {
    error(`خطأ في فحص المسؤولين: ${err.message}`);
    return false;
  }
}

async function checkClinics(supabase) {
  section('4. فحص بيانات العيادات (Clinics)');
  
  try {
    const { data: clinics, error: err, count } = await supabase
      .from('clinics')
      .select('*', { count: 'exact' })
      .limit(10);
    
    if (err) {
      error(`فشل جلب بيانات العيادات: ${err.message}`);
      return false;
    }
    
    if (!clinics || clinics.length === 0) {
      error('لا توجد عيادات في قاعدة البيانات!');
      info('يرجى إضافة عيادة واحدة على الأقل');
      return false;
    }
    
    success(`تم العثور على ${count || clinics.length} عيادة`);
    clinics.slice(0, 5).forEach(clinic => {
      info(`  - ${clinic.name_ar || clinic.name} (${clinic.id})`);
    });
    
    return true;
  } catch (err) {
    error(`خطأ في فحص العيادات: ${err.message}`);
    return false;
  }
}

async function checkAPIEndpoints() {
  section('5. فحص API Endpoints');
  
  const API_BASE = process.env.API_BASE_URL || 'https://mmc-mms.com/api/v1';
  info(`API Base: ${API_BASE}`);
  
  const endpoints = [
    { path: '/status', method: 'GET', expected: 200 },
    { path: '/queue/status?clinicId=clinic-1', method: 'GET', expected: 200 }
  ];
  
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.status === endpoint.expected) {
        success(`${endpoint.method} ${endpoint.path} → ${res.status}`);
      } else {
        error(`${endpoint.method} ${endpoint.path} → ${res.status} (expected ${endpoint.expected})`);
        allPassed = false;
      }
    } catch (err) {
      error(`${endpoint.method} ${endpoint.path} → ${err.message}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

async function checkRealtimeConnection(supabase) {
  section('6. فحص Supabase Realtime');
  
  try {
    info('محاولة الاشتراك في قناة realtime...');
    
    let subscribed = false;
    const channel = supabase
      .channel('test-backend-check')
      .on('postgres_changes', { schema: 'public', table: 'queues', event: '*' }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed = true;
        }
      });
    
    // انتظر 3 ثوانٍ
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (subscribed) {
      success('Realtime يعمل بنجاح!');
      await supabase.removeChannel(channel);
      return true;
    } else {
      error('فشل الاشتراك في Realtime');
      return false;
    }
  } catch (err) {
    error(`خطأ في فحص Realtime: ${err.message}`);
    return false;
  }
}

async function main() {
  log('\n🔍 بدء فحص اتصال الباك اند', 'cyan');
  log(`🕐 الوقت: ${new Date().toISOString()}\n`, 'cyan');
  
  const results = {
    connection: false,
    tables: false,
    admins: false,
    clinics: false,
    api: false,
    realtime: false
  };
  
  // 1. فحص الاتصال
  const supabase = await checkConnection();
  if (!supabase) {
    log('\n❌ فشل الاتصال بـ Supabase!', 'red');
    process.exit(1);
  }
  results.connection = true;
  
  // 2. فحص الجداول
  results.tables = await checkTables(supabase);
  
  // 3. فحص المسؤولين
  results.admins = await checkAdmins(supabase);
  
  // 4. فحص العيادات
  results.clinics = await checkClinics(supabase);
  
  // 5. فحص API
  results.api = await checkAPIEndpoints();
  
  // 6. فحص Realtime
  results.realtime = await checkRealtimeConnection(supabase);
  
  // الملخص
  section('ملخص الفحص');
  
  const checks = [
    { name: 'الاتصال بـ Supabase', status: results.connection },
    { name: 'الجداول المطلوبة', status: results.tables },
    { name: 'بيانات المسؤولين', status: results.admins },
    { name: 'بيانات العيادات', status: results.clinics },
    { name: 'API Endpoints', status: results.api },
    { name: 'Realtime Connection', status: results.realtime }
  ];
  
  let passedCount = 0;
  checks.forEach(check => {
    if (check.status) {
      success(check.name);
      passedCount++;
    } else {
      error(check.name);
    }
  });
  
  const percentage = ((passedCount / checks.length) * 100).toFixed(1);
  log(`\n📊 النتيجة: ${passedCount}/${checks.length} (${percentage}%)`, 
    percentage >= 80 ? 'green' : 'yellow');
  
  if (percentage >= 80) {
    log('✅ الباك اند يعمل بشكل جيد!', 'green');
  } else {
    log('⚠️  الباك اند يحتاج إلى إصلاحات!', 'yellow');
  }
  
  process.exit(percentage >= 80 ? 0 : 1);
}

main().catch(err => {
  error(`خطأ فادح: ${err.message}`);
  console.error(err);
  process.exit(1);
});
