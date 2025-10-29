import { NextResponse } from "next/server";

// استخدام متغير البيئة CORE_API_BASE
const CORE_API_BASE = process.env.CORE_API_BASE || 'http://localhost:3000/api/v1';

export async function GET() {
  // يمكن استخدام CORE_API_BASE هنا للتحقق من حالة الـCore الحقيقي
  return NextResponse.json({ ok: true, service: "mmc-mms-core", core_api: CORE_API_BASE, ts: Date.now() });
}
