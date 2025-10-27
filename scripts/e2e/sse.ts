/**
 * Minimal SSE client using fetch streaming for E2E tests
 * No external dependencies - uses native fetch API
 */

export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

export interface SSEClientOptions {
  timeout?: number; // milliseconds
  headers?: Record<string, string>;
}

/**
 * Connect to an SSE endpoint and capture events
 * @param url - SSE endpoint URL
 * @param options - Configuration options
 * @returns Promise that resolves with captured events or rejects on timeout/error
 */
export async function captureSSEEvents(
  url: string,
  options: SSEClientOptions = {}
): Promise<SSEEvent[]> {
  const { timeout = 30000, headers = {} } = options;
  const events: SSEEvent[] = [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent: Partial<SSEEvent> = {};

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') {
          // Empty line signals end of event
          if (currentEvent.data !== undefined) {
            events.push({
              event: currentEvent.event,
              data: currentEvent.data,
              id: currentEvent.id,
              retry: currentEvent.retry,
            });
          }
          currentEvent = {};
          continue;
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const field = line.substring(0, colonIndex);
        let value = line.substring(colonIndex + 1);
        
        // Remove leading space if present
        if (value.startsWith(' ')) {
          value = value.substring(1);
        }

        switch (field) {
          case 'event':
            currentEvent.event = value;
            break;
          case 'data':
            currentEvent.data = (currentEvent.data || '') + value;
            break;
          case 'id':
            currentEvent.id = value;
            break;
          case 'retry':
            currentEvent.retry = parseInt(value, 10);
            break;
        }
      }
    }

    return events;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Timeout - return captured events so far
      return events;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Wait for a specific event type with optional data matcher
 * @param url - SSE endpoint URL
 * @param eventType - Event type to wait for (e.g., 'call-next', 'queue_call')
 * @param options - Configuration options
 * @param dataMatcher - Optional function to match event data
 * @returns Promise that resolves with the matching event or null on timeout
 */
export async function waitForSSEEvent(
  url: string,
  eventType: string,
  options: SSEClientOptions = {},
  dataMatcher?: (data: string) => boolean
): Promise<SSEEvent | null> {
  const { timeout = 30000, headers = {} } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent: Partial<SSEEvent> = {};

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) return null;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') {
          // Check if this is the event we're waiting for
          if (
            currentEvent.data !== undefined &&
            (currentEvent.event === eventType || (!currentEvent.event && eventType === 'message'))
          ) {
            if (!dataMatcher || dataMatcher(currentEvent.data)) {
              const event: SSEEvent = {
                event: currentEvent.event,
                data: currentEvent.data,
                id: currentEvent.id,
                retry: currentEvent.retry,
              };
              reader.cancel();
              return event;
            }
          }
          currentEvent = {};
          continue;
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const field = line.substring(0, colonIndex);
        let value = line.substring(colonIndex + 1);
        
        if (value.startsWith(' ')) {
          value = value.substring(1);
        }

        switch (field) {
          case 'event':
            currentEvent.event = value;
            break;
          case 'data':
            currentEvent.data = (currentEvent.data || '') + value;
            break;
          case 'id':
            currentEvent.id = value;
            break;
          case 'retry':
            currentEvent.retry = parseInt(value, 10);
            break;
        }
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return null; // Timeout
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
