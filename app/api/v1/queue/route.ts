export async function GET(){
  return Response.json({ total:0, waiting:0, serving:null });
}
export async function POST(){
  // generate demo ticket
  const ticket = "A" + String(Math.floor(Math.random()*900)+100);
  return Response.json({ ticket }, { status:201 });
}
