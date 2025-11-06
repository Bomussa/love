import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 فحص تفصيلي لجميع API Endpoints');
console.log('='.repeat(100));

const currentDir = path.join(__dirname, 'api/v1');
const backupDir = path.join(__dirname, 'manus-testing/cloudflare-backup/functions/api/v1');

function analyzeEndpointDetailed(filePath, relativePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const stat = fs.statSync(filePath);
  const lines = content.split('\n');
  
  // تحليل دقيق
  const kvGetCalls = (content.match(/env\.KV[_A-Z]*\.get\(/g) || []).length;
  const kvPutCalls = (content.match(/env\.KV[_A-Z]*\.put\(/g) || []).length;
  const kvDeleteCalls = (content.match(/env\.KV[_A-Z]*\.delete\(/g) || []).length;
  const kvListCalls = (content.match(/env\.KV[_A-Z]*\.list\(/g) || []).length;
  const totalKvCalls = kvGetCalls + kvPutCalls + kvDeleteCalls + kvListCalls;
  
  const hasSupabaseImport = content.includes('getSupabaseClient') || 
                            content.includes('@supabase/supabase-js') ||
                            content.includes('from \'../lib/supabase');
  const supabaseFromCalls = (content.match(/supabase\.from\(/g) || []).length;
  const supabaseRpcCalls = (content.match(/supabase\.rpc\(/g) || []).length;
  const totalSupabaseCalls = supabaseFromCalls + supabaseRpcCalls;
  
  const hasMigratedMarker = content.includes('MIGRATED TO SUPABASE') || 
                            content.includes('MIGRATED') ||
                            content.includes('✅ Migrated');
  
  // استخراج HTTP method
  let httpMethod = 'UNKNOWN';
  if (content.includes('request.method === \'GET\'') || content.includes('req.method === \'GET\'')) {
    httpMethod = 'GET';
  } else if (content.includes('request.method === \'POST\'') || content.includes('req.method === \'POST\'')) {
    httpMethod = 'POST';
  } else if (content.includes('request.method === \'PUT\'') || content.includes('req.method === \'PUT\'')) {
    httpMethod = 'PUT';
  } else if (content.includes('request.method === \'DELETE\'') || content.includes('req.method === \'DELETE\'')) {
    httpMethod = 'DELETE';
  }
  
  // استخراج الجداول المستخدمة
  const tables = [];
  const tableMatches = content.matchAll(/supabase\.from\(['"]([^'"]+)['"]\)/g);
  for (const match of tableMatches) {
    if (!tables.includes(match[1])) {
      tables.push(match[1]);
    }
  }
  
  // تحديد الحالة
  let status = 'unknown';
  let statusEmoji = '❓';
  let needsMigration = false;
  let reason = '';
  
  if (totalKvCalls === 0 && totalSupabaseCalls === 0) {
    status = 'no_storage';
    statusEmoji = '➖';
    needsMigration = false;
    reason = 'لا يستخدم تخزين بيانات';
  } else if (totalKvCalls === 0 && totalSupabaseCalls > 0 && hasMigratedMarker) {
    status = 'fully_migrated';
    statusEmoji = '✅';
    needsMigration = false;
    reason = 'مرحل بالكامل';
  } else if (totalKvCalls > 0 && totalSupabaseCalls > 0) {
    status = 'partially_migrated';
    statusEmoji = '⚠️';
    needsMigration = true;
    reason = 'مرحل جزئياً - يستخدم KV و Supabase معاً';
  } else if (totalKvCalls > 0 && totalSupabaseCalls === 0) {
    status = 'needs_migration';
    statusEmoji = '❌';
    needsMigration = true;
    reason = 'يحتاج ترحيل - يستخدم KV فقط';
  } else if (totalKvCalls === 0 && totalSupabaseCalls > 0 && !hasMigratedMarker) {
    status = 'migrated_no_marker';
    statusEmoji = '⚡';
    needsMigration = false;
    reason = 'مرحل لكن بدون علامة MIGRATED';
  }
  
  return {
    path: relativePath,
    fullPath: filePath,
    exists: true,
    size: stat.size,
    lines: lines.length,
    httpMethod: httpMethod,
    kv: {
      get: kvGetCalls,
      put: kvPutCalls,
      delete: kvDeleteCalls,
      list: kvListCalls,
      total: totalKvCalls
    },
    supabase: {
      from: supabaseFromCalls,
      rpc: supabaseRpcCalls,
      total: totalSupabaseCalls,
      tables: tables,
      hasImport: hasSupabaseImport
    },
    hasMigratedMarker: hasMigratedMarker,
    status: status,
    statusEmoji: statusEmoji,
    needsMigration: needsMigration,
    reason: reason
  };
}

function getAllEndpoints(dir, baseDir = '') {
  const endpoints = [];
  
  if (!fs.existsSync(dir)) {
    return endpoints;
  }
  
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(baseDir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      endpoints.push(...getAllEndpoints(fullPath, relativePath));
    } else if (item.endsWith('.js')) {
      endpoints.push(relativePath);
    }
  });
  
  return endpoints;
}

// جمع جميع الـ endpoints
const currentEndpoints = getAllEndpoints(currentDir);
const backupEndpoints = getAllEndpoints(backupDir);

// دمج القوائم
const allEndpointPaths = [...new Set([...currentEndpoints, ...backupEndpoints])].sort();

console.log(`\n📊 إجمالي Endpoints فريدة: ${allEndpointPaths.length}`);
console.log(`   في Current: ${currentEndpoints.length}`);
console.log(`   في Backup: ${backupEndpoints.length}`);

const detailedReport = {
  timestamp: new Date().toISOString(),
  summary: {
    total_unique: allEndpointPaths.length,
    in_current: currentEndpoints.length,
    in_backup: backupEndpoints.length,
    missing_in_current: 0,
    only_in_current: 0,
    needs_migration: 0,
    fully_migrated: 0,
    no_storage: 0
  },
  endpoints: []
};

console.log('\n' + '='.repeat(100));
console.log('📋 تفاصيل كل Endpoint:');
console.log('='.repeat(100));

allEndpointPaths.forEach((endpointPath, index) => {
  const currentPath = path.join(currentDir, endpointPath);
  const backupPath = path.join(backupDir, endpointPath);
  
  const currentAnalysis = analyzeEndpointDetailed(currentPath, endpointPath);
  const backupAnalysis = analyzeEndpointDetailed(backupPath, endpointPath);
  
  const inCurrent = currentAnalysis !== null;
  const inBackup = backupAnalysis !== null;
  
  let location = '';
  let locationEmoji = '';
  if (inCurrent && inBackup) {
    location = 'Both';
    locationEmoji = '🔄';
  } else if (inCurrent && !inBackup) {
    location = 'Current Only';
    locationEmoji = '✨';
    detailedReport.summary.only_in_current++;
  } else if (!inCurrent && inBackup) {
    location = 'Backup Only';
    locationEmoji = '❌';
    detailedReport.summary.missing_in_current++;
  }
  
  const analysis = currentAnalysis || backupAnalysis;
  
  if (analysis.needsMigration) {
    detailedReport.summary.needs_migration++;
  } else if (analysis.status === 'fully_migrated') {
    detailedReport.summary.fully_migrated++;
  } else if (analysis.status === 'no_storage') {
    detailedReport.summary.no_storage++;
  }
  
  console.log(`\n${index + 1}. ${locationEmoji} ${endpointPath}`);
  console.log(`   الموقع: ${location}`);
  console.log(`   الحالة: ${analysis.statusEmoji} ${analysis.status.toUpperCase()}`);
  console.log(`   السبب: ${analysis.reason}`);
  console.log(`   HTTP Method: ${analysis.httpMethod}`);
  console.log(`   الحجم: ${analysis.size} bytes | السطور: ${analysis.lines}`);
  console.log(`   KV Calls: ${analysis.kv.total} (get:${analysis.kv.get}, put:${analysis.kv.put}, delete:${analysis.kv.delete}, list:${analysis.kv.list})`);
  console.log(`   Supabase Calls: ${analysis.supabase.total} (from:${analysis.supabase.from}, rpc:${analysis.supabase.rpc})`);
  if (analysis.supabase.tables.length > 0) {
    console.log(`   Supabase Tables: ${analysis.supabase.tables.join(', ')}`);
  }
  console.log(`   يحتاج ترحيل: ${analysis.needsMigration ? '✅ نعم' : '❌ لا'}`);
  
  if (!inCurrent && inBackup) {
    console.log(`   ⚠️  مفقود في Current - يجب نسخه من Backup`);
  }
  
  detailedReport.endpoints.push({
    path: endpointPath,
    location: location,
    inCurrent: inCurrent,
    inBackup: inBackup,
    ...analysis
  });
});

console.log('\n' + '='.repeat(100));
console.log('📊 الملخص النهائي:');
console.log('='.repeat(100));
console.log(`إجمالي Endpoints: ${detailedReport.summary.total_unique}`);
console.log(`في Current: ${detailedReport.summary.in_current}`);
console.log(`في Backup: ${detailedReport.summary.in_backup}`);
console.log(`مفقودة في Current: ${detailedReport.summary.missing_in_current}`);
console.log(`جديدة في Current: ${detailedReport.summary.only_in_current}`);
console.log(`\nحالة الترحيل:`);
console.log(`   ✅ Fully Migrated: ${detailedReport.summary.fully_migrated}`);
console.log(`   ❌ Needs Migration: ${detailedReport.summary.needs_migration}`);
console.log(`   ➖ No Storage: ${detailedReport.summary.no_storage}`);

// حفظ التقرير
fs.writeFileSync(
  path.join(__dirname, 'diagnostics', 'detailed-api-inspection.json'),
  JSON.stringify(detailedReport, null, 2)
);

console.log('\n✅ التقرير التفصيلي محفوظ في: diagnostics/detailed-api-inspection.json');
console.log('='.repeat(100));
