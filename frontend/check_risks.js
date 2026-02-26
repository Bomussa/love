const fs = require('fs');
const path = require('path');

console.log('=== فحص المخاطر قبل النشر ===\n');

// 1. فحص imports في AdminDashboardV2
const adminCode = fs.readFileSync('src/components/AdminDashboardV2.jsx', 'utf8');
const importRegex = /from ['"](\.[^'"]+)['"]/g;
let match;
const missing = [];
while ((match = importRegex.exec(adminCode)) !== null) {
  const importPath = match[1];
  const resolved = path.resolve('src/components', importPath);
  const exts = ['', '.js', '.jsx', '.ts', '.tsx'];
  const found = exts.some(ext => {
    try { fs.accessSync(resolved + ext); return true; } catch (e) { return false; }
  });
  if (!found) missing.push(importPath);
}
console.log('1. Imports في AdminDashboardV2:');
if (missing.length === 0) {
  console.log('   ✅ كل الـ imports موجودة');
} else {
  console.log('   ❌ مفقودة:', missing);
}

// 2. فحص table-proposal-system.js
const tpsCode = fs.readFileSync('src/lib/table-proposal-system.js', 'utf8');
const tpsImports = [];
const tpsImportRegex = /from ['"](\.[^'"]+)['"]/g;
while ((match = tpsImportRegex.exec(tpsCode)) !== null) {
  const importPath = match[1];
  const resolved = path.resolve('src/lib', importPath);
  const exts = ['', '.js', '.jsx'];
  const found = exts.some(ext => {
    try { fs.accessSync(resolved + ext); return true; } catch (e) { return false; }
  });
  if (!found) tpsImports.push(importPath);
}
console.log('\n2. Imports في table-proposal-system.js:');
if (tpsImports.length === 0) {
  console.log('   ✅ كل الـ imports موجودة');
} else {
  console.log('   ❌ مفقودة:', tpsImports);
}

// 3. فحص @supabase/supabase-js موجود في package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const hasSupa = pkg.dependencies && pkg.dependencies['@supabase/supabase-js'];
console.log('\n3. @supabase/supabase-js في package.json:');
console.log('   ' + (hasSupa ? '✅ موجود: ' + hasSupa : '❌ غير موجود'));

// 4. فحص تعارض exports في table-proposal-system
const exportMatches = tpsCode.match(/^export (const|function|async function|class|default)/gm) || [];
console.log('\n4. Exports في table-proposal-system.js:', exportMatches.length, 'export');

// 5. فحص DatabaseManagement في AdminDashboardV2 - هل تستخدم table-proposal-system؟
const usesProposal = adminCode.includes('table-proposal-system') || adminCode.includes('tableProposal');
console.log('\n5. table-proposal-system مُدمج في AdminDashboardV2:');
console.log('   ' + (usesProposal ? '✅ مُدمج' : '❌ غير مُدمج - يحتاج دمج'));

// 6. فحص db_change_log في AdminDashboardV2
const usesChangeLog = adminCode.includes('db_change_log');
console.log('\n6. db_change_log في AdminDashboardV2:');
console.log('   ' + (usesChangeLog ? '✅ مُستخدم' : '❌ غير مُستخدم - يحتاج دمج'));

// 7. فحص حجم AdminDashboardV2
const lines = adminCode.split('\n').length;
console.log('\n7. حجم AdminDashboardV2.jsx:', lines, 'سطر');
if (lines > 6000) {
  console.log('   ⚠️  تحذير: الملف كبير جداً - قد يبطئ البناء');
} else {
  console.log('   ✅ حجم مقبول');
}

// 8. فحص وجود ملفات .conflict_backup
const conflictFiles = [];
function findConflicts(dir) {
  try {
    fs.readdirSync(dir).forEach(f => {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) findConflicts(full);
      else if (f.endsWith('.conflict_backup')) conflictFiles.push(full);
    });
  } catch (e) {}
}
findConflicts('src');
console.log('\n8. ملفات .conflict_backup:');
if (conflictFiles.length === 0) {
  console.log('   ✅ لا توجد');
} else {
  console.log('   ⚠️  موجودة:', conflictFiles);
}

console.log('\n=== انتهى فحص المخاطر ===');
