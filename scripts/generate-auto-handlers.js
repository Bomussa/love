// scripts/generate-auto-handlers.js
// Generate api/v1/auto handlers from reports/route-graph.json (won't overwrite existing files).
const fs = require('fs');
const path = require('path');
const child = require('child_process');

const ROUTE_GRAPH = path.resolve(process.cwd(), 'reports', 'route-graph.json');
const OUT_DIR = path.resolve(process.cwd(), 'api', 'v1', 'auto');
const LIB_DIR = path.resolve(process.cwd(), 'api', '_lib');
const UPSTREAM_ENV = 'UPSTREAM_API_BASE';

if (!fs.existsSync(ROUTE_GRAPH)) {
  console.error('ERROR: reports/route-graph.json not found. Run audit-all-repos first.');
  process.exit(1);
}
const graph = JSON.parse(fs.readFileSync(ROUTE_GRAPH, 'utf8'));

fs.mkdirSync(OUT_DIR, { recursive: true });

function routeToFilename(route) {
  // normalize and strip '/api' prefix if present; we only generate under api/v1/auto/*
  let r = route.replace(/^\/api\//, '/');
  const sanitized = r.replace(/^\/+/, '').replace(/[^a-zA-Z0-9/_-]/g, '_');
  return sanitized.replace(/\//g, '__') + '.js';
}

function createHandler(route) {
  const fileName = routeToFilename(route);
  const filePath = path.join(OUT_DIR, fileName);
  if (fs.existsSync(filePath)) {
    console.log('Skip existing handler:', filePath);
    return;
  }
  const contents = `const middleware = require('../../_lib/middleware');
const { proxyRequest } = require('../../_lib/proxy');

async function handler(req, res) {
  await middleware(req, res, async () => {
    const upstream = process.env.${UPSTREAM_ENV};
    if (!upstream) {
      res.statusCode = 500;
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({ error: true, message: 'UPSTREAM not configured' }));
      return;
    }
    await proxyRequest(req, res, upstream);
  });
}

module.exports = handler;
module.exports.default = handler;
export default handler;
`;
  fs.writeFileSync(filePath, contents, { mode: 0o644 });
  console.log('Generated handler:', filePath);
}

const routes = new Set();

if (Array.isArray(graph.routes)) {
  graph.routes.forEach(r => r && routes.add(r.path || r));
} else if (Array.isArray(graph)) {
  graph.forEach(item => {
    if (item && (item.start || item.end)) routes.add(item.end || item.start);
    else if (item && item.path) routes.add(item.path);
  });
} else if (graph.edges) {
  graph.edges.forEach(e => routes.add(e.path || e.end || e.route));
}

[...routes].forEach(r => {
  if (!r) return;
  let route = r.toString();
  if (!route.startsWith('/')) route = '/' + route;
  if (!/^\/api\//.test(route)) {
    // assume it's '/v1/...' – add '/api' prefix for handler path consistency
    route = '/api' + route;
  }
  createHandler(route);
});

// create branch, commit and push changes then open PR (optional — no exit if fails)
try {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g,'').slice(0,12);
  const branch = `auto/wire-${stamp}`;
  child.execSync(`git checkout -b ${branch}`, { stdio: 'inherit' });
  child.execSync('git add api/v1/auto api/_lib', { stdio: 'inherit' });
  child.execSync('git commit -m "chore(auto): generate missing api handlers and core libs"', { stdio: 'inherit' });
  child.execSync(`git push origin ${branch}`, { stdio: 'inherit' });
  console.log('Pushed branch', branch);
  console.log('To create PR run: gh pr create --title "feat(auto): wire missing api handlers" --body "Auto-generated handlers and core middleware" --base main');
} catch (err) {
  console.warn('Git push/commit skipped or failed:', err.message);
}
