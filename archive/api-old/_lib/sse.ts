/**
 * Server-Sent Events (SSE) helpers for real-time streaming
 */

export interface SSEOptions {
  heartbeatInterval?: number;
  headers?: Record<string, string>;
}

export class SSEStream {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(private options: SSEOptions = {}) {}

  getStream(): ReadableStream {
    return new ReadableStream({
      start: (controller) => {
        this.controller = controller;
        this.startHeartbeat();
      },
      cancel: () => {
        this.close();
      },
    });
  }

  send(data: any, event?: string): void {
    if (this.closed || !this.controller) return;

    try {
      let message = '';
      if (event) {
        message += `event: ${event}\n`;
      }
      message += `data: ${JSON.stringify(data)}\n\n`;
      
      this.controller.enqueue(this.encoder.encode(message));
    } catch (error) {
      console.error('SSE send error:', error);
      this.close();
    }
  }

  sendComment(comment: string): void {
    if (this.closed || !this.controller) return;

    try {
      const message = `: ${comment}\n\n`;
      this.controller.enqueue(this.encoder.encode(message));
    } catch (error) {
      console.error('SSE comment error:', error);
    }
  }

  private startHeartbeat(): void {
    const interval = this.options.heartbeatInterval || 15000; // 15 seconds default
    this.heartbeatTimer = setInterval(() => {
      this.sendComment('heartbeat');
    }, interval);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.controller) {
      try {
        this.controller.close();
      } catch (error) {
        // Ignore errors when closing
      }
      this.controller = null;
    }
  }
}

export function createSSEResponse(stream: ReadableStream, headers?: Record<string, string>): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'text/event-stream');
  responseHeaders.set('Cache-Control', 'no-cache, no-transform');
  responseHeaders.set('Connection', 'keep-alive');
  responseHeaders.set('X-Accel-Buffering', 'no');

  return new Response(stream, {
    headers: responseHeaders,
  });
}
