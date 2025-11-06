import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 الفحص النهائي الشامل - Zero Tolerance');
console.log('='.repeat(100));

const errors = [];
const warnings = [];
const info = [];

function addError(msg) {
  errors.push(msg);
  console.log(`❌ ERROR: ${msg}`);
}

function addWarning(msg) {
  warnings.push(msg);
  console.log(`⚠️  WARNING: ${msg}`);
}

function addInfo(msg) {
  info.push(msg);
  console.log(`✅ INFO: ${msg}`);
}

// 1. فحص الملفات الأساسية
console.log('\n📋 1. فحص الملفات الأساسية');
console.log('-'.repeat(100));

const criticalFiles = [
  { path: 'package.json', required: true },
  { path: 'api/lib/supabase.js', required: true },
  { path: 'functions/lib/supabase.js', required: true },
  { path: 'vercel.json', required: true }
];

criticalFiles.forEach(file => {
  const fullPath = path.join(__dirname, file.path);
  if (fs.existsSync(fullPath)) {
    addInfo(`${file.path} موجود`);
  } else {
    if (file.required) {
      addError(`${file.path} مفقود`);
    } else {
      addWarning(`${file.path} مفقود`);
    }
  }
});

// 2. فحص package.json
console.log('\n📋 2. فحص package.json');
console.log('-'.repeat(100));

const pkgPath = path.join(__dirname, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  
  if (pkg.dependencies && pkg.dependencies['@supabase/supabase-js']) {
    addInfo(`@supabase/supabase-js موجودة في dependencies: ${pkg.dependencies['@supabase/supabase-js']}`);
  } else {
    addError('@supabase/supabase-js غير موجودة في dependencies');
  }
  
  if (pkg.devDependencies && pkg.devDependencies['@supabase/supabase-js']) {
    addWarning('@supabase/supabase-js موجودة في devDependencies (يجب أن تكون في dependencies فقط)');
  }
}

// 3. فحص جميع الـ Endpoints
console.log('\n📋 3. فحص جميع الـ Endpoints');
console.log('-'.repeat(100));

const apiDir = path.join(__dirname, 'api/v1');

function getAllFiles(dir, baseDir = '') {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else if (item.endsWith('.js')) {
      files.push({
        path: relativePath,
        fullPath: fullPath,
        hash: crypto.createHash('md5').update(fs.readFileSync(fullPath)).digest('hex')
      });
    }
  });
  
  return files;
}

const endpoints = getAllFiles(apiDir);
addInfo(`إجمالي Endpoints: ${endpoints.length}`);

if (endpoints.length !== 44) {
  addError(`عدد Endpoints خاطئ: ${endpoints.length} (المتوقع: 44)`);
} else {
  addInfo('عدد Endpoints صحيح: 44');
}

// 4. فحص التكرار
console.log('\n📋 4. فحص التكرار');
console.log('-'.repeat(100));

const hashMap = new Map();
const pathMap = new Map();

endpoints.forEach(file => {
  // فحص تكرار Hash
  if (!hashMap.has(file.hash)) {
    hashMap.set(file.hash, []);
  }
  hashMap.get(file.hash).push(file.path);
  
  // فحص تكرار Path
  if (pathMap.has(file.path)) {
    addError(`تكرار في المسار: ${file.path}`);
  } else {
    pathMap.set(file.path, true);
  }
});

let duplicateContent = 0;
hashMap.forEach((paths, hash) => {
  if (paths.length > 1) {
    duplicateContent++;
    addWarning(`محتوى مكرر (${paths.length} ملفات): ${paths.join(', ')}`);
  }
});

if (duplicateContent === 0) {
  addInfo('لا يوجد تكرار في المحتوى');
}

// 5. فحص حالة الترحيل
console.log('\n📋 5. فحص حالة الترحيل');
console.log('-'.repeat(100));

let needsMigration = 0;
let fullyMigrated = 0;
let partialMigration = 0;
let noStorage = 0;

const migrationDetails = [];

endpoints.forEach(file => {
  const content = fs.readFileSync(file.fullPath, 'utf-8');
  const kvCalls = (content.match(/env\.KV[_A-Z]*\.(get|put|delete|list)/g) || []).length;
  const supabaseCalls = (content.match(/supabase\.(from|rpc)/g) || []).length;
  const hasMigrated = content.includes('MIGRATED TO SUPABASE');
  
  let status = '';
  if (kvCalls === 0 && supabaseCalls === 0) {
    status = 'no_storage';
    noStorage++;
  } else if (kvCalls === 0 && supabaseCalls > 0 && hasMigrated) {
    status = 'fully_migrated';
    fullyMigrated++;
  } else if (kvCalls > 0 && supabaseCalls > 0) {
    status = 'partial_migration';
    partialMigration++;
  } else if (kvCalls > 0 && supabaseCalls === 0) {
    status = 'needs_migration';
    needsMigration++;
  }
  
  migrationDetails.push({
    path: file.path,
    kvCalls: kvCalls,
    supabaseCalls: supabaseCalls,
    status: status
  });
});

