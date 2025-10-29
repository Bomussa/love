const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IGNORE = ['node_modules','.git','dist','build','.vercel'];

function shouldSkip(p){ return IGNORE.some(d=>p.includes(path.join(path.sep,d))); }

function fixContent(s){
  let out = s;
  out = out.replace(/([\"'\`])\/api\/(?!v1\b)/g, '$1/api/v1/');
  out = out.replace(/VITE_API_BASE\s*[:=]\s*[\"']?\/api[\"']?/g, 'VITE_API_BASE=\"/api/v1\"');
  return out;
}

function walk(dir){
  const items = fs.readdirSync(dir,{withFileTypes:true});
  for(const it of items){
    const p = path.join(dir,it.name);
    if(IGNORE.includes(it.name)) continue;
    if(it.isDirectory()) { walk(p); continue; }
    if(!/\.(js|ts|jsx|tsx|html|css|json)$/i.test(it.name)) continue;
    const before = fs.readFileSync(p,'utf8');
    const after = fixContent(before);
    if(after!==before){ fs.writeFileSync(p + '.bak', before, 'utf8'); fs.writeFileSync(p, after, 'utf8'); console.log('fixed', p); }
  }
}
walk(ROOT);
console.log('done');
