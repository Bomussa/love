import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 المراجعة الشاملة النهائية');
console.log('='.repeat(100));

const currentDir = path.join(__dirname, 'api/v1');
const backupDir = path.join(__dirname, 'manus-testing/cloudflare-backup/functions/api/v1');
const frontendDir = path.join(__dirname, 'src');

// ==================== 1. فحص التكرار ====================
console.log('\n📋 1. فحص التكرار في الملفات');
console.log('-'.repeat(100));

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('md5').update(content).digest('hex');
}

function getAllFiles(dir, baseDir = '', extensions = ['.js']) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath, extensions));
    } else {
      const ext = path.extname(item);
      if (extensions.includes(ext)) {
        files.push({
          path: relativePath,
          fullPath: fullPath,
          hash: getFileHash(fullPath),
          size: stat.size
        });
      }
    }
  });
  
  return files;
}

const currentFiles = getAllFiles(currentDir);
const backupFiles = getAllFiles(backupDir);

// فحص التكرار بالـ hash
const hashMap = new Map();
const duplicatesByHash = [];

[...currentFiles, ...backupFiles].forEach(file => {
  const key = `${file.path}`;
  if (!hashMap.has(file.hash)) {
    hashMap.set(file.hash, []);
  }
  hashMap.get(file.hash).push(file);
});

hashMap.forEach((files, hash) => {
  if (files.length > 1) {
    // تحقق إذا كانت نفس الملف في نفس المكان
    const uniquePaths = new Set(files.map(f => f.path));
    if (uniquePaths.size === 1) {
      // نفس الملف في Current و Backup - طبيعي
    } else {
      duplicatesByHash.push({
        hash: hash,
        files: files.map(f => ({ path: f.path, size: f.size }))
      });
    }
  }
});

if (duplicatesByHash.length > 0) {
  console.log(`⚠️  وجدت ${duplicatesByHash.length} مجموعة من الملفات المكررة (نفس المحتوى، مسارات مختلفة):`);
  duplicatesByHash.forEach((dup, i) => {
    console.log(`\n   ${i + 1}. Hash: ${dup.hash.substring(0, 8)}...`);
    dup.files.forEach(f => {
      console.log(`      - ${f.path} (${f.size} bytes)`);
    });
  });
} else {
  console.log('✅ لا يوجد تكرار في المحتوى (كل ملف فريد)');
}

// ==================== 2. فحص النقص ====================
console.log('\n\n📋 2. فحص النقص في الملفات');
console.log('-'.repeat(100));

const currentPaths = new Set(currentFiles.map(f => f.path));
const backupPaths = new Set(backupFiles.map(f => f.path));
const allPaths = new Set([...currentPaths, ...backupPaths]);

const missingInCurrent = [];
const missingInBackup = [];

allPaths.forEach(path => {
  if (!currentPaths.has(path)) {
    missingInCurrent.push(path);
  }
  if (!backupPaths.has(path)) {
    missingInBackup.push(path);
  }
});

console.log(`\n📊 الإحصائيات:`);
console.log(`   إجمالي Endpoints فريدة: ${allPaths.size}`);
console.log(`   في Current: ${currentFiles.length}`);
console.log(`   في Backup: ${backupFiles.length}`);
console.log(`   مفقودة في Current: ${missingInCurrent.length}`);
console.log(`   مفقودة في Backup (جديدة): ${missingInBackup.length}`);

if (missingInCurrent.length > 0) {
  console.log(`\n❌ ملفات مفقودة في Current (يجب نسخها):`);
  missingInCurrent.sort().forEach((p, i) => {
    const backupFile = backupFiles.find(f => f.path === p);
    console.log(`   ${i + 1}. ${p} (${backupFile.size} bytes)`);
  });
}

if (missingInBackup.length > 0) {
  console.log(`\n✨ ملفات جديدة في Current (غير موجودة في Backup):`);
  missingInBackup.sort().forEach((p, i) => {
    const currentFile = currentFiles.find(f => f.path === p);
    console.log(`   ${i + 1}. ${p} (${currentFile.size} bytes)`);
  });
}

// ==================== 3. فحص Frontend ====================
console.log('\n\n📋 3. فحص Frontend');
console.log('-'.repeat(100));

const frontendFiles = getAllFiles(frontendDir, '', ['.js', '.jsx', '.ts', '.tsx']);
console.log(`إجمالي ملفات Frontend: ${frontendFiles.length}`);

let backendLogicInFrontend = 0;
frontendFiles.forEach(file => {
  const content = fs.readFileSync(file.fullPath, 'utf-8');
  const hasKV = content.includes('KV_') || content.includes('env.KV');
  const hasSupabase = content.includes('supabase') && !content.includes('supabase.co');
  
  if (hasKV || hasSupabase) {
    backendLogicInFrontend++;
    console.log(`⚠️  ${file.path} - يحتوي على منطق Backend`);
  }
});

if (backendLogicInFrontend === 0) {
  console.log('✅ Frontend نظيف - لا يوجد منطق Backend');
}

// ==================== 4. فحص الترحيل ====================
console.log('\n\n📋 4. فحص حالة الترحيل');
console.log('-'.repeat(100));

let fullyMigrated = 0;
let partiallyMigrated = 0;
let needsMigration = 0;
let noStorage = 0;

const allEndpoints = [];

