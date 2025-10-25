import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// البحث عن جميع ملفات API
const apiDir = path.join(__dirname, 'api/v1');
const results = {
  totalFiles: 0,
  migratedComplete: [],
  migratedButUsesKV: [],
  notMigrated: [],
  kvUsage: {},
  errors: []
};

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return;
  }
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath);
    } else if (file.endsWith('.js')) {
      results.totalFiles++;
      analyzeFile(filePath);
    }
  });
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(__dirname, filePath);
  
  const hasMigratedComment = /MIGRATED TO SUPABASE|MIGRATED/i.test(content);
  const hasSupabaseImport = /from ['"].*supabase/i.test(content);
  const hasSupabaseUsage = /supabase\./i.test(content) || /getSupabaseClient/i.test(content);
  
  // البحث عن استخدامات KV
  const kvMatches = content.match(/env\.KV[_A-Z]*\.(get|put|delete|list)/g) || [];
  const kvCount = kvMatches.length;
  
  if (kvCount > 0) {
    results.kvUsage[relativePath] = {
      count: kvCount,
      calls: kvMatches
    };
  }
  
  // تصنيف الملف
  if (hasMigratedComment && kvCount === 0 && hasSupabaseUsage) {
    results.migratedComplete.push(relativePath);
  } else if (hasMigratedComment && kvCount > 0) {
    results.migratedButUsesKV.push({
      file: relativePath,
      kvCalls: kvCount
    });
  } else if (!hasMigratedComment && kvCount > 0) {
    results.notMigrated.push({
      file: relativePath,
      kvCalls: kvCount
    });
  } else if (!hasMigratedComment && kvCount === 0) {
    // ملف بدون ترحيل وبدون KV - قد يكون لا يحتاج ترحيل
    results.notMigrated.push({
      file: relativePath,
      kvCalls: 0,
      note: 'No KV usage detected'
    });
  }
}

// تشغيل الفحص
try {
  scanDirectory(apiDir);
  
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE PROJECT AUDIT');
  console.log('='.repeat(80));
  console.log();
  
  console.log(`📊 Total API Files: ${results.totalFiles}`);
  console.log();
  
  console.log(`✅ Fully Migrated (No KV): ${results.migratedComplete.length}`);
  results.migratedComplete.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file}`);
  });
  console.log();
  
  console.log(`⚠️  Marked as Migrated but Still Uses KV: ${results.migratedButUsesKV.length}`);
  results.migratedButUsesKV.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.file} (${item.kvCalls} KV calls)`);
  });
  console.log();
  
  console.log(`❌ Not Migrated: ${results.notMigrated.length}`);
  results.notMigrated.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.file} (${item.kvCalls} KV calls)${item.note ? ' - ' + item.note : ''}`);
  });
  console.log();
  
  console.log('='.repeat(80));
  console.log('DETAILED KV USAGE');
  console.log('='.repeat(80));
  Object.entries(results.kvUsage).forEach(([file, data]) => {
    console.log(`\n${file}: ${data.count} calls`);
    data.calls.forEach(call => console.log(`  - ${call}`));
  });
  
  // حفظ النتائج
  fs.writeFileSync(
    path.join(__dirname, 'audit-results.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n✅ Results saved to audit-results.json');
  
} catch (error) {
  console.error('Error during audit:', error);
  process.exit(1);
}
