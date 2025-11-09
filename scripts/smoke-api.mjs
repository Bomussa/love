import http from 'node:https';
const base = process.env.BASE_URL; // مثال: https://<your-vercel-domain>
if(!base) { console.error('BASE_URL required'); process.exit(1); }
function get(url){ return new Promise((resolve,reject)=>http.get(url,(r)=>{ resolve({status:r.statusCode, headers:r.headers}); }).on('error',reject)); }
const expect2xx = s => (s>=200 && s<300);
const expectRedirect = s => [301,302,307,308].includes(s);

const run = async () => {
  const h1 = await get(`${base}/api/v1/health`);
  if(!expect2xx(h1.status)) throw new Error(`/api/v1/health not 2xx: ${h1.status}`);
  const h2 = await get(`${base}/api/health`); // يجب أن تتحول إلى /api/v1/health
  if(!(expect2xx(h2.status) || expectRedirect(h2.status))) throw new Error(`/api/health neither 2xx nor redirect: ${h2.status}`);
  console.log('SMOKE OK');
};
run().catch(e => { console.error(e); process.exit(1); });
