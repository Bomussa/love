// app/api/v1/[...path]/route.ts
// API Proxy محسّن - يدمج أفضل ما في الملفين القديمين

export const runtime = 'edge'; // استخدام Edge Runtime للسرعة
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// قراءة إعدادات البيئة
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://mmc-mms.com';
const UPSTREAM_API_BASE = (process.env.UPSTREAM_API_BASE || 'https://api.mmc-mms.com/api/v1').replace(/\/$/, '');

// قائمة Origins المسموح بها
const ALLOWED_ORIGINS = FRONTEND_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);

/**
 * إنشاء CORS headers صحيحة
 */
function getCorsHeaders(req: NextRequest): Headers {
  const origin = req.headers.get('origin');
  const headers = new Headers();
  
  // السماح للـ origin إذا كان في القائمة أو السماح للكل في التطوير
  if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  } else if (ALLOWED_ORIGINS.length === 0) {
    // في حالة عدم وجود origins محددة، السماح للكل (للتطوير فقط)
    headers.set('Access-Control-Allow-Origin', '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  headers.set('Access-Control-Max-Age', '86400'); // 24 ساعة
  headers.set('Vary', 'Origin');
  
  return headers;
}

/**
 * معالجة Preflight Request (OPTIONS)
 */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req)
  });
}

/**
 * Proxy الطلبات إلى Backend
 */
async function proxyRequest(req: NextRequest, context: { params: Promise<{ path?: string[] }> | { path?: string[] } }) {
  try {
    // استخراج المسار من context.params
    const params = await Promise.resolve(context.params);
    const pathSegments = (params.path ?? []).join('/');
    const searchParams = new URL(req.url).search;
    
    // بناء URL الكامل للـ upstream
    const upstreamUrl = `${UPSTREAM_API_BASE}/${pathSegments}${searchParams}`;
    
    console.log(`[Proxy] ${req.method} ${pathSegments} -> ${upstreamUrl}`);
    
    // تحضير Headers للطلب
    // إزالة hop-by-hop headers
    const hopByHopHeaders = new Set([
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'transfer-encoding',
      'upgrade',
      'host'
    ]);
    
    const forwardHeaders = new Headers();
    req.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        forwardHeaders.set(key, value);
      }
    });
    
    // تحضير body للطلب
    let body: ArrayBuffer | undefined;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      body = await req.arrayBuffer();
    }
    
    // إرسال الطلب إلى upstream
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      redirect: 'manual'
    });
    
    // تحضير Headers للرد
    const responseHeaders = new Headers();
    
    // نسخ headers من upstream (مع تجنب بعض headers)
    const skipHeaders = new Set([
      'content-encoding',
      'content-length',
      'transfer-encoding',
      'connection'
    ]);
    
    upstreamResponse.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    
    // إضافة CORS headers
    const corsHeaders = getCorsHeaders(req);
    corsHeaders.forEach((value, key) => {
      responseHeaders.set(key, value);
    });
    
    // إرجاع الرد
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[Proxy Error]', error);
    
    const errorResponse = {
      error: 'Proxy failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
    
    const headers = getCorsHeaders(req);
    headers.set('Content-Type', 'application/json');
    
    return new Response(JSON.stringify(errorResponse), {
      status: 502, // Bad Gateway
      headers
    });
  }
}

// تصدير handlers لجميع HTTP methods
export async function GET(req: NextRequest, context: any) {
  return proxyRequest(req, context);
}

export async function HEAD(req: NextRequest, context: any) {
  return proxyRequest(req, context);
}

export async function POST(req: NextRequest, context: any) {
  return proxyRequest(req, context);
}

export async function PUT(req: NextRequest, context: any) {
  return proxyRequest(req, context);
}

export async function PATCH(req: NextRequest, context: any) {
  return proxyRequest(req, context);
}

export async function DELETE(req: NextRequest, context: any) {
  return proxyRequest(req, context);
}
