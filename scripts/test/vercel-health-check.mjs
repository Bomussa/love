#!/usr/bin/env node
const fetch = require('node-fetch');
const endpoints = ['/api/v1/health','/api/v1/queue/status'];
const base = process.env.DEPLOY_URL || process.env.DEPLOYMENT_URL || 'http://localhost:3000';
(async()=>{
 for(const e of endpoints){
   try{
     const url = (base.replace(/\/$/, '') + e).replace(/([^:])\/\//,'$1/');
     const r = await fetch(url,{method:'GET'});
     console.log(url, r.status);
     if(r.status>=400) process.exitCode = 1;
   }catch(err){ console.error('ERR', e, err.message); process.exitCode = 2; }
 }
})();
