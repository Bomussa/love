// tests/test-subscribe.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(url, anon);
const ch = supabase
  .channel('public:queue')
  .on('postgres_changes', { schema: 'public', table: 'queue', event: '*' }, (payload) => {
    console.log('EVENT', payload.eventType, payload.new || payload.old);
  })
  .subscribe((status) => console.log('STATUS', status));
