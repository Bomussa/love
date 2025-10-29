export async function GET(){
  return Response.json({ ok:true, service:"mmc-mms-core", ts: Date.now() });
}
