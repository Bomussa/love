import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Checkpoint 2.2: فحص التكرار في أسماء الملفات');
console.log('='.repeat(70));

// قراءة تقرير المقارنة
const comparisonReport = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'diagnostics', 'comparison-report.json'), 'utf-8')
);

const currentFiles = [
  ...comparisonReport.only_in_current,
  ...comparisonReport.common_files.map(f => f.path)
];

const missingFiles = comparisonReport.missing_in_current;

// فحص التكرار في الأسماء
const nameMap = new Map();

// إضافة الملفات الحالية
currentFiles.forEach(filePath => {
  const basename = path.basename(filePath);
  if (!nameMap.has(basename)) {
    nameMap.set(basename, []);
  }
  nameMap.get(basename).push({ path: filePath, source: 'current' });
});

// إضافة الملفات المفقودة
missingFiles.forEach(filePath => {
  const basename = path.basename(filePath);
  if (!nameMap.has(basename)) {
    nameMap.set(basename, []);
  }
  nameMap.get(basename).push({ path: filePath, source: 'missing' });
});

// البحث عن التكرارات
const conflicts = [];
nameMap.forEach((files, basename) => {
  if (files.length > 1) {
    conflicts.push({
      filename: basename,
      count: files.length,
      locations: files
    });
  }
});

console.log(`\n📊 نتائج الفحص:`);
console.log(`   إجمالي الأسماء الفريدة: ${nameMap.size}`);
console.log(`   ملفات بأسماء مكررة: ${conflicts.length}`);

if (conflicts.length > 0) {
  console.log(`\n⚠️  تكرارات محتملة:`);
  conflicts.forEach(conflict => {
    console.log(`\n   📄 ${conflict.filename} (${conflict.count} مواقع):`);
    conflict.locations.forEach(loc => {
      const status = loc.source === 'current' ? '✅ موجود' : '❌ مفقود';
      console.log(`      ${status}: ${loc.path}`);
    });
  });
  
  console.log(`\n⚠️  تحذير: عند نسخ الملفات المفقودة، قد يحدث تعارض!`);
  console.log(`   الحل: نسخ الملفات مع الحفاظ على البنية الكاملة للمجلدات`);
} else {
  console.log(`\n✅ لا توجد تكرارات في الأسماء`);
}

// حفظ التقرير
const report = {
  timestamp: new Date().toISOString(),
  checkpoint: '2.2',
  total_unique_names: nameMap.size,
  conflicts_count: conflicts.length,
  conflicts: conflicts
};

fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'name-conflicts-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(`\n✅ التقرير محفوظ في: diagnostics/name-conflicts-report.json`);
console.log('='.repeat(70));
