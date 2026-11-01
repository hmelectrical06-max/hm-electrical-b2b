'use strict';
const c=require('../../server/core.cjs'),{auth,sessionCookie}=require('../../server/auth-mfa.cjs');
const valid=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
exports.handler=c.safe(async e=>{
 const user=await c.admin(e,{allowAal1:true}),factors=(user.factors||[]).filter(f=>f.factor_type==='totp');
 if(e.httpMethod==='GET')return c.reply(200,{ok:true,aal:user.aal,required:c.mfaRequired(),factors:factors.map(f=>({id:f.id,name:f.friendly_name||'Authenticator',status:f.status}))});
 if(e.httpMethod!=='POST')return c.reply(405,{ok:false});
 c.origin(e);await c.rate(e,'admin-mfa:'+user.id,12);const p=c.body(e,2000);
 if(p.action==='enroll'){
  if(factors.some(f=>f.status==='verified')&&user.aal!=='aal2')c.fail(403,'Verify your existing authenticator before adding another device.');
  const result=await auth(e,'factors','POST',{factor_type:'totp',friendly_name:'HM ELECTRICAL '+Date.now(),issuer:'HM ELECTRICAL Admin'});
  return c.reply(200,{ok:true,factorId:result.id,qrCode:result.totp?.qr_code,secret:result.totp?.secret});
 }
 if(p.action==='verify'){
  if(!valid(p.factorId)||!factors.some(f=>f.id===p.factorId)||!/^\d{6}$/.test(p.code||''))c.fail(400,'Choose your authenticator and enter its six-digit code.');
  const challenge=await auth(e,'factors/'+p.factorId+'/challenge','POST',{});
  const result=await auth(e,'factors/'+p.factorId+'/verify','POST',{challenge_id:challenge.id,code:p.code});
  if(!result.access_token)c.fail(503,'MFA session was not confirmed.');
  await c.db('hm_audit_log','POST',{actor_user_id:user.id,action:'MFA_VERIFIED',entity_table:'auth',entity_id:user.id,changed_fields:[]});
  return c.reply(200,{ok:true},{'Set-Cookie':sessionCookie(result.access_token,result.expires_in)});
 }
 if(p.action==='remove'){
  if(user.aal!=='aal2')c.fail(403,'Authenticator verification required.');
  if(!valid(p.factorId)||!factors.some(f=>f.id===p.factorId)||factors.filter(f=>f.status==='verified').length<2)c.fail(400,'Keep at least one verified authenticator. Add and verify a backup device before removing a device.');
  await auth(e,'factors/'+p.factorId,'DELETE');return c.reply(200,{ok:true});
 }
 c.fail(400,'Invalid authenticator action.');
});
