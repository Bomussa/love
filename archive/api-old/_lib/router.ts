/**
 * Simple router for matching routes and extracting parameters
 */

export interface RouteMatch {
  params: Record<string, string>;
  query: Record<string, string>;
}

export type RouteHandler = (req: Request, match: RouteMatch) => Promise<Response> | Response;

export interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const regexPattern = pattern
      .replace(/\/:([^/]+)/g, (_, name) => {
        paramNames.push(name);
        return '/([^/]+)';
      })
      .replace(/\*/g, '.*');

    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${regexPattern}$`),
      paramNames,
      handler,
    });
  }

  get(pattern: string, handler: RouteHandler): void {
    this.add('GET', pattern, handler);
  }

  post(pattern: string, handler: RouteHandler): void {
    this.add('POST', pattern, handler);
  }

  put(pattern: string, handler: RouteHandler): void {
    this.add('PUT', pattern, handler);
  }

  delete(pattern: string, handler: RouteHandler): void {
    this.add('DELETE', pattern, handler);
  }

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    // Extract query parameters
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    for (const route of this.routes) {
      if (route.method !== method && route.method !== '*') continue;

      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });

        return await route.handler(req, { params, query });
      }
    }

    return null;
  }
}

/**
 * Simple path matcher utility
 */
export function matchPath(pattern: string, pathname: string): { params: Record<string, string> } | null {
  const paramNames: string[] = [];
  const regexPattern = pattern
    .replace(/\/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '/([^/]+)';
    })
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  const match = pathname.match(regex);

  if (!match) return null;

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });

  return { params };
}
