import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🔍 Starting Full Project Inspection...\n');

const inspection = {
  header: {
    organization: "المركز الطبي التخصصي العسكري",
    report_type: "تقرير فحص وتحليل",
    generated_by: "Manus AI",
    supervised_by: "المهندس إياد",
    logo_path: "/assets/logo-mmc.png",
    timestamp: new Date().toISOString(),
    project_name: "love - Medical Committee System"
  },
  frontend: {
    path: "src/",
    files: [],
    total_files: 0,
    has_backend_logic: false,
    backend_logic_files: []
  },
  backend: {
    path: "api/",
    files: [],
    total_files: 0,
    endpoints: []
  },
  duplicates: [],
  conflicts: [],
  notes: []
};

// فحص Frontend
function inspectFrontend() {
  const frontendPath = path.join(projectRoot, 'src');
  if (!fs.existsSync(frontendPath)) {
    inspection.notes.push('⚠️ Frontend directory (src/) not found');
    return;
  }

  function scanDir(dir, baseDir = '') {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const relativePath = path.join(baseDir, file);

      if (stat.isDirectory()) {
        scanDir(filePath, relativePath);
      } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
        inspection.frontend.files.push(relativePath);
        inspection.frontend.total_files++;

        // فحص وجود منطق Backend
        const content = fs.readFileSync(filePath, 'utf-8');
        if (
          content.includes('KV_') ||
          content.includes('env.KV') ||
          content.includes('Cloudflare') ||
          content.includes('supabase.from(')
        ) {
          inspection.frontend.has_backend_logic = true;
          inspection.frontend.backend_logic_files.push(relativePath);
        }
      }
    });
  }

  scanDir(frontendPath);
  console.log(`✅ Frontend scanned: ${inspection.frontend.total_files} files`);
}

// فحص Backend
function inspectBackend() {
  const backendPath = path.join(projectRoot, 'api');
  if (!fs.existsSync(backendPath)) {
    inspection.notes.push('⚠️ Backend directory (api/) not found');
    return;
  }

  function scanDir(dir, baseDir = '') {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const relativePath = path.join(baseDir, file);

      if (stat.isDirectory()) {
        scanDir(filePath, relativePath);
      } else if (file.endsWith('.js')) {
        inspection.backend.files.push(relativePath);
        inspection.backend.total_files++;

        // تحليل Endpoint
        if (relativePath.startsWith('v1/')) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const kvMatches = content.match(/env\.KV[_A-Z]*\.(get|put|delete|list)/g) || [];
          const hasSupabase = /supabase\./i.test(content) || /getSupabaseClient/i.test(content);

          inspection.backend.endpoints.push({
            path: relativePath,
            kv_calls: kvMatches.length,
            uses_supabase: hasSupabase,
            status: kvMatches.length === 0 && hasSupabase ? 'migrated' : 
                    kvMatches.length > 0 && hasSupabase ? 'partial' : 
                    kvMatches.length > 0 ? 'needs_migration' : 'no_storage'
          });
        }
      }
    });
  }

  scanDir(backendPath);
  console.log(`✅ Backend scanned: ${inspection.backend.total_files} files`);
  console.log(`   Endpoints found: ${inspection.backend.endpoints.length}`);
}

// فحص التكرارات والتعارضات
function checkDuplicatesAndConflicts() {
  const fileMap = new Map();

  // جمع جميع الملفات
  [...inspection.frontend.files, ...inspection.backend.files].forEach(file => {
    const basename = path.basename(file);
    if (!fileMap.has(basename)) {
      fileMap.set(basename, []);
    }
    fileMap.get(basename).push(file);
  });

  // البحث عن التكرارات
  fileMap.forEach((paths, basename) => {
    if (paths.length > 1) {
      inspection.duplicates.push({
        filename: basename,
        locations: paths
      });
    }
  });

  console.log(`✅ Duplicates check: ${inspection.duplicates.length} found`);
}

// تشغيل الفحص
try {
  inspectFrontend();
  inspectBackend();
  checkDuplicatesAndConflicts();

  // إضافة ملاحظات نهائية
  if (inspection.frontend.has_backend_logic) {
    inspection.notes.push('⚠️ Backend logic detected in frontend files - needs separation');
  }

  const migratedCount = inspection.backend.endpoints.filter(e => e.status === 'migrated').length;
  const needsMigrationCount = inspection.backend.endpoints.filter(e => e.status === 'needs_migration').length;
  
  inspection.notes.push(`📊 Migration status: ${migratedCount} migrated, ${needsMigrationCount} need migration`);

  // حفظ النتائج
  const outputPath = path.join(__dirname, 'full-inspection.json');
  fs.writeFileSync(outputPath, JSON.stringify(inspection, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('📋 Inspection Summary:');
  console.log('='.repeat(60));
  console.log(`Frontend files: ${inspection.frontend.total_files}`);
  console.log(`Backend files: ${inspection.backend.total_files}`);
  console.log(`Endpoints: ${inspection.backend.endpoints.length}`);
  console.log(`Duplicates: ${inspection.duplicates.length}`);
  console.log(`Backend logic in frontend: ${inspection.frontend.has_backend_logic ? '⚠️ YES' : '✅ NO'}`);
  console.log('='.repeat(60));
  console.log(`\n✅ Report saved to: ${outputPath}`);

} catch (error) {
  console.error('❌ Inspection failed:', error.message);
  process.exit(1);
}
