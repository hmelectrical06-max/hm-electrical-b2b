'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),{parseEnv}=require('util');
// Insert missing public content only. Never overwrites an admin edit.
async function seed(values){
 if(!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(values.SUPABASE_URL||''))throw Error('Invalid project URL');
 const key=values.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error('Missing server credential');
 const box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/data.js'),'utf8'),box);
 const tables=[['hm_catalogue_products','product_id',box.window.HM_DATA.materials.map(p=>({product_id:p.id,data:p}))],['hm_service_listings','service_id',box.window.HM_DATA.services.map(p=>({service_id:p.id,data:p}))]];
 for(const [table,pk,rows]of tables){for(let i=0;i<rows.length;i+=100){const r=await fetch(values.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/'+table+'?on_conflict='+pk,{method:'POST',headers:{apikey:key,...(key.split('.').length===3?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(rows.slice(i,i+100))});if(!r.ok)throw Error('Seed '+table+' HTTP '+r.status);}console.log('Preserved/seeded '+rows.length+' '+table+' records.');}
}
module.exports=seed;
if(require.main===module){const file=process.argv[2]||'.env.test';const e=parseEnv(fs.readFileSync(file,'utf8'));if(e.SUPABASE_URL.includes('qftvchsrqaevkfkhbnrj')&&process.argv[3]!=='--approved-production')throw Error('Production requires explicit --approved-production');seed(e).catch(e=>{console.error(e.message);process.exitCode=1;});}
