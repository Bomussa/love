import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Checkpoint 2.1: مقارنة دقيقة للـ Endpoints');
console.log('='.repeat(70));

// المجلدات المراد مقارنتها
const currentDir = path.join(__dirname, 'api/v1');
const backupDir = path.join(__dirname, 'manus-testing/cloudflare-backup/functions/api/v1');

// جمع الملفات من كل مجلد
function collectFiles(dir, baseDir = '') {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, path.join(baseDir, item)));
    } else if (item.endsWith('.js')) {
      files.push({
        relativePath: path.join(baseDir, item),
        fullPath: fullPath,
        size: stat.size
      });
    }
  });
  
  return files;
}

const currentFiles = collectFiles(currentDir);
const backupFiles = collectFiles(backupDir);

console.log(`\n📊 إحصائيات:`);
console.log(`   Current (api/v1): ${currentFiles.length} files`);
console.log(`   Backup (functions/api/v1): ${backupFiles.length} files`);

// إنشاء خرائط للمقارنة
const currentMap = new Map(currentFiles.map(f => [f.relativePath, f]));
const backupMap = new Map(backupFiles.map(f => [f.relativePath, f]));

// تحديد الملفات المفقودة
const missingInCurrent = [];
backupFiles.forEach(file => {
  if (!currentMap.has(file.relativePath)) {
    missingInCurrent.push(file.relativePath);
  }
});

// تحديد الملفات الموجودة في الحالي فقط
const onlyInCurrent = [];
currentFiles.forEach(file => {
  if (!backupMap.has(file.relativePath)) {
    onlyInCurrent.push(file.relativePath);
  }
});

// تحديد الملفات المشتركة
const commonFiles = [];
currentFiles.forEach(file => {
  if (backupMap.has(file.relativePath)) {
    const backupFile = backupMap.get(file.relativePath);
    commonFiles.push({
      path: file.relativePath,
      currentSize: file.size,
      backupSize: backupFile.size,
      sizeDiff: file.size - backupFile.size
    });
  }
});

// عرض النتائج
console.log(`\n❌ ملفات مفقودة في Current (موجودة في Backup فقط): ${missingInCurrent.length}`);
if (missingInCurrent.length > 0) {
  missingInCurrent.sort().forEach(f => console.log(`   - ${f}`));
}

console.log(`\n✨ ملفات جديدة في Current (غير موجودة في Backup): ${onlyInCurrent.length}`);
if (onlyInCurrent.length > 0) {
  onlyInCurrent.sort().forEach(f => console.log(`   - ${f}`));
}

console.log(`\n🔄 ملفات مشتركة: ${commonFiles.length}`);
const differentSizes = commonFiles.filter(f => f.sizeDiff !== 0);
console.log(`   - نفس الحجم: ${commonFiles.length - differentSizes.length}`);
console.log(`   - حجم مختلف: ${differentSizes.length}`);

if (differentSizes.length > 0 && differentSizes.length <= 10) {
  console.log(`\n⚠️  ملفات بأحجام مختلفة:`);
  differentSizes.forEach(f => {
    const diff = f.sizeDiff > 0 ? `+${f.sizeDiff}` : f.sizeDiff;
    console.log(`   - ${f.path} (${diff} bytes)`);
  });
}

// حفظ التقرير
const report = {
  timestamp: new Date().toISOString(),
  checkpoint: '2.1',
  summary: {
    current_total: currentFiles.length,
    backup_total: backupFiles.length,
    missing_in_current: missingInCurrent.length,
    only_in_current: onlyInCurrent.length,
    common: commonFiles.length,
    different_sizes: differentSizes.length
  },
  missing_in_current: missingInCurrent.sort(),
  only_in_current: onlyInCurrent.sort(),
  common_files: commonFiles.map(f => ({
    path: f.path,
    size_difference: f.sizeDiff
  }))
};

fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'comparison-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(`\n✅ التقرير محفوظ في: diagnostics/comparison-report.json`);
console.log('='.repeat(70));

// تحديد الإجراء التالي
console.log(`\n📋 الإجراء المقترح:`);
if (missingInCurrent.length > 0) {
  console.log(`   1. نسخ ${missingInCurrent.length} ملف مفقود من Backup`);
  console.log(`   2. فحص التكرار والتعارض`);
  console.log(`   3. تحديث MIGRATION_WORKLOG.md`);
} else {
  console.log(`   ✅ لا توجد ملفات مفقودة`);
}
