// api/v1/[...path].js
export const config = { api: { bodyParser: false } };
const HOP = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade']);
function stripHopHeaders(h){const o={};for(const k in h){if(!h[k])continue;if(HOP.has(k.toLowerCase()))continue;o[k]=Array.isArray(h[k])?h[k].join(','):h[k];}return o;}
export default async function handler(req,res){
  try{
    const base=process.env.UPSTREAM_API_BASE;
    if(!base){res.status(500).json({error:'Missing UPSTREAM_API_BASE'});return;}
    const parts=Array.isArray(req.query.path)?req.query.path:(req.query.path?[String(req.query.path)]:[]);
    const url=base.replace(/\/$/,'')+'/'+parts.map(encodeURIComponent).join('/');
    const chunks=[];for await (const c of req) chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));
    const body=Buffer.concat(chunks);const method=(req.method||'GET').toUpperCase();
    const r=await fetch(url,{method,headers:stripHopHeaders(req.headers),body:['GET','HEAD'].includes(method)?undefined:body});
    const buf=Buffer.from(await r.arrayBuffer());res.status(r.status);
    for (const [k,v] of r.headers.entries()){if(HOP.has(k.toLowerCase()))continue;if(k.toLowerCase()==='content-encoding')continue;res.setHeader(k,v);}
    res.setHeader('Cache-Control','no-store');res.send(buf);
  }catch(e){res.status(502).json({error:'Upstream error',details:String(e&&e.message||e)});}
}