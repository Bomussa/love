import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, service: "mmc-mms-core", ts: Date.now() });
}
