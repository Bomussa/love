import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: tables, error } = await supabase.rpc('exec_sql', {
    sql_query: 'SELECT 1 as success'
  });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Tables:', tables);

  const tableNames = Array.isArray(tables) ? tables.map(t => t.table_name) : [];
  const targetTables = ['smart_errors_log', 'smart_fixes_log', 'qa_runs', 'qa_findings', 'repair_runs'];
  targetTables.forEach(t => {
    console.log(`${t}: ${tableNames.includes(t) ? 'EXISTS' : 'MISSING'}`);
  });
}

check();
