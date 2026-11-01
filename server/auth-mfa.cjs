'use strict';
const c=require('./core.cjs');
async function auth(event,path,method='GET',body){
 let r;try{r=await fetch(c.env('SUPABASE_URL').replace(/\/$/,'')+'/auth/v1/'+path,{method,headers:{apikey:c.env('SUPABASE_ANON_KEY'),Authorization:'Bearer '+c.cookie(event),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}catch{c.fail(503,'The authentication service could not be reached.');}
 if(!r.ok)c.fail(r.status===429?429:r.status===401?401:400,r.status===429?'Too many authentication attempts. Try again later.':'Authenticator request failed. Check the code or sign in again.');
 return r.status===204?null:r.json();
}
function sessionCookie(token,expires=3600){return `__Host-hm_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.min(expires,3600)}`;}
module.exports={auth,sessionCookie};
