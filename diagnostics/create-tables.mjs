import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

console.log('🔗 اتصال Supabase...');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('⚠️  ملاحظة: إنشاء الجداول يتطلب service_role key وليس anon key');
console.log('📋 يجب تنفيذ SQL schema يدوياً من Supabase Dashboard');
console.log('');
console.log('الخطوات:');
console.log('1. افتح Supabase Dashboard للمشروع');
console.log('2. اذهب إلى SQL Editor');
console.log('3. انسخ محتوى diagnostics/schema-plan.sql');
console.log('4. الصق في SQL Editor واضغط Run');
console.log('');
console.log('✅ بعد التنفيذ، سيتم إنشاء الجداول مع جميع الفهارس والسياسات');
