/**
 * Circuit Breaker pattern implementation (Add-only)
 * 
 * A lightweight, dependency-free Circuit Breaker for Node/Edge functions and clients.
 * Prevents cascading failures by temporarily blocking requests to failing services.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests fail fast with fallback
 * - HALF_OPEN: Testing if service recovered, allows limited requests
 * 
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,        // Open after 5 failures
 *   openDuration: 30000,        // Stay open for 30s
 *   timeout: 5000,              // Request timeout
 *   onStateChange: (from, to) => console.log(`Circuit ${from} -> ${to}`)
 * });
 * 
 * try {
 *   const result = await breaker.execute(
 *     () => fetch('https://api.example.com/data'),
 *     () => ({ fallback: true }) // Optional fallback
 *   );
 * } catch (err) {
 *   // Handle error
 * }
 * ```
 * 
 * @example Edge Function usage
 * ```typescript
 * import { CircuitBreaker } from './circuit-breaker.ts';
 * 
 * const dbBreaker = new CircuitBreaker({ failureThreshold: 3, openDuration: 10000 });
 * 
 * export async function handler(req: Request) {
 *   try {
 *     const data = await dbBreaker.execute(
 *       () => supabase.from('users').select('*'),
 *       () => ({ cached: true, data: [] }) // Serve stale cache
 *     );
 *     return new Response(JSON.stringify(data), { status: 200 });
 *   } catch (err) {
 *     return new Response('Service unavailable', { status: 503 });
 *   }
 * }
 * ```
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Success threshold in half-open state (default: 2) */
  successThreshold?: number;
  /** Duration in ms to keep circuit open (default: 60000) */
  openDuration?: number;
  /** Request timeout in ms (default: 3000) */
  timeout?: number;
  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Callback for metrics collection */
  onMetric?: (metric: CircuitMetric) => void;
}

export interface CircuitMetric {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly openDuration: number;
  private readonly timeout: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
  private readonly onMetric?: (metric: CircuitMetric) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.openDuration = options.openDuration ?? 60000;
    this.timeout = options.timeout ?? 3000;
    this.onStateChange = options.onStateChange;
    this.onMetric = options.onMetric;
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn Function to execute
   * @param fallback Optional fallback function
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        this.emitMetric();
        if (fallback) {
          return await fallback();
        }
        throw new CircuitBreakerError(
          'Circuit breaker is OPEN',
          CircuitState.OPEN
        );
      }
      // Transition to half-open for retry
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      if (fallback) {
        return await fallback();
      }
      throw err;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timeout')),
          this.timeout
        )
      )
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.successCount = 0;
      }
    }

    this.emitMetric();
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.successCount = 0;

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
      this.nextAttemptTime = Date.now() + this.openDuration;
    }

    this.emitMetric();
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    }

    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    }

    this.emitMetric();
  }

  /**
   * Emit metric for monitoring
   */
  private emitMetric(): void {
    if (this.onMetric) {
      this.onMetric({
        state: this.state,
        failureCount: this.failureCount,
        successCount: this.successCount,
        lastFailureTime: this.lastFailureTime,
        lastSuccessTime: this.lastSuccessTime
      });
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitMetric {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttemptTime = 0;
  }
}

/**
 * Example: Database query with circuit breaker
 */
export async function exampleDatabaseQuery() {
  const dbBreaker = new CircuitBreaker({
    failureThreshold: 3,
    openDuration: 10000,
    timeout: 5000,
    onStateChange: (from, to) => {
      console.log(`[CircuitBreaker] DB ${from} -> ${to}`);
    },
    onMetric: (metric) => {
      // Send to monitoring system
      console.log('[Metric]', JSON.stringify(metric));
    }
  });

  try {
    const result = await dbBreaker.execute(
      async () => {
        // Your database query here
        const response = await fetch('https://api.example.com/data');
        if (!response.ok) throw new Error('API error');
        return response.json();
      },
      async () => {
        // Fallback: return cached data
        console.log('[Fallback] Using cached data');
        return { cached: true, data: [] };
      }
    );
    return result;
  } catch (err) {
    console.error('[Error]', err);
    throw err;
  }
}

/**
 * Example: Multiple circuit breakers for different services
 */
export class ServiceBreakers {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(serviceName: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(
        serviceName,
        new CircuitBreaker({
          ...options,
          onStateChange: (from, to) => {
            console.log(`[${serviceName}] Circuit ${from} -> ${to}`);
          }
        })
      );
    }
    return this.breakers.get(serviceName)!;
  }

  getAllMetrics(): Record<string, CircuitMetric> {
    const metrics: Record<string, CircuitMetric> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }
}
