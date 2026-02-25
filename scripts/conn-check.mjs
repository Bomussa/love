/**
 * Connectivity smoke test (add-only).
 * - Verifies FRONT probe: /.well-known/healthz.json returns ok=true.
 * - Verifies API /api/v1/healthz is reachable (200..499 allowed).
 * No secrets are printed.
 */
import https from 'https';

function fetchText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,(res)=>{
      let data='';
      res.on('data',c=>data+=c);
      res.on('end',()=>resolve({status:res.statusCode,body:data}));
    }).on('error',reject);
  });
}

const ORIGIN = process.env.FRONTEND_ORIGIN || process.env.VITE_API_BASE_URL?.replace(//api/(v1|v2).*/,'') || 'https://mmc-mms.com';

(async()=>{
  const front = `${ORIGIN}/.well-known/healthz.json`;
  const api = `${ORIGIN}/api/v1/healthz`;
  let ok=true;
  console.log('[check] ORIGIN =', ORIGIN);
  // FRONT
  try{
    const r = await fetchText(front);
    console.log('[front]', r.status);
    if(r.status<200||r.status>299){ ok=false; console.log('[front] not 2xx'); }
    try { const j = JSON.parse(r.body); if(j.ok!==true){ ok=false; console.log('[front] ok!=true'); } } catch{}
  }catch(e){ ok=false; console.log('[front] error'); }
  // API
  try{
    const r = await fetchText(api);
    console.log('[api]', r.status);
    if(r.status>=500){ ok=false; console.log('[api] 5xx'); }
  }catch(e){ ok=false; console.log('[api] error'); }
  
  if(!ok){
    console.error('CONNECTIVITY_CHECK_FAILED');
    process.exit(1);
  } else {
    console.log('CONNECTIVITY_CHECK_OK');
  }
})();
