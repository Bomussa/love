export async function GET(){
  return Response.json({ date:new Date().toISOString().slice(0,10), totals:{ visits:0, clinics:0 } });
}
