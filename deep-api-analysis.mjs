import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 الفحص الشامل لملفات API');
console.log('='.repeat(100));

const apiDir = path.join(__dirname, 'api/v1');

function getAllFiles(dir, baseDir = '') {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else if (item.endsWith('.js')) {
      files.push({
        path: relativePath,
        fullPath: fullPath
      });
    }
  });
  
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const files = getAllFiles(apiDir);

console.log(`\nإجمالي الملفات: ${files.length}\n`);

const detailedAnalysis = [];

files.forEach((file, index) => {
  const content = fs.readFileSync(file.fullPath, 'utf-8');
  const lines = content.split('\n');
  
  // تحليل المحتوى
  const analysis = {
    index: index + 1,
    path: file.path,
    fullPath: file.fullPath,
    size: fs.statSync(file.fullPath).size,
    lines: lines.length,
    
    // KV Analysis
    kvCalls: {
      get: (content.match(/env\.KV[_A-Z]*\.get/g) || []).length,
      put: (content.match(/env\.KV[_A-Z]*\.put/g) || []).length,
      delete: (content.match(/env\.KV[_A-Z]*\.delete/g) || []).length,
      list: (content.match(/env\.KV[_A-Z]*\.list/g) || []).length,
      total: (content.match(/env\.KV[_A-Z]*\.(get|put|delete|list)/g) || []).length
    },
    
    // Supabase Analysis
    supabase: {
      from: (content.match(/supabase\.from/g) || []).length,
      rpc: (content.match(/supabase\.rpc/g) || []).length,
      auth: (content.match(/supabase\.auth/g) || []).length,
      total: (content.match(/supabase\.(from|rpc|auth)/g) || []).length,
      hasImport: content.includes('getSupabaseClient') || content.includes('supabase'),
      hasMigrated: content.includes('MIGRATED TO SUPABASE')
    },
    
    // Code Structure
    structure: {
      hasExport: content.includes('export default') || content.includes('module.exports'),
      hasAsync: content.includes('async'),
      hasAwait: content.includes('await'),
      hasTryCatch: content.includes('try') && content.includes('catch'),
      hasHandler: content.includes('handler') || content.includes('function'),
      hasRequest: content.includes('request'),
      hasResponse: content.includes('Response') || content.includes('res.'),
      hasJSON: content.includes('JSON.stringify') || content.includes('JSON.parse')
    },
    
    // Imports
    imports: {
      list: [],
      count: 0
    },
    
    // Functions
    functions: {
      list: [],
      count: 0
    },
    
    // HTTP Methods
    httpMethods: {
      GET: content.includes("method === 'GET'") || content.includes('req.method === "GET"'),
      POST: content.includes("method === 'POST'") || content.includes('req.method === "POST"'),
      PUT: content.includes("method === 'PUT'") || content.includes('req.method === "PUT"'),
      DELETE: content.includes("method === 'DELETE'") || content.includes('req.method === "DELETE"')
    },
    
    // Issues
    issues: [],
    warnings: [],
    
    // Status
    status: 'unknown'
  };
  
  // Extract imports
  const importMatches = content.match(/import\s+.*\s+from\s+['"].*['"]/g) || [];
  analysis.imports.list = importMatches;
  analysis.imports.count = importMatches.length;
  
  // Extract function names
  const functionMatches = content.match(/(?:function|const|let|var)\s+(\w+)\s*[=\(]/g) || [];
  analysis.functions.list = functionMatches.map(m => m.trim());
  analysis.functions.count = functionMatches.length;
  
  // Determine status
  if (analysis.kvCalls.total === 0 && analysis.supabase.total === 0) {
    analysis.status = 'no_storage';
  } else if (analysis.kvCalls.total === 0 && analysis.supabase.total > 0 && analysis.supabase.hasMigrated) {
    analysis.status = 'fully_migrated';
  } else if (analysis.kvCalls.total > 0 && analysis.supabase.total > 0) {
    analysis.status = 'partial_migration';
  } else if (analysis.kvCalls.total > 0 && analysis.supabase.total === 0) {
    analysis.status = 'needs_migration';
  }
  
  // Check for issues
  if (!analysis.structure.hasExport) {
    analysis.issues.push('لا يحتوي على export');
  }
  
  if (!analysis.structure.hasHandler) {
    analysis.issues.push('لا يحتوي على handler function');
  }
  
  if (!analysis.structure.hasTryCatch) {
    analysis.warnings.push('لا يحتوي على try-catch (معالجة أخطاء ضعيفة)');
  }
  
  if (analysis.kvCalls.total > 0 && !analysis.supabase.hasImport) {
    analysis.warnings.push('يستخدم KV ولكن لا يستورد Supabase');
  }
  
  if (analysis.size < 100) {
    analysis.warnings.push('حجم الملف صغير جداً (قد يكون فارغ)');
  }
  
  if (analysis.status === 'partial_migration') {
    analysis.issues.push('⚠️ ترحيل جزئي - يستخدم KV و Supabase معاً');
  }
  
  detailedAnalysis.push(analysis);
});

// Save detailed JSON
fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'deep-api-analysis.json'),
  JSON.stringify(detailedAnalysis, null, 2)
);

// Generate summary report
const summary = {
  total: files.length,
  byStatus: {
    needs_migration: detailedAnalysis.filter(a => a.status === 'needs_migration').length,
    fully_migrated: detailedAnalysis.filter(a => a.status === 'fully_migrated').length,
    partial_migration: detailedAnalysis.filter(a => a.status === 'partial_migration').length,
    no_storage: detailedAnalysis.filter(a => a.status === 'no_storage').length
  },
  totalKVCalls: detailedAnalysis.reduce((sum, a) => sum + a.kvCalls.total, 0),
  totalSupabaseCalls: detailedAnalysis.reduce((sum, a) => sum + a.supabase.total, 0),
  filesWithIssues: detailedAnalysis.filter(a => a.issues.length > 0).length,
  filesWithWarnings: detailedAnalysis.filter(a => a.warnings.length > 0).length,
  totalSize: detailedAnalysis.reduce((sum, a) => sum + a.size, 0),
  totalLines: detailedAnalysis.reduce((sum, a) => sum + a.lines, 0)
};

console.log('📊 الملخص الإحصائي');
console.log('='.repeat(100));
console.log(`إجمالي الملفات: ${summary.total}`);
console.log(`إجمالي الحجم: ${(summary.totalSize / 1024).toFixed(2)} KB`);
console.log(`إجمالي السطور: ${summary.totalLines}`);
console.log(`\nحسب الحالة:`);
console.log(`  - يحتاج ترحيل: ${summary.byStatus.needs_migration}`);
console.log(`  - مرحل بالكامل: ${summary.byStatus.fully_migrated}`);
console.log(`  - ترحيل جزئي: ${summary.byStatus.partial_migration}`);
console.log(`  - لا يحتاج تخزين: ${summary.byStatus.no_storage}`);
console.log(`\nاستدعاءات:`);
console.log(`  - إجمالي KV calls: ${summary.totalKVCalls}`);
console.log(`  - إجمالي Supabase calls: ${summary.totalSupabaseCalls}`);
console.log(`\nالمشاكل:`);
console.log(`  - ملفات بها أخطاء: ${summary.filesWithIssues}`);
console.log(`  - ملفات بها تحذيرات: ${summary.filesWithWarnings}`);

// Print files with issues
if (summary.filesWithIssues > 0) {
  console.log(`\n⚠️ الملفات التي بها أخطاء:`);
  detailedAnalysis.filter(a => a.issues.length > 0).forEach(a => {
    console.log(`\n${a.index}. ${a.path}`);
    a.issues.forEach(issue => {
      console.log(`   ❌ ${issue}`);
    });
  });
}

console.log('\n✅ التقرير التفصيلي محفوظ في: diagnostics/deep-api-analysis.json');
console.log('='.repeat(100));
