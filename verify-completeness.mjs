import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 التحقق من اكتمال جميع المتطلبات');
console.log('='.repeat(100));

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

function check(name, condition, failMessage, successMessage) {
  if (condition) {
    checks.passed.push({ name, message: successMessage });
    console.log(`✅ ${name}: ${successMessage}`);
  } else {
    checks.failed.push({ name, message: failMessage });
    console.log(`❌ ${name}: ${failMessage}`);
  }
}

function warn(name, message) {
  checks.warnings.push({ name, message });
  console.log(`⚠️  ${name}: ${message}`);
}

console.log('\n📋 1. فحص الملفات الأساسية');
console.log('-'.repeat(100));

// 1.1 Supabase Client
const supabaseSource = path.join(__dirname, 'functions/lib/supabase.js');
const supabaseTarget = path.join(__dirname, 'api/lib/supabase.js');
check(
  'Supabase Client (Source)',
  fs.existsSync(supabaseSource),
  'ملف functions/lib/supabase.js غير موجود',
  'ملف functions/lib/supabase.js موجود'
);
check(
  'Supabase Client (Target)',
  fs.existsSync(supabaseTarget),
  'ملف api/lib/supabase.js غير موجود - يجب نسخه',
  'ملف api/lib/supabase.js موجود'
);

// 1.2 Package.json
const packageJson = path.join(__dirname, 'package.json');
check(
  'package.json',
  fs.existsSync(packageJson),
  'ملف package.json غير موجود',
  'ملف package.json موجود'
);

if (fs.existsSync(packageJson)) {
  const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
  check(
    'Supabase Dependency',
    pkg.dependencies && pkg.dependencies['@supabase/supabase-js'],
    'مكتبة @supabase/supabase-js غير موجودة في dependencies',
    `مكتبة @supabase/supabase-js موجودة (${pkg.dependencies['@supabase/supabase-js']})`
  );
}

// 1.3 Vercel Config
const vercelJson = path.join(__dirname, 'vercel.json');
check(
  'vercel.json',
  fs.existsSync(vercelJson),
  'ملف vercel.json غير موجود',
  'ملف vercel.json موجود'
);

console.log('\n📋 2. فحص Endpoints');
console.log('-'.repeat(100));

const currentDir = path.join(__dirname, 'api/v1');
const backupDir = path.join(__dirname, 'manus-testing/cloudflare-backup/functions/api/v1');

function getAllEndpoints(dir) {
  const endpoints = [];
  if (!fs.existsSync(dir)) return endpoints;
  
  function scan(currentDir, baseDir = '') {
    const items = fs.readdirSync(currentDir);
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const relativePath = path.join(baseDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath, relativePath);
      } else if (item.endsWith('.js')) {
        endpoints.push(relativePath);
      }
    });
  }
  
  scan(dir);
  return endpoints;
}

const currentEndpoints = getAllEndpoints(currentDir);
const backupEndpoints = getAllEndpoints(backupDir);
const allEndpoints = [...new Set([...currentEndpoints, ...backupEndpoints])];

console.log(`إجمالي Endpoints: ${allEndpoints.length}`);
console.log(`في Current: ${currentEndpoints.length}`);
console.log(`في Backup: ${backupEndpoints.length}`);

const missingInCurrent = backupEndpoints.filter(e => !currentEndpoints.includes(e));
check(
  'Endpoints الناقصة',
  missingInCurrent.length === 0,
  `يوجد ${missingInCurrent.length} endpoint ناقصة في Current`,
  'جميع الـ Endpoints موجودة في Current'
);

console.log('\n📋 3. فحص حالة الترحيل');
console.log('-'.repeat(100));

let needsMigration = 0;
let fullyMigrated = 0;
let noStorage = 0;

