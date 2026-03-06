#!/usr/bin/env node
/**
 * check-i18n.js — C5-FIX: سكربت التحقق من تطابق مفاتيح الترجمة
 * يُفشل البناء إذا كانت هناك مفاتيح مفقودة في أي لغة
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const i18nPath = join(__dirname, '../frontend/src/lib/i18n.js');
const content = readFileSync(i18nPath, 'utf8');

// استخراج كائن الترجمات
const translationsMatch = content.match(/export const translations = (\{[\s\S]*?\});\s*\n\/\//);
if (!translationsMatch) {
  console.error('❌ Could not parse translations object from i18n.js');
  process.exit(1);
}

// تقييم الكائن بشكل آمن
let translations;
try {
  // استخدام Function لتقييم الكائن بشكل آمن
  translations = new Function(`return ${translationsMatch[1]}`)();
} catch (e) {
  console.error('❌ Could not evaluate translations:', e.message);
  process.exit(1);
}

const arKeys = new Set(Object.keys(translations.ar || {}));
const enKeys = new Set(Object.keys(translations.en || {}));

const missingInEn = [...arKeys].filter(k => !enKeys.has(k));
const missingInAr = [...enKeys].filter(k => !arKeys.has(k));

console.log(`✅ AR keys: ${arKeys.size}`);
console.log(`✅ EN keys: ${enKeys.size}`);

let hasErrors = false;

if (missingInEn.length > 0) {
  console.error(`\n❌ Missing in EN (${missingInEn.length}):`);
  missingInEn.forEach(k => console.error(`  - ${k}`));
  hasErrors = true;
}

if (missingInAr.length > 0) {
  console.error(`\n❌ Missing in AR (${missingInAr.length}):`);
  missingInAr.forEach(k => console.error(`  - ${k}`));
  hasErrors = true;
}

if (hasErrors) {
  console.error('\n❌ BUILD FAILED: i18n keys mismatch. Fix missing keys before building.');
  process.exit(1);
} else {
  console.log('\n✅ i18n check passed: All keys match between AR and EN!');
  process.exit(0);
}
