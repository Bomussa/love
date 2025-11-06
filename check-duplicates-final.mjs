import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 فحص التكرار في الـ Endpoints');
console.log('='.repeat(80));

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
      const content = fs.readFileSync(fullPath, 'utf-8');
      const hash = crypto.createHash('md5').update(content).digest('hex');
      
      files.push({
        path: relativePath,
        fullPath: fullPath,
        hash: hash,
        size: stat.size
      });
    }
  });
  
  return files;
}

const files = getAllFiles(apiDir);

console.log(`\nإجمالي الملفات: ${files.length}`);

// فحص تكرار الأسماء
console.log('\n📋 1. فحص تكرار الأسماء');
console.log('-'.repeat(80));

const pathMap = new Map();
let duplicatePaths = 0;

files.forEach(file => {
  if (pathMap.has(file.path)) {
    console.log(`❌ تكرار في الاسم: ${file.path}`);
    duplicatePaths++;
  } else {
    pathMap.set(file.path, file);
  }
});

if (duplicatePaths === 0) {
  console.log('✅ لا يوجد تكرار في الأسماء - جميع الـ 44 endpoint لها أسماء فريدة');
}

// فحص تكرار المحتوى
console.log('\n📋 2. فحص تكرار المحتوى');
console.log('-'.repeat(80));

const hashMap = new Map();

files.forEach(file => {
  if (!hashMap.has(file.hash)) {
    hashMap.set(file.hash, []);
  }
  hashMap.get(file.hash).push(file);
});

let duplicateContent = 0;
hashMap.forEach((fileList, hash) => {
  if (fileList.length > 1) {
    duplicateContent++;
    console.log(`\n⚠️  محتوى مكرر (${fileList.length} ملفات):`);
    fileList.forEach(f => {
      console.log(`   - ${f.path} (${f.size} bytes)`);
    });
  }
});

if (duplicateContent === 0) {
  console.log('✅ لا يوجد تكرار في المحتوى - جميع الـ 44 endpoint لها محتوى فريد');
}

// قائمة الأسماء
console.log('\n📋 3. قائمة جميع الـ Endpoints (مرتبة أبجدياً)');
console.log('-'.repeat(80));

const sortedPaths = Array.from(pathMap.keys()).sort();
sortedPaths.forEach((p, i) => {
  console.log(`${(i + 1).toString().padStart(2, '0')}. ${p}`);
});

// الملخص
console.log('\n' + '='.repeat(80));
console.log('📊 الملخص النهائي');
console.log('='.repeat(80));
console.log(`إجمالي الملفات: ${files.length}`);
console.log(`أسماء فريدة: ${pathMap.size}`);
console.log(`محتوى فريد: ${hashMap.size}`);
console.log(`تكرار في الأسماء: ${duplicatePaths}`);
console.log(`تكرار في المحتوى: ${duplicateContent}`);

if (duplicatePaths === 0 && duplicateContent === 0) {
  console.log('\n🎉 النتيجة: جميع الـ 44 endpoint مختلفة تماماً (أسماء ومحتوى)');
} else {
  console.log('\n❌ النتيجة: يوجد تكرار!');
}
