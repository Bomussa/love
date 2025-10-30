import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, queue: [] });
}
export async function POST() {
  return NextResponse.json({ ok: true, created: true }, { status: 201 });
}
