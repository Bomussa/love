['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'].forEach(k=>{ if(!process.env[k]) { console.warn('Missing ' + k); } })
