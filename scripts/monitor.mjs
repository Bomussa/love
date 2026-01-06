const ENDPOINT = process.env.MONITOR_ENDPOINT;
const PATHS = (process.env.MONITOR_PATHS || '/api/core,/api/queue,/api/pin').split(',').map(s=>s.trim());
const TRIES = parseInt(process.env.MONITOR_TRIES || '3', 10);
const SLA = parseInt(process.env.MONITOR_SLA_MS || '2000', 10);
const HEADERS = { 'apikey': process.env.SUPABASE_ANON_KEY || '', 'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || ''}` };
if (!ENDPOINT) { console.error('MONITOR_ENDPOINT required'); process.exit(2); }
const results = [];
for (const path of PATHS) {
  let ok = 0; const attempts = [];
  for (let i=0;i<TRIES;i++){
    const url = `${ENDPOINT}?path=${encodeURIComponent(path)}`;
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: HEADERS });
      const ms = Date.now()-t0;
      const pass = r.ok && ms <= SLA;
      attempts.push({ status:r.status, ms, pass }); if (pass) ok++;
    } catch (e) { attempts.push({ status:0, ms:Date.now()-t0, pass:false, error:String(e) }); }
    await new Promise(r=>setTimeout(r,200));
  }
  const rate = Math.round((ok/TRIES)*100);
  results.push({ path, rate, attempts });
}
const worst = Math.min(...results.map(r=>r.rate));
const avg = Math.round(results.reduce((a,r)=>a+r.rate,0)/results.length);
console.log(JSON.stringify({ sla_ms:SLA, tries:TRIES, avg_success_pct:avg, worst_path_pct:worst, details:results },null,2));
if (!(avg >= 85 && worst >= 70)) process.exit(1);
