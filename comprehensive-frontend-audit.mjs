import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 فحص شامل للـ Frontend');
console.log('='.repeat(80));

const srcDir = path.join(__dirname, 'src');
const report = {
  timestamp: new Date().toISOString(),
  frontend: {
    total_files: 0,
    by_type: {},
    backend_logic_files: [],
    api_calls: [],
    issues: [],
    structure: {}
  }
};

function scanDirectory(dir, baseDir = '', category = 'root') {
  if (!fs.existsSync(dir)) {
    report.frontend.issues.push(`Directory not found: ${dir}`);
    return;
  }

  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!report.frontend.structure[category]) {
        report.frontend.structure[category] = { folders: [], files: [] };
      }
      report.frontend.structure[category].folders.push(item);
      scanDirectory(fullPath, relativePath, item);
    } else {
      report.frontend.total_files++;
      
      const ext = path.extname(item);
      if (!report.frontend.by_type[ext]) {
        report.frontend.by_type[ext] = 0;
      }
      report.frontend.by_type[ext]++;
      
      if (!report.frontend.structure[category]) {
        report.frontend.structure[category] = { folders: [], files: [] };
      }
      report.frontend.structure[category].files.push(item);
      
      // فحص الملفات البرمجية
      if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // البحث عن منطق Backend
        const hasKV = content.includes('KV_') || content.includes('env.KV');
        const hasSupabase = content.includes('supabase') || content.includes('Supabase');
        const hasAPI = content.match(/fetch\s*\(['"](\/api\/|api\/)/g);
        const hasLocalStorage = content.includes('localStorage');
        const hasIndexedDB = content.includes('indexedDB') || content.includes('openDatabase');
        
        if (hasKV || hasSupabase) {
          report.frontend.backend_logic_files.push({
            path: relativePath,
            hasKV: hasKV,
            hasSupabase: hasSupabase,
            size: stat.size,
            lines: content.split('\n').length
          });
        }
        
        if (hasAPI) {
          const apiCalls = content.match(/fetch\s*\(['"](\/api\/[^'"]+)/g) || [];
          apiCalls.forEach(call => {
            const match = call.match(/['"]([^'"]+)['"]/);
            if (match) {
              report.frontend.api_calls.push({
                file: relativePath,
                endpoint: match[1]
              });
            }
          });
        }
        
        // فحص المشاكل المحتملة
        if (hasLocalStorage && hasSupabase) {
          report.frontend.issues.push({
            file: relativePath,
            issue: 'Uses both localStorage and Supabase - potential data sync issue'
          });
        }
      }
    }
  });
}

scanDirectory(srcDir);

// تحليل API calls
const apiEndpoints = {};
report.frontend.api_calls.forEach(call => {
  if (!apiEndpoints[call.endpoint]) {
    apiEndpoints[call.endpoint] = [];
  }
  apiEndpoints[call.endpoint].push(call.file);
});

report.frontend.api_endpoints_used = Object.keys(apiEndpoints).sort();
report.frontend.api_usage_count = report.frontend.api_calls.length;

// عرض النتائج
console.log('\n📊 ملخص Frontend:');
console.log(`   إجمالي الملفات: ${report.frontend.total_files}`);
console.log(`   ملفات بها منطق Backend: ${report.frontend.backend_logic_files.length}`);
console.log(`   استدعاءات API: ${report.frontend.api_usage_count}`);
console.log(`   Endpoints مستخدمة: ${report.frontend.api_endpoints_used.length}`);
console.log(`   مشاكل محتملة: ${report.frontend.issues.length}`);

console.log('\n📁 البنية:');
Object.keys(report.frontend.structure).forEach(category => {
  const struct = report.frontend.structure[category];
  console.log(`   ${category}:`);
  console.log(`      Folders: ${struct.folders.length}`);
  console.log(`      Files: ${struct.files.length}`);
});

if (report.frontend.backend_logic_files.length > 0) {
  console.log('\n⚠️  ملفات تحتوي على منطق Backend:');
  report.frontend.backend_logic_files.forEach(file => {
    console.log(`   - ${file.path}`);
    console.log(`     KV: ${file.hasKV}, Supabase: ${file.hasSupabase}`);
    console.log(`     Size: ${file.size} bytes, Lines: ${file.lines}`);
  });
}

if (report.frontend.api_endpoints_used.length > 0) {
  console.log('\n📡 API Endpoints المستخدمة في Frontend:');
  report.frontend.api_endpoints_used.forEach(endpoint => {
    const files = apiEndpoints[endpoint];
    console.log(`   ${endpoint} (used in ${files.length} files)`);
  });
}

if (report.frontend.issues.length > 0) {
  console.log('\n⚠️  مشاكل محتملة:');
  report.frontend.issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue.file || issue}`);
    if (issue.issue) console.log(`      ${issue.issue}`);
  });
}

// حفظ التقرير
fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'frontend-audit.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n✅ تقرير Frontend محفوظ في: diagnostics/frontend-audit.json');
console.log('='.repeat(80));
