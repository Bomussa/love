import { serve } from "https://deno.land/std/http/server.ts";

// Basic SSE broadcaster with heartbeat; extend later to push real queue updates
const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
};

function sseResponse(url: URL) {
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            // Initial retry suggestion for EventSource
            controller.enqueue(encoder.encode(`retry: 5000\n\n`));

            // Optional: filter by clinic
            const clinic = url.searchParams.get('clinic') || '';

            // Send an initial hello event
            const helloPayload = JSON.stringify({ message: 'connected', clinic, time: new Date().toISOString() });
            controller.enqueue(encoder.encode(`event: notice\n`));
            controller.enqueue(encoder.encode(`data: ${helloPayload}\n\n`));

            // Heartbeat every 15s
            const heartbeat = setInterval(() => {
                const now = new Date().toISOString();
                controller.enqueue(encoder.encode(`event: heartbeat\n`));
                controller.enqueue(encoder.encode(`data: ${now}\n\n`));
            }, 15000);

            // Keep connection alive with comments every 20s (some proxies need activity)
            const keepAlive = setInterval(() => {
                controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
            }, 20000);

            // Close handlers
            const close = () => {
                clearInterval(heartbeat);
                clearInterval(keepAlive);
                try { controller.close(); } catch { }
            };

            // Abort when client disconnects
            // @ts-ignore - Deno adds signal
            const signal: AbortSignal | undefined = (self as any).Deno?.serve?.signal;
            if (signal) {
                signal.addEventListener('abort', close);
            }
        }
    });

    return new Response(stream, {
        headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            // Helpful for some reverse proxies to avoid buffering SSE
            "X-Accel-Buffering": "no"
        }
    });
}

serve((req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405
        });
    }

    const url = new URL(req.url);
    return sseResponse(url);
});
