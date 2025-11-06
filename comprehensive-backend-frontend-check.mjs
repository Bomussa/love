import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 الفحص الشامل للباك اند والفرونت اند');
console.log('='.repeat(100));

const errors = [];
const warnings = [];
const info = [];

function addError(msg) {
  errors.push(msg);
  console.log(`❌ ${msg}`);
}

function addWarning(msg) {
  warnings.push(msg);
  console.log(`⚠️  ${msg}`);
}

function addInfo(msg) {
  info.push(msg);
  console.log(`✅ ${msg}`);
}

// ==================== 1. فحص ملفات الباك اند ====================
console.log('\n📋 1. فحص ملفات الباك اند (api/v1)');
console.log('-'.repeat(100));

const apiDir = path.join(__dirname, 'api/v1');

function getAllJsFiles(dir, baseDir = '') {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllJsFiles(fullPath, relativePath));
    } else if (item.endsWith('.js')) {
      files.push({
        path: relativePath,
        fullPath: fullPath,
        size: stat.size
      });
    }
  });
  
  return files;
}

const backendFiles = getAllJsFiles(apiDir);
addInfo(`إجمالي ملفات الباك اند: ${backendFiles.length}`);

if (backendFiles.length !== 44) {
  addError(`عدد ملفات الباك اند خاطئ: ${backendFiles.length} (المتوقع: 44)`);
} else {
  addInfo('عدد ملفات الباك اند صحيح: 44');
}

// فحص كل ملف باك اند
console.log('\n📋 1.1 فحص محتوى ملفات الباك اند');
console.log('-'.repeat(100));

let backendIssues = 0;

backendFiles.forEach(file => {
  const content = fs.readFileSync(file.fullPath, 'utf-8');
  
  // فحص الحجم
  if (file.size < 100) {
    addWarning(`${file.path} - حجم صغير جداً (${file.size} bytes)`);
    backendIssues++;
  }
  
  // فحص export
  if (!content.includes('export') && !content.includes('module.exports')) {
    addWarning(`${file.path} - لا يحتوي على export`);
  }
  
  // فحص function/handler
  if (!content.includes('function') && !content.includes('=>')) {
    addWarning(`${file.path} - لا يحتوي على function`);
    backendIssues++;
  }
});

if (backendIssues === 0) {
  addInfo('جميع ملفات الباك اند تبدو سليمة');
}

// ==================== 2. فحص الفرونت اند ====================
console.log('\n📋 2. فحص الفرونت اند (src)');
console.log('-'.repeat(100));

const srcDir = path.join(__dirname, 'src');
const frontendFiles = getAllJsFiles(srcDir);

// استثناء مجلد src/pages/api (هذا للـ API routes في Next.js/Vercel)
const frontendFilesFiltered = frontendFiles.filter(f => !f.path.startsWith('pages/api'));

addInfo(`إجمالي ملفات الفرونت اند: ${frontendFilesFiltered.length}`);

// فحص إذا كان الفرونت اند يحتوي على منطق باك اند
console.log('\n📋 2.1 فحص منطق الباك اند في الفرونت اند');
console.log('-'.repeat(100));

let backendLogicInFrontend = 0;

frontendFilesFiltered.forEach(file => {
  const content = fs.readFileSync(file.fullPath, 'utf-8');
  
  // فحص استخدام KV
  if (content.includes('env.KV') || content.includes('KV.get') || content.includes('KV.put')) {
    addError(`${file.path} - يحتوي على استدعاءات KV (منطق باك اند)`);
    backendLogicInFrontend++;
  }
  
  // فحص استدعاءات Supabase مباشرة (بدون API)
  if (content.includes('supabase.from') && !content.includes('// Client-side')) {
    // هذا قد يكون طبيعي في بعض الحالات (Supabase client-side)
    // لكن سنحذر فقط
  }
  
  // فحص استيراد ملفات الباك اند
  if (content.includes("from '../api/") || content.includes('from "../../api/')) {
    addWarning(`${file.path} - يستورد من مجلد api`);
  }
});

if (backendLogicInFrontend === 0) {
  addInfo('الفرونت اند نظيف - لا يحتوي على منطق باك اند');
} else {
  addError(`الفرونت اند يحتوي على ${backendLogicInFrontend} ملف به منطق باك اند`);
}

// ==================== 3. فحص src/pages/api ====================
console.log('\n📋 3. فحص src/pages/api (API routes في Vercel)');
console.log('-'.repeat(100));

const pagesApiDir = path.join(srcDir, 'pages/api');
if (fs.existsSync(pagesApiDir)) {
  const pagesApiFiles = getAllJsFiles(pagesApiDir);
  addInfo(`عدد ملفات src/pages/api: ${pagesApiFiles.length}`);
  
  if (pagesApiFiles.length > 0) {
    addWarning('يوجد ملفات في src/pages/api - قد تتعارض مع api/v1');
    pagesApiFiles.forEach(f => {
      console.log(`   - ${f.path}`);
    });
  }
} else {
  addInfo('src/pages/api غير موجود (جيد)');
}

// ==================== 4. فحص التعارض بين api/v1 و src ====================
console.log('\n📋 4. فحص التعارض بين api/v1 و src');
console.log('-'.repeat(100));

// فحص إذا كان يوجد ملفات بنفس الاسم
const backendPaths = new Set(backendFiles.map(f => path.basename(f.path)));
const frontendPaths = new Set(frontendFilesFiltered.map(f => path.basename(f.path)));

let conflicts = 0;
backendPaths.forEach(name => {
  if (frontendPaths.has(name) && name !== 'index.js') {
    addWarning(`تعارض محتمل: ${name} موجود في الباك اند والفرونت اند`);
    conflicts++;
  }
});

if (conflicts === 0) {
  addInfo('لا يوجد تعارض في أسماء الملفات');
}

// ==================== 5. فحص الملفات المطلوبة ====================
console.log('\n📋 5. فحص الملفات المطلوبة');
console.log('-'.repeat(100));

const requiredFiles = [
  'api/lib/supabase.js',
  'package.json',
  'vercel.json'
];

requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    addInfo(`${file} موجود`);
  } else {
    addError(`${file} مفقود`);
  }
});

// ==================== الملخص النهائي ====================
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
    backend_files: backendFiles.length,
    frontend_files: frontendFilesFiltered.length,
    backend_logic_in_frontend: backendLogicInFrontend,
    conflicts: conflicts,
    info_count: info.length,
    warning_count: warnings.length,
    error_count: errors.length
  },
  errors: errors,
  warnings: warnings,
  info: info
};

fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'backend-frontend-check.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n✅ التقرير محفوظ في: diagnostics/backend-frontend-check.json');
console.log('='.repeat(100));

if (errors.length === 0) {
  console.log('\n🎉 النتيجة: PASS - الباك اند والفرونت اند سليمان!');
} else {
  console.log(`\n❌ النتيجة: FAIL - يوجد ${errors.length} خطأ!`);
}
