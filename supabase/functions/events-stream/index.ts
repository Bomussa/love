import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  try {
    const body = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const connectEvent = `data: ${JSON.stringify({
          type: 'CONNECTED',
          timestamp: new Date().toISOString()
        })}\n\n`
        controller.enqueue(new TextEncoder().encode(connectEvent))

        // Send heartbeat every 30 seconds
        const interval = setInterval(() => {
          try {
            const heartbeat = `data: ${JSON.stringify({
              type: 'HEARTBEAT',
              timestamp: new Date().toISOString()
            })}\n\n`
            controller.enqueue(new TextEncoder().encode(heartbeat))
          } catch (error) {
            console.error('Heartbeat error:', error)
            clearInterval(interval)
            controller.close()
          }
        }, 30000)

        // Cleanup on connection close
        req.signal.addEventListener('abort', () => {
          clearInterval(interval)
          controller.close()
        })
      }
    })

    return new Response(body, { headers })
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