addInfo(`Fully Migrated: ${fullyMigrated}`);
addInfo(`Needs Migration: ${needsMigration}`);
addInfo(`Partial Migration: ${partialMigration}`);
addInfo(`No Storage: ${noStorage}`);

if (partialMigration > 0) {
  addError(`يوجد ${partialMigration} endpoint في حالة ترحيل جزئي (يستخدم KV و Supabase معاً)`);
}

// 6. فحص الـ Endpoints المطلوبة
console.log('\n📋 6. فحص الـ Endpoints المطلوبة');
console.log('-'.repeat(100));

const requiredEndpoints = [
  'admin/clinic-stats.js',
  'admin/edit-patient.js',
  'admin/export-report.js',
  'admin/live-feed.js',
  'admin/regenerate-pins.js',
  'admin/set-call-interval.js',
  'admin/status.js',
  'admin/system-settings.js',
  'admin/system-settings/reset.js',
  'clinic/exit.js',
  'cron/auto-call-next.js',
  'cron/daily-report.js',
  'cron/daily-reset.js',
  'cron/notify-poller.js',
  'cron/timeout-handler.js',
  'events/stream.js',
  'health/status.js',
  'notify/status.js',
  'path/choose.js',
  'patient/login.js',
  'patient/my-position.js',
  'patient/record.js',
  'patient/status.js',
  'patient/verify-pin.js',
  'pin/assign.js',
  'pin/generate.js',
  'pin/reset.js',
  'pin/status.js',
  'pin/verify.js',
  'queue/call.js',
  'queue/done.js',
  'queue/enter.js',
  'queue/enter-updated.js',
  'queue/position.js',
  'queue/status.js',
  'reports/annual.js',
  'reports/daily.js',
  'reports/monthly.js',
  'reports/weekly.js',
  'route/create.js',
  'route/get.js',
  'stats/dashboard.js',
  'stats/queues.js',
  'status.js'
];

const existingPaths = endpoints.map(e => e.path);
const missingEndpoints = [];

requiredEndpoints.forEach(req => {
  if (!existingPaths.includes(req)) {
    missingEndpoints.push(req);
    addError(`Endpoint مفقود: ${req}`);
  }
});

if (missingEndpoints.length === 0) {
  addInfo('جميع الـ 44 Endpoint موجودة');
}

// 7. فحص Syntax Errors
console.log('\n📋 7. فحص Syntax Errors');
console.log('-'.repeat(100));

let syntaxErrors = 0;
endpoints.forEach(file => {
  const content = fs.readFileSync(file.fullPath, 'utf-8');
  
  // فحص بسيط للـ syntax
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    syntaxErrors++;
    addError(`خطأ في Syntax (أقواس غير متطابقة) في: ${file.path}`);
  }
  
  // فحص export
  if (!content.includes('export default') && !content.includes('module.exports')) {
    addWarning(`لا يوجد export في: ${file.path}`);
  }
});

if (syntaxErrors === 0) {
  addInfo('لا يوجد أخطاء syntax واضحة');
}

// 8. الملخص النهائي
console.log('\n' + '='.repeat(100));
console.log('📊 الملخص النهائي');
console.log('='.repeat(100));

console.log(`\n✅ معلومات: ${info.length}`);
console.log(`⚠️  تحذيرات: ${warnings.length}`);
console.log(`❌ أخطاء: ${errors.length}`);

if (errors.length > 0) {
  console.log('\n❌ الأخطاء الحرجة:');
  errors.forEach((err, i) => {
    console.log(`   ${i + 1}. ${err}`);
  });
}

if (warnings.length > 0) {
  console.log('\n⚠️  التحذيرات:');
  warnings.forEach((warn, i) => {
    console.log(`   ${i + 1}. ${warn}`);
  });
}

// حفظ التقرير
const report = {
  timestamp: new Date().toISOString(),
  status: errors.length === 0 ? 'PASS' : 'FAIL',
  summary: {
    info_count: info.length,
    warning_count: warnings.length,
    error_count: errors.length,
    total_endpoints: endpoints.length,
    expected_endpoints: 44,
    needs_migration: needsMigration,
    fully_migrated: fullyMigrated,
    partial_migration: partialMigration,
    no_storage: noStorage
  },
  errors: errors,
  warnings: warnings,
  info: info,
  migration_details: migrationDetails,
  missing_endpoints: missingEndpoints
};

fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'ultimate-verification.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n✅ التقرير محفوظ في: diagnostics/ultimate-verification.json');
console.log('='.repeat(100));

if (errors.length === 0) {
  console.log('\n🎉 النتيجة: PASS - لا يوجد أخطاء!');
} else {
  console.log(`\n❌ النتيجة: FAIL - يوجد ${errors.length} خطأ!`);
}
