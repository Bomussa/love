import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Checkpoint 3.1: تحليل الملفات المكررة');
console.log('='.repeat(70));

const backupDir = path.join(__dirname, 'manus-testing/cloudflare-backup/functions/api/v1');
const currentDir = path.join(__dirname, 'api/v1');

// الملفات المكررة من التقرير السابق
const duplicates = {
  'status.js': [
    { path: 'status.js', exists: true },
    { path: 'admin/status.js', exists: true },
    { path: 'pin/status.js', exists: true },
    { path: 'queue/status.js', exists: true },
    { path: 'health/status.js', exists: false },
    { path: 'notify/status.js', exists: false },
    { path: 'patient/status.js', exists: false }
  ],
  'reset.js': [
    { path: 'admin/system-settings/reset.js', exists: false },
    { path: 'pin/reset.js', exists: false }
  ]
};

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('md5').update(content).digest('hex');
}

function analyzeFile(filePath, source) {
  const fullPath = source === 'current' 
    ? path.join(currentDir, filePath)
    : path.join(backupDir, filePath);
    
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const stats = fs.statSync(fullPath);
  
  return {
    path: filePath,
    source: source,
    size: stats.size,
    lines: content.split('\n').length,
    hash: getFileHash(fullPath),
    hasKV: (content.match(/env\.KV/g) || []).length,
    hasSupabase: content.includes('supabase') || content.includes('Supabase'),
    hasMigrated: content.includes('MIGRATED')
  };
}

const analysis = {};

Object.keys(duplicates).forEach(filename => {
  console.log(`\n📄 تحليل: ${filename}`);
  console.log('-'.repeat(70));
  
  const files = duplicates[filename];
  const fileAnalysis = [];
  
  files.forEach(file => {
    // فحص في Current
    const currentAnalysis = analyzeFile(file.path, 'current');
    if (currentAnalysis) {
      fileAnalysis.push(currentAnalysis);
      console.log(`   ✅ Current: ${file.path}`);
      console.log(`      Size: ${currentAnalysis.size} bytes, Lines: ${currentAnalysis.lines}`);
      console.log(`      KV: ${currentAnalysis.hasKV}, Supabase: ${currentAnalysis.hasSupabase}`);
    }
    
    // فحص في Backup
    const backupAnalysis = analyzeFile(file.path, 'backup');
    if (backupAnalysis && !currentAnalysis) {
      fileAnalysis.push(backupAnalysis);
      console.log(`   ❌ Missing (in Backup): ${file.path}`);
      console.log(`      Size: ${backupAnalysis.size} bytes, Lines: ${backupAnalysis.lines}`);
      console.log(`      KV: ${backupAnalysis.hasKV}, Supabase: ${backupAnalysis.hasSupabase}`);
    }
  });
  
  // فحص التطابق
  const hashes = [...new Set(fileAnalysis.map(f => f.hash))];
  console.log(`\n   📊 ملخص:`);
  console.log(`      إجمالي النسخ: ${fileAnalysis.length}`);
  console.log(`      نسخ فريدة (hash): ${hashes.length}`);
  
  if (hashes.length === 1) {
    console.log(`      ✅ جميع النسخ متطابقة`);
  } else {
    console.log(`      ⚠️  النسخ مختلفة - يحتاج مراجعة`);
  }
  
  analysis[filename] = {
    total: fileAnalysis.length,
    unique_hashes: hashes.length,
    files: fileAnalysis
  };
});

// حفظ التقرير
const report = {
  timestamp: new Date().toISOString(),
  checkpoint: '3.1',
  analysis: analysis
};

fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'duplicates-analysis.json'),
  JSON.stringify(report, null, 2)
);

console.log(`\n✅ التقرير محفوظ في: diagnostics/duplicates-analysis.json`);
console.log('='.repeat(70));

// التوصية
console.log(`\n📋 التوصية:`);
console.log(`   1. نسخ الملفات المفقودة من Backup`);
console.log(`   2. لا حاجة لدمج - الملفات في مجلدات مختلفة`);
console.log(`   3. كل ملف له غرض مختلف حسب موقعه`);
