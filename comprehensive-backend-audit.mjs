import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 فحص شامل للـ Backend');
console.log('='.repeat(80));

const currentDir = path.join(__dirname, 'api/v1');
const backupDir = path.join(__dirname, 'manus-testing/cloudflare-backup/functions/api/v1');

const report = {
  timestamp: new Date().toISOString(),
  backend: {
    current: {
      path: 'api/v1',
      total_files: 0,
      endpoints: [],
      by_category: {}
    },
    backup: {
      path: 'manus-testing/cloudflare-backup/functions/api/v1',
      total_files: 0,
      endpoints: [],
      by_category: {}
    },
    missing_in_current: [],
    only_in_current: [],
    comparison: {}
  }
};

function analyzeEndpoint(filePath, source) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const stat = fs.statSync(filePath);
  
  const kvCalls = (content.match(/env\.KV[_A-Z]*\.(get|put|delete|list)/g) || []).length;
  const hasMigrated = content.includes('MIGRATED TO SUPABASE');
  const hasSupabase = content.includes('getSupabaseClient') || content.includes('@supabase/supabase-js');
  const supabaseCalls = (content.match(/supabase\.(from|rpc)/g) || []).length;
  
  let status = 'unknown';
  if (hasMigrated && hasSupabase && supabaseCalls > 0 && kvCalls === 0) {
    status = 'fully_migrated';
  } else if (hasSupabase && kvCalls > 0) {
    status = 'partially_migrated';
  } else if (kvCalls > 0) {
    status = 'needs_migration';
  } else if (kvCalls === 0 && supabaseCalls === 0) {
    status = 'no_storage';
  }
  
  return {
    size: stat.size,
    lines: content.split('\n').length,
    kv_calls: kvCalls,
    has_migrated_marker: hasMigrated,
    has_supabase: hasSupabase,
    supabase_calls: supabaseCalls,
    status: status
  };
}

function scanBackend(dir, source) {
  const endpoints = [];
  const byCategory = {};
  
  if (!fs.existsSync(dir)) {
    return { endpoints, byCategory, total: 0 };
  }
  
  function scan(currentDir, baseDir = '') {
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const relativePath = path.join(baseDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath, relativePath);
      } else if (item.endsWith('.js')) {
        const category = baseDir.split(path.sep)[0] || 'root';
        
        if (!byCategory[category]) {
          byCategory[category] = [];
        }
        
        const analysis = analyzeEndpoint(fullPath, source);
        
        const endpoint = {
          path: relativePath,
          category: category,
          ...analysis
        };
        
        endpoints.push(endpoint);
        byCategory[category].push(relativePath);
      }
    });
  }
  
  scan(dir);
  
  return {
    endpoints,
    byCategory,
    total: endpoints.length
  };
}

// فحص Current
console.log('\n📂 فحص Current (api/v1)...');
const currentResult = scanBackend(currentDir, 'current');
report.backend.current.total_files = currentResult.total;
report.backend.current.endpoints = currentResult.endpoints;
report.backend.current.by_category = currentResult.byCategory;

// فحص Backup
console.log('📂 فحص Backup (functions/api/v1)...');
const backupResult = scanBackend(backupDir, 'backup');
report.backend.backup.total_files = backupResult.total;
report.backend.backup.endpoints = backupResult.endpoints;
report.backend.backup.by_category = backupResult.byCategory;

// المقارنة
const currentPaths = new Set(currentResult.endpoints.map(e => e.path));
const backupPaths = new Set(backupResult.endpoints.map(e => e.path));

backupResult.endpoints.forEach(endpoint => {
  if (!currentPaths.has(endpoint.path)) {
    report.backend.missing_in_current.push(endpoint);
  }
});

currentResult.endpoints.forEach(endpoint => {
  if (!backupPaths.has(endpoint.path)) {
    report.backend.only_in_current.push(endpoint);
  }
});

// إحصائيات الترحيل
const migrationStats = {
  current: {
    fully_migrated: 0,
    partially_migrated: 0,
    needs_migration: 0,
    no_storage: 0
  },
  backup: {
    fully_migrated: 0,
    partially_migrated: 0,
    needs_migration: 0,
    no_storage: 0
  }
};

currentResult.endpoints.forEach(e => {
  migrationStats.current[e.status]++;
});

backupResult.endpoints.forEach(e => {
  migrationStats.backup[e.status]++;
});

report.backend.migration_stats = migrationStats;

// عرض النتائج
console.log('\n📊 ملخص Backend:');
console.log(`\n   Current (api/v1):`);
console.log(`      إجمالي: ${report.backend.current.total_files} endpoint`);
console.log(`      ✅ Fully Migrated: ${migrationStats.current.fully_migrated}`);
console.log(`      ⚠️  Partially Migrated: ${migrationStats.current.partially_migrated}`);
console.log(`      ❌ Needs Migration: ${migrationStats.current.needs_migration}`);
console.log(`      ➖ No Storage: ${migrationStats.current.no_storage}`);

console.log(`\n   Backup (functions/api/v1):`);
console.log(`      إجمالي: ${report.backend.backup.total_files} endpoint`);
console.log(`      ✅ Fully Migrated: ${migrationStats.backup.fully_migrated}`);
console.log(`      ⚠️  Partially Migrated: ${migrationStats.backup.partially_migrated}`);
console.log(`      ❌ Needs Migration: ${migrationStats.backup.needs_migration}`);
console.log(`      ➖ No Storage: ${migrationStats.backup.no_storage}`);

console.log(`\n   المقارنة:`);
console.log(`      مفقودة في Current: ${report.backend.missing_in_current.length}`);
console.log(`      جديدة في Current: ${report.backend.only_in_current.length}`);

console.log('\n📁 التصنيف حسب المجلدات (Current):');
Object.keys(report.backend.current.by_category).sort().forEach(category => {
  const files = report.backend.current.by_category[category];
  console.log(`   ${category}: ${files.length} files`);
});

if (report.backend.missing_in_current.length > 0) {
  console.log('\n❌ ملفات مفقودة في Current:');
  report.backend.missing_in_current.forEach((endpoint, i) => {
    console.log(`   ${i + 1}. ${endpoint.path}`);
    console.log(`      Status: ${endpoint.status}, KV calls: ${endpoint.kv_calls}`);
  });
}

if (report.backend.only_in_current.length > 0) {
  console.log('\n✨ ملفات جديدة في Current (غير موجودة في Backup):');
  report.backend.only_in_current.forEach((endpoint, i) => {
    console.log(`   ${i + 1}. ${endpoint.path}`);
    console.log(`      Status: ${endpoint.status}, KV calls: ${endpoint.kv_calls}`);
  });
}

// حفظ التقرير
fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'backend-audit.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n✅ تقرير Backend محفوظ في: diagnostics/backend-audit.json');
console.log('='.repeat(80));
