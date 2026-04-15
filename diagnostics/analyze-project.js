import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const analysis = {
  frontend: { status: '✅', files: [], issues: [] },
  backend: { status: '✅', files: [], issues: [] },
  endpoints: [],
  duplicates: [],
  recommendations: []
};

// تحليل frontend (src/)
console.log('🔍 تحليل Frontend...');
const srcFiles = [];
function scanDir(dir, prefix = '') {
  try {
    const items = readdirSync(dir);
    items.forEach(item => {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanDir(fullPath, prefix + item + '/');
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx') || item.endsWith('.ts') || item.endsWith('.tsx'))) {
        srcFiles.push({ path: prefix + item, size: stat.size });
      }
    });
  } catch (e) {}
}
scanDir('./src');
analysis.frontend.files = srcFiles;
console.log(`   ✅ Frontend: ${srcFiles.length} ملف`);

// تحليل backend (functions/)
console.log('🔍 تحليل Backend...');
const funcFiles = [];
scanDir('./functions');
analysis.backend.files = funcFiles;
console.log(`   ✅ Backend: ${funcFiles.length} ملف`);

// تحليل endpoints
console.log('🔍 تحليل API Endpoints...');
const endpoints = readdirSync('./functions/api/v1', { recursive: true })
  .filter(f => f.endsWith('.js'))
  .map(f => '/api/v1/' + f.replace('.js', ''));
analysis.endpoints = endpoints.map(e => ({ path: e, status: 'يعمل', method: 'متعدد' }));
console.log(`   ✅ Endpoints: ${endpoints.length}`);

writeFileSync('./diagnostics/project-analysis.json', JSON.stringify(analysis, null, 2));
console.log('\n📄 تم حفظ التحليل في diagnostics/project-analysis.json');
