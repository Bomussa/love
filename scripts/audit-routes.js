// scripts/audit-routes.js
// Build a simple route graph by scanning the repo for /api/v1 references and API files.
const fs = require('fs');
const path = require('path');

const repo = process.cwd();
const reportDir = path.join(repo, 'reports');
fs.mkdirSync(reportDir, { recursive: true });

function walk(dir, acc=[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      walk(p, acc);
    } else {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(repo, []);
const apiRoutes = new Set();
const references = new Set();

for (const file of files) {
  const rel = path.relative(repo, file);
  if (/^api\/.test(rel) && /\.(js|ts|mjs|cjs)$/.test(rel)) {
    let route = '/' + rel.replace(/^api\//, 'api/').replace(/\.(js|ts|mjs|cjs)$/, '');
    route = route.replace(/\/index$/, '');
    route = '/' + route.replace(/\\/g,'/');
    apiRoutes.add(route);
  }
  try {
    const txt = fs.readFileSync(file, 'utf8');
    const matches = txt.match(/\/(api\/v1\/[a-zA-Z0-9_\-\/]+)/g);
    if (matches) matches.forEach(m => references.add(m));
  } catch {}
}

const out = {
  generatedAt: new Date().toISOString(),
  routes: Array.from(new Set([ ...Array.from(apiRoutes), ...Array.from(references) ])).sort()
};

fs.writeFileSync(path.join(reportDir, 'route-graph.json'), JSON.stringify(out, null, 2));
console.log('Wrote reports/route-graph.json with', out.routes.length, 'routes');
