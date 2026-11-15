'use strict';
const c=require('../../server/core.cjs'),a=require('../../server/enquiry-assistant.cjs');
exports.handler=c.safe(async e=>{
 if(e.httpMethod!=='POST')return c.reply(405,{ok:false});
 if(process.env.HM_JD_WEBHOOK_ENABLED!=='true')return c.reply(503,{ok:false,message:'Justdial lead integration is not activated.'});
 if(!a.authorisedHook(c.header(e,'authorization'),process.env.HM_JD_WEBHOOK_SECRET))return c.reply(401,{ok:false,message:'Lead integration authentication failed.'});
 const p=c.body(e,12000);let lead;try{lead=a.normaliseLead(p,{webhook:true});}catch(err){return c.reply(400,{ok:false,message:err.message});}
 const saved=await c.db('hm_ai_external_leads?on_conflict=source_key','POST',lead,{Prefer:'resolution=ignore-duplicates,return=representation'});
 return c.reply(saved.length?201:200,{ok:true,duplicate:!saved.length,message:'Enquiry stored privately. No customer message or order was sent.'});
});
