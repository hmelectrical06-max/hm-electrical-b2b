'use strict';
const c=require('../../server/core.cjs'),{auth,sessionCookie}=require('../../server/auth-mfa.cjs');
exports.handler=c.safe(async e=>{
 if(e.httpMethod==='GET'){const user=await c.admin(e,{allowAal1:true});return c.reply(200,{ok:true,mfaRequired:c.mfaRequired()&&user.aal!=='aal2'});}
 c.origin(e);
 if(e.httpMethod==='DELETE'){if(c.cookie(e))try{await auth(e,'logout?scope=local','POST',{});}catch{}return c.reply(200,{ok:true},{'Set-Cookie':'__Host-hm_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});}
 if(e.httpMethod!=='POST')return c.reply(405,{ok:false});
 const p=c.body(e,2000);if(typeof p.email!=='string'||typeof p.password!=='string'||p.email.length>254||p.password.length>256)c.fail(400,'Invalid sign-in fields.');
 await c.rate(e,'login',10);
 const r=await fetch(c.env('SUPABASE_URL')+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:c.env('SUPABASE_ANON_KEY'),'Content-Type':'application/json'},body:JSON.stringify({email:p.email,password:p.password}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)c.fail(401,'Sign-in failed. Check your email and password.');
 const session=await r.json();if(!c.env('ADMIN_USER_IDS').split(',').map(s=>s.trim()).includes(session.user?.id))c.fail(403,'Admin access required.');
 return c.reply(200,{ok:true,mfaRequired:c.mfaRequired()},{'Set-Cookie':sessionCookie(session.access_token,session.expires_in)});
});