allPaths.forEach(endpointPath => {
  const currentPath = path.join(currentDir, endpointPath);
  const backupPath = path.join(backupDir, endpointPath);
  const filePath = fs.existsSync(currentPath) ? currentPath : backupPath;
  
  if (!fs.existsSync(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf-8');
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
    status = 'partially_migrated';
    partiallyMigrated++;
  } else if (kvCalls > 0 && supabaseCalls === 0) {
    status = 'needs_migration';
    needsMigration++;
  }
  
  allEndpoints.push({
    path: endpointPath,
    inCurrent: currentPaths.has(endpointPath),
    inBackup: backupPaths.has(endpointPath),
    kvCalls: kvCalls,
    supabaseCalls: supabaseCalls,
    status: status
  });
});

console.log(`\n📊 حالة الترحيل:`);
console.log(`   ✅ Fully Migrated: ${fullyMigrated} (${((fullyMigrated/allPaths.size)*100).toFixed(1)}%)`);
console.log(`   ⚠️  Partially Migrated: ${partiallyMigrated} (${((partiallyMigrated/allPaths.size)*100).toFixed(1)}%)`);
console.log(`   ❌ Needs Migration: ${needsMigration} (${((needsMigration/allPaths.size)*100).toFixed(1)}%)`);
console.log(`   ➖ No Storage: ${noStorage} (${((noStorage/allPaths.size)*100).toFixed(1)}%)`);

// ==================== 5. فحص Supabase ====================
console.log('\n\n📋 5. فحص قاعدة البيانات Supabase');
console.log('-'.repeat(100));

const supabaseFile = path.join(__dirname, 'functions/lib/supabase.js');
if (fs.existsSync(supabaseFile)) {
  console.log('✅ ملف Supabase Client موجود: functions/lib/supabase.js');
  const content = fs.readFileSync(supabaseFile, 'utf-8');
  if (content.includes('rujwuruuosffcxazymit.supabase.co')) {
    console.log('✅ URL صحيح: rujwuruuosffcxazymit.supabase.co');
  }
} else {
  console.log('❌ ملف Supabase Client غير موجود');
}

const apiSupabaseFile = path.join(__dirname, 'api/lib/supabase.js');
if (fs.existsSync(apiSupabaseFile)) {
  console.log('✅ ملف Supabase Client منسوخ في: api/lib/supabase.js');
} else {
  console.log('⚠️  ملف Supabase Client غير منسوخ في api/lib/ (يجب نسخه)');
}

// ==================== 6. الملخص النهائي ====================
console.log('\n\n' + '='.repeat(100));
console.log('📊 الملخص النهائي');
console.log('='.repeat(100));

const report = {
  timestamp: new Date().toISOString(),
  summary: {
    total_endpoints: allPaths.size,
    current_endpoints: currentFiles.length,
    backup_endpoints: backupFiles.length,
    missing_in_current: missingInCurrent.length,
    new_in_current: missingInBackup.length,
    duplicates: duplicatesByHash.length,
    frontend_files: frontendFiles.length,
    backend_logic_in_frontend: backendLogicInFrontend,
    migration: {
      fully_migrated: fullyMigrated,
      partially_migrated: partiallyMigrated,
      needs_migration: needsMigration,
      no_storage: noStorage
    }
  },
  missing_files: missingInCurrent.sort(),
  new_files: missingInBackup.sort(),
  duplicates: duplicatesByHash,
  all_endpoints: allEndpoints.sort((a, b) => a.path.localeCompare(b.path))
};

console.log(`\n✅ إجمالي Endpoints: ${report.summary.total_endpoints}`);
console.log(`   في Current: ${report.summary.current_endpoints}`);
console.log(`   في Backup: ${report.summary.backup_endpoints}`);
console.log(`\n❌ مفقودة في Current: ${report.summary.missing_in_current}`);
console.log(`✨ جديدة في Current: ${report.summary.new_in_current}`);
console.log(`⚠️  تكرارات: ${report.summary.duplicates}`);
console.log(`\n📱 Frontend: ${report.summary.frontend_files} ملف`);
console.log(`   منطق Backend في Frontend: ${report.summary.backend_logic_in_frontend}`);
console.log(`\n🔄 الترحيل:`);
console.log(`   ✅ مرحل بالكامل: ${report.summary.migration.fully_migrated}`);
console.log(`   ⚠️  مرحل جزئياً: ${report.summary.migration.partially_migrated}`);
console.log(`   ❌ يحتاج ترحيل: ${report.summary.migration.needs_migration}`);
console.log(`   ➖ لا يحتاج تخزين: ${report.summary.migration.no_storage}`);

// حفظ التقرير
fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'final-review.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n✅ التقرير محفوظ في: diagnostics/final-review.json');
console.log('='.repeat(100));

// ==================== 7. التحذيرات ====================
console.log('\n⚠️  التحذيرات والتوصيات:');
console.log('-'.repeat(100));

if (report.summary.missing_in_current > 0) {
  console.log(`❌ يجب نسخ ${report.summary.missing_in_current} ملف من Backup إلى Current`);
}

if (report.summary.migration.needs_migration > 0) {
  console.log(`❌ يجب ترحيل ${report.summary.migration.needs_migration} endpoint من KV إلى Supabase`);
}

if (report.summary.migration.fully_migrated === 0) {
  console.log(`❌ لم يتم ترحيل أي endpoint بعد - يجب البدء بالترحيل`);
}

if (report.summary.duplicates > 0) {
  console.log(`⚠️  يوجد ${report.summary.duplicates} مجموعة من الملفات المكررة - يجب المراجعة`);
}

if (!fs.existsSync(apiSupabaseFile)) {
  console.log(`⚠️  يجب نسخ functions/lib/supabase.js إلى api/lib/supabase.js`);
}

console.log('\n✅ المراجعة الشاملة مكتملة!');
