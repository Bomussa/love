export async function GET(){
  // demo static pin until real core layer wired
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth()+1).padStart(2,'0');
  const dd = String(now.getUTCDate()).padStart(2,'0');
  return Response.json({ date:`${yyyy}-${mm}-${dd}`, pin:"42" });
}
