import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📝 إنشاء التقرير النهائي الشامل...');

const currentDir = path.join(__dirname, 'api/v1');
const backupDir = path.join(__dirname, 'manus-testing/cloudflare-backup/functions/api/v1');

function getAllEndpoints(dir) {
  const endpoints = [];
  
  function scan(currentDir, baseDir = '') {
    if (!fs.existsSync(currentDir)) return;
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const relativePath = path.join(baseDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath, relativePath);
      } else if (item.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const kvCalls = (content.match(/env\.KV[_A-Z]*\.(get|put|delete|list)/g) || []).length;
        const supabaseCalls = (content.match(/supabase\.(from|rpc)/g) || []).length;
        
        let status = 'no_storage';
        if (kvCalls > 0 && supabaseCalls === 0) status = 'needs_migration';
        else if (kvCalls === 0 && supabaseCalls > 0) status = 'migrated';
        else if (kvCalls > 0 && supabaseCalls > 0) status = 'partial';
        
        endpoints.push({
          path: relativePath,
          fullPath: fullPath,
          size: stat.size,
          lines: content.split('\n').length,
          kvCalls: kvCalls,
          supabaseCalls: supabaseCalls,
          status: status
        });
      }
    });
  }
  
  scan(dir);
  return endpoints.sort((a, b) => a.path.localeCompare(b.path));
}

const endpoints = getAllEndpoints(currentDir);

const needsMigration = endpoints.filter(e => e.status === 'needs_migration');
const migrated = endpoints.filter(e => e.status === 'migrated');
const noStorage = endpoints.filter(e => e.status === 'no_storage');

console.log(`\n📊 الإحصائيات:`);
console.log(`   إجمالي Endpoints: ${endpoints.length}`);
console.log(`   يحتاج ترحيل: ${needsMigration.length}`);
console.log(`   مرحل: ${migrated.length}`);
console.log(`   لا يحتاج تخزين: ${noStorage.length}`);

// حفظ البيانات
const reportData = {
  timestamp: new Date().toISOString(),
  summary: {
    total: endpoints.length,
    needs_migration: needsMigration.length,
    migrated: migrated.length,
    no_storage: noStorage.length
  },
  endpoints: endpoints,
  needs_migration_list: needsMigration,
  migrated_list: migrated,
  no_storage_list: noStorage
};

fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'final-report-data.json'),
  JSON.stringify(reportData, null, 2)
);

console.log('\n✅ البيانات محفوظة في: diagnostics/final-report-data.json');
