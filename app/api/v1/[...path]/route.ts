// app/api/v1/[...path]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const ORIGINS = (process.env.FRONTEND_ORIGIN ?? '').split(',').map(s => s.trim()).filter(Boolean);
const UPSTREAM = process.env.UPSTREAM_API_BASE || 'https://api.mmc-mms.com/api/v1';

function getCorsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin');
  const headers = new Headers();
  
  if (!ORIGINS.length || (origin && ORIGINS.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin || '*');
  }
  
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  headers.set('Access-Control-Allow-Headers', req.headers.get('access-control-request-headers') || 'content-type,authorization');
  
  return headers;
}

async function proxyRequest(req: NextRequest, context: { params: { path?: string[] } }) {
  try {
    const pathSegments = (context.params.path ?? []).join('/');
    const searchParams = new URL(req.url).search;
    const upstreamUrl = `${UPSTREAM.replace(/\/$/, '')}/${pathSegments}${searchParams}`;
    
    const requestInit: RequestInit = {
      method: req.method,
      headers: new Headers(req.headers),
      redirect: 'manual'
    };
    
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      requestInit.body = await req.arrayBuffer();
    }
    
    const response = await fetch(upstreamUrl, requestInit);
    const responseHeaders = new Headers(response.headers);
    const corsHeaders = getCorsHeaders(req);
    
    corsHeaders.forEach((value, key) => {
      responseHeaders.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy failed', message: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req)
  });
}

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
