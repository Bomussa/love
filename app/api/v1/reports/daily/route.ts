import { NextResponse } from 'next/server';
export async function GET(){
  const today = new Date().toISOString().slice(0,10);
  return NextResponse.json({ ok: true, date: today, totals: { visits: 0, clinics: 0 } });
}
