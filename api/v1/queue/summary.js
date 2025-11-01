const ALLOW = ['https://mmc-mms.com','https://www.mmc-mms.com'];
function cors(res, origin){ if(ALLOW.includes(origin||'')) res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary','Origin'); }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function countByStatus(status){
  const u = new URL('/rest/v1/queue', SUPABASE_URL);
  u.searchParams.set('select','id');
  u.searchParams.set('status', `eq.${status}`);
  const r = await fetch(u, {
    headers:{
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
      Range: '0-0'
    }
  });
  const cr = r.headers.get('content-range') || '0/0';
  const total = parseInt(cr.split('/').pop()||'0',10);
  return Number.isFinite(total) ? total : 0;
}

export default async function handler(req,res){
  cors(res, req.headers.origin);
  if(!SUPABASE_URL || !SUPABASE_KEY){
    return res.status(500).json({ok:false, error:'Supabase env missing'});
  }
  try{
    const [waiting, called, completed, cancelled] = await Promise.all([
      countByStatus('waiting'),
      countByStatus('called'),
      countByStatus('completed'),
      countByStatus('cancelled')
    ]);
    const total = waiting + called + completed + cancelled;
    res.status(200).json({ ok:true, waiting, called, completed, cancelled, total });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e) });
  }
}
