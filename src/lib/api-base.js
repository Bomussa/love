/**
 * Frontend API client (Vercel proxy or direct Supabase).
 */
const env=(k)=> (typeof import!=='undefined'&&import.meta?.env?.[k])||(typeof process!=='undefined'&&process?.env?.[k])||''
const API_BASE=(env('VITE_API_BASE_URL')||'').replace(//+$/,'')
const SUPABASE_URL=(env('VITE_SUPABASE_URL')||'').replace(//+$/,'')
const ANON=env('VITE_SUPABASE_ANON_KEY')||''
if(!API_BASE && !SUPABASE_URL){throw new Error('Set VITE_API_BASE_URL or VITE_SUPABASE_URL')}
const DIRECT=API_BASE.includes('supabase.co')||!!SUPABASE_URL
const BASE=API_BASE||`${SUPABASE_URL}/functions/v1`
export const toFunctionName=(e)=>String(e).replace(/^/+/,'').replace(/^api/v1/+/, '').replace(///g,'-')
export async function apiRequest(endpoint,{method='POST',body,headers={}}={}){
  const fn=toFunctionName(endpoint); const url=`${BASE}/${fn}`
  const h={'Content-Type':'application/json',...headers}
  if(url.includes('supabase.co')){ if(!ANON) throw new Error('Missing VITE_SUPABASE_ANON_KEY'); h['Authorization']=`Bearer ${ANON}`; h['apikey']=ANON }
  if(method==='OPTIONS') return {ok:true,preflight:true}
  const res=await fetch(url,{method,headers:h,body:body?JSON.stringify(body):undefined,redirect:'follow'})
  const t=await res.text(); let data; try{data=t?JSON.parse(t):null}catch{data={raw:t}}
  if(!res.ok){const err=new Error(data?.message||res.statusText||`HTTP ${res.status}`); err.status=res.status; err.data=data; throw err}
  return data
}
export const health=()=>apiRequest('/health',{method:'POST'})
export default {apiRequest,toFunctionName,health}