allEndpoints.forEach(endpoint => {
  const currentPath = path.join(currentDir, endpoint);
  const backupPath = path.join(backupDir, endpoint);
  const filePath = fs.existsSync(currentPath) ? currentPath : backupPath;
  
  if (!fs.existsSync(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const kvCalls = (content.match(/env\.KV[_A-Z]*\.(get|put|delete|list)/g) || []).length;
  const supabaseCalls = (content.match(/supabase\.(from|rpc)/g) || []).length;
  const hasMigrated = content.includes('MIGRATED TO SUPABASE');
  
  if (kvCalls === 0 && supabaseCalls === 0) {
    noStorage++;
  } else if (kvCalls === 0 && supabaseCalls > 0 && hasMigrated) {
    fullyMigrated++;
  } else if (kvCalls > 0) {
    needsMigration++;
  }
});

console.log(`✅ Fully Migrated: ${fullyMigrated}`);
console.log(`❌ Needs Migration: ${needsMigration}`);
console.log(`➖ No Storage: ${noStorage}`);

check(
  'الترحيل الكامل',
  needsMigration === 0,
  `يوجد ${needsMigration} endpoint تحتاج ترحيل من KV إلى Supabase`,
  'جميع الـ Endpoints مرحلة بالكامل'
);

console.log('\n📋 4. فحص Environment Variables');
console.log('-'.repeat(100));

warn(
  'Environment Variables',
  'يجب التأكد من إضافة SUPABASE_URL و SUPABASE_ANON_KEY في Vercel'
);

console.log('\n📋 5. فحص Frontend');
console.log('-'.repeat(100));

const srcDir = path.join(__dirname, 'src');
let frontendHasBackend = false;

function scanFrontend(dir) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanFrontend(fullPath);
    } else if (['.js', '.jsx', '.ts', '.tsx'].includes(path.extname(item))) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('env.KV')) {
        frontendHasBackend = true;
      }
    }
  });
}

scanFrontend(srcDir);

check(
  'Frontend نظيف',
  !frontendHasBackend,
  'Frontend يحتوي على منطق Backend (KV)',
  'Frontend نظيف - لا يحتوي على منطق Backend'
);

console.log('\n' + '='.repeat(100));
console.log('📊 الملخص النهائي');
console.log('='.repeat(100));

console.log(`\n✅ الفحوصات الناجحة: ${checks.passed.length}`);
console.log(`❌ الفحوصات الفاشلة: ${checks.failed.length}`);
console.log(`⚠️  التحذيرات: ${checks.warnings.length}`);

if (checks.failed.length > 0) {
  console.log('\n❌ المشاكل التي يجب حلها:');
  checks.failed.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.name}: ${f.message}`);
  });
}

if (checks.warnings.length > 0) {
  console.log('\n⚠️  التحذيرات:');
  checks.warnings.forEach((w, i) => {
    console.log(`   ${i + 1}. ${w.name}: ${w.message}`);
  });
}

console.log('\n' + '='.repeat(100));
console.log('🎯 الخطوات المطلوبة لجعل التطبيق يعمل 100%');
console.log('='.repeat(100));

const steps = [];

if (missingInCurrent.length > 0) {
  steps.push({
    step: 1,
    title: `نسخ ${missingInCurrent.length} endpoint مفقودة`,
    command: 'bash safe-copy-missing-files.sh',
    description: 'نسخ الملفات المفقودة من Backup إلى Current'
  });
}

if (!fs.existsSync(supabaseTarget)) {
  steps.push({
    step: steps.length + 1,
    title: 'نسخ Supabase Client',
    command: 'mkdir -p api/lib && cp functions/lib/supabase.js api/lib/supabase.js',
    description: 'نسخ ملف Supabase Client إلى مجلد api/lib'
  });
}

if (needsMigration > 0) {
  steps.push({
    step: steps.length + 1,
    title: `ترحيل ${needsMigration} endpoint`,
    command: 'يدوي - يتطلب تعديل كل ملف',
    description: 'ترحيل جميع الـ endpoints من KV إلى Supabase'
  });
}

steps.push({
  step: steps.length + 1,
  title: 'إضافة Environment Variables في Vercel',
  command: 'يدوي - عبر Vercel Dashboard',
  description: 'إضافة SUPABASE_URL و SUPABASE_ANON_KEY'
});

steps.push({
  step: steps.length + 1,
  title: 'النشر على Vercel',
  command: 'git push origin main',
  description: 'رفع التغييرات ونشر التطبيق'
});

steps.forEach(step => {
  console.log(`\n${step.step}. ${step.title}`);
  console.log(`   الأمر: ${step.command}`);
  console.log(`   الوصف: ${step.description}`);
});

// حفظ التقرير
const report = {
  timestamp: new Date().toISOString(),
  checks: checks,
  steps: steps,
  summary: {
    total_endpoints: allEndpoints.length,
    current_endpoints: currentEndpoints.length,
    missing_endpoints: missingInCurrent.length,
    needs_migration: needsMigration,
    fully_migrated: fullyMigrated,
    ready_to_deploy: checks.failed.length === 0 && needsMigration === 0
  }
};

fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'completeness-check.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n✅ التقرير محفوظ في: diagnostics/completeness-check.json');
console.log('='.repeat(100));

if (report.summary.ready_to_deploy) {
  console.log('\n🎉 التطبيق جاهز للنشر!');
} else {
  console.log(`\n⚠️  التطبيق غير جاهز - يجب إكمال ${steps.length} خطوة`);
}
