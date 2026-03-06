import fs from 'fs'; import path from 'path';
const CANDIDATES=['.env','.env.local','.env.production','.env.development','vercel.json','supabase/config.toml'];
const GLOBS=['.','app','src','frontend','backend','supabase','api','functions','public'];
const VARS=['SUPABASE_URL','VITE_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_ANON_KEY','VITE_SUPABASE_ANON_KEY','VITE_API_BASE_URL','API_ORIGIN','FRONTEND_ORIGIN'];
const report={dup_env:[],wrong_urls:[],vercel_rewrites_env_usage:false,projects:new Set()};
const read=(f)=>{try{return fs.readFileSync(f,'utf8')}catch{return''}};
const scan=(f)=>{const t=read(f);
  for(const v of VARS){
    const re=new RegExp(`${v}\\s*=\\s*["'\`](.+?)["'\`]`,'g'); let m; const vals=[];
    while((m=re.exec(t))) vals.push(m[1]);
    if(vals.length>1) report.dup_env.push({var:v,file:f,values:vals});
    if(vals[0] && /functions\.supabase\.co/i.test(vals[0])) report.wrong_urls.push(vals[0]);
    if(vals[0]){const mm=vals[0].match(/https:\/\/([a-z0-9]+)\.supabase\.co/i); if(mm) report.projects.add(mm[1]);}
  }
  if(/rewrites".*?\$\{.*?}/s.test(t)) report.vercel_rewrites_env_usage=true;
};
for(const g of GLOBS){for(const c of CANDIDATES){const f=path.join(g,c); if(fs.existsSync(f)) scan(f);}}
fs.writeFileSync('health-audit.json', JSON.stringify({...report,projects:[...report.projects]},null,2));
console.log('Wrote health-audit.json');
