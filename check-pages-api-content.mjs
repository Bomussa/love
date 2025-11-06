import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 فحص محتوى ملفات src/pages/api');
console.log('='.repeat(100));

const pagesApiDir = path.join(__dirname, 'src/pages/api');
const apiV1Dir = path.join(__dirname, 'api/v1');

if (!fs.existsSync(pagesApiDir)) {
  console.log('❌ src/pages/api غير موجود');
  process.exit(1);
}

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
    } else if (item.endsWith('.js') || item.endsWith('.ts')) {
      files.push({
        path: relativePath,
        fullPath: fullPath,
        size: stat.size
      });
    }
  });
  
  return files;
}

const pagesApiFiles = getAllFiles(pagesApiDir);

console.log(`\nعدد ملفات src/pages/api: ${pagesApiFiles.length}\n`);

pagesApiFiles.forEach((file, index) => {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`📄 ${index + 1}. ${file.path}`);
  console.log(`${'='.repeat(100)}`);
  console.log(`الموقع: ${file.fullPath}`);
  console.log(`الحجم: ${file.size} bytes`);
  
  const content = fs.readFileSync(file.fullPath, 'utf-8');
  const lines = content.split('\n').length;
  console.log(`السطور: ${lines}`);
  
  // فحص المحتوى
  const hasKV = content.includes('env.KV') || content.includes('KV.get') || content.includes('KV.put');
  const hasSupabase = content.includes('supabase.from') || content.includes('getSupabaseClient');
  const hasExport = content.includes('export default') || content.includes('module.exports');
  
  console.log(`\nالتحليل:`);
  console.log(`  - يستخدم KV: ${hasKV ? '✅ نعم' : '❌ لا'}`);
  console.log(`  - يستخدم Supabase: ${hasSupabase ? '✅ نعم' : '❌ لا'}`);
  console.log(`  - يحتوي على export: ${hasExport ? '✅ نعم' : '❌ لا'}`);
  
  // البحث عن ملف مشابه في api/v1
  const baseName = path.basename(file.path);
  const possibleMatches = [];
  
  function findInApiV1(dir, baseDir = '') {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const relativePath = path.join(baseDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findInApiV1(fullPath, relativePath);
      } else if (item === baseName) {
        possibleMatches.push({
          path: relativePath,
          fullPath: fullPath
        });
      }
    });
  }
  
  findInApiV1(apiV1Dir);
  
  if (possibleMatches.length > 0) {
    console.log(`\n⚠️  يوجد ملف بنفس الاسم في api/v1:`);
    possibleMatches.forEach(match => {
      console.log(`  - ${match.path}`);
      
      const matchContent = fs.readFileSync(match.fullPath, 'utf-8');
      const matchHasKV = matchContent.includes('env.KV');
      const matchHasSupabase = matchContent.includes('supabase.from') || matchContent.includes('getSupabaseClient');
      
      console.log(`    - يستخدم KV: ${matchHasKV ? '✅' : '❌'}`);
      console.log(`    - يستخدم Supabase: ${matchHasSupabase ? '✅' : '❌'}`);
      
      // مقارنة المحتوى
      if (content.trim() === matchContent.trim()) {
        console.log(`    ⚠️  المحتوى متطابق تماماً - ملف مكرر!`);
      } else {
        console.log(`    ✅ المحتوى مختلف`);
      }
    });
  } else {
    console.log(`\n✅ لا يوجد ملف بنفس الاسم في api/v1`);
  }
  
  // عرض أول 20 سطر من المحتوى
  console.log(`\n📝 المحتوى (أول 20 سطر):`);
  console.log('-'.repeat(100));
  const contentLines = content.split('\n').slice(0, 20);
  contentLines.forEach((line, i) => {
    console.log(`${(i + 1).toString().padStart(3, ' ')} | ${line}`);
  });
  if (lines > 20) {
    console.log(`... (${lines - 20} سطر إضافي)`);
  }
});

console.log(`\n${'='.repeat(100)}`);
console.log('📊 الملخص');
console.log('='.repeat(100));

const summary = {
  total: pagesApiFiles.length,
  with_kv: 0,
  with_supabase: 0,
  duplicates: 0,
  unique: 0
};

pagesApiFiles.forEach(file => {
  const content = fs.readFileSync(file.fullPath, 'utf-8');
  const hasKV = content.includes('env.KV');
  const hasSupabase = content.includes('supabase.from') || content.includes('getSupabaseClient');
  
  if (hasKV) summary.with_kv++;
  if (hasSupabase) summary.with_supabase++;
  
  const baseName = path.basename(file.path);
  let foundMatch = false;
  
  function checkInApiV1(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        checkInApiV1(fullPath);
      } else if (item === baseName) {
        const matchContent = fs.readFileSync(fullPath, 'utf-8');
        if (content.trim() === matchContent.trim()) {
          foundMatch = true;
        }
      }
    });
  }
  
  checkInApiV1(apiV1Dir);
  
  if (foundMatch) {
    summary.duplicates++;
  } else {
    summary.unique++;
  }
});

console.log(`\nإجمالي الملفات: ${summary.total}`);
console.log(`يستخدم KV: ${summary.with_kv}`);
console.log(`يستخدم Supabase: ${summary.with_supabase}`);
console.log(`مكرر في api/v1: ${summary.duplicates}`);
console.log(`فريد (غير موجود في api/v1): ${summary.unique}`);

console.log('\n' + '='.repeat(100));

if (summary.duplicates > 0) {
  console.log(`\n⚠️  يوجد ${summary.duplicates} ملف مكرر - يمكن حذفها`);
} else {
  console.log('\n✅ جميع الملفات فريدة - لا يوجد تكرار');
}

if (summary.unique > 0) {
  console.log(`⚠️  يوجد ${summary.unique} ملف فريد - يجب الاحتفاظ بها`);
}
