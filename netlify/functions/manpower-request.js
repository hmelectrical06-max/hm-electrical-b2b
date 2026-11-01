'use strict';
const c=require('../../server/core.cjs'),m=require('../../server/manpower.cjs'),email=require('../../server/email-notifications.cjs');
exports.handler=c.safe(async e=>{
 if(e.httpMethod!=='POST')return c.reply(405,{ok:false,message:'Method not allowed.'});
 if(process.env.HM_DUAL_SERVICE_ENABLED!=='true')c.fail(503,'Manpower requests are not open yet. Please contact the office.');
 c.origin(e);const p=m.validate(c.body(e,12000));await c.rate(e,'manpower-request',10);
 const fingerprint=c.fingerprint(p),rows=await c.db('rpc/hm_save_manpower','POST',{p_request:p,p_fingerprint:fingerprint});
 const row=rows?.[0];if(!row?.id)c.fail(503,'No saved manpower request was confirmed. Please retry with the same request.');
 if(row.fingerprint!==fingerprint)c.fail(409,'This request ID was already used for different details. Start a new request.');
 if(row.email_status!=='accepted')try{const id=await email.sendOfficeEmail({idempotencyKey:'hm-manpower-'+row.id,subject:'HM ELECTRICAL manpower request '+row.id,text:m.emailText(row)});await c.db('hm_manpower_requests?id=eq.'+row.id,'PATCH',{email_status:'accepted',email_provider_id:id});}catch(error){console.error('[manpower] Notification queued. '+email.emailFailureCode(error));}
 return c.reply(201,{ok:true,reference:row.id,message:'Manpower request saved. Reference: '+row.id+'. Availability, scope and rates will be confirmed by our office.'});
});
