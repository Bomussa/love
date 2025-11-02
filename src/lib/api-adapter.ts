// src/lib/api-adapter.ts
import { createClient } from '@supabase/supabase-js';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) { supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
export async function api(path, init={}){
  const url = `${API_BASE.replace(/\/$/, '')}/${String(path).replace(/^\//,'')}`;
  const headers = {'content-type':'application/json',...(init.headers||{})};
  try { if (supabase){ const {data}=await supabase.auth.getSession(); const t=data?.session?.access_token; if(t) headers['Authorization']=`Bearer ${t}`; headers['apikey']=SUPABASE_ANON_KEY; } } catch {}
  const res = await fetch(url, {...init, headers});
  if(!res.ok){throw new Error(`API ${res.status}: ${await res.text()}`);}
  const ct = res.headers.get('content-type')||''; return ct.includes('application/json')?res.json():res.text();
}
export const get=(p)=>api(p);
export const post=(p,b)=>api(p,{method:'POST',body:JSON.stringify(b)});
