export async function adminRoutes(url, req, res, body, ctx){
  if(req.method==='GET' && url.pathname==='/mw/admin/pins/today'){
    // Placeholder: read from backend.service if needed
    return res.json({ pins: [] }), true;
  }
  if(req.method==='GET' && url.pathname==='/mw/admin/live'){
    // Placeholder SSE
    res.json({ ok:true, mode:'SSE-placeholder' });
    return true;
  }
  return false;
}
