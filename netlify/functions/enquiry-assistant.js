'use strict';
const c=require('../../server/core.cjs'),a=require('../../server/enquiry-assistant.cjs');
const chat=require('../../server/customer-chat.cjs');
exports.handler=c.safe(async e=>{
 if(e.httpMethod!=='POST')return c.reply(405,{ok:false});c.origin(e);await c.rate(e,'public-assistant',30);
 const p=c.body(e,14000);
 if(p.messages!==undefined){
  let messages;try{messages=chat.history(p.messages);}catch(err){c.fail(400,err.message);}
  if(p.consent!==true)c.fail(400,'Please agree to the chat processing notice.');
  if(process.env.HM_CUSTOMER_CHAT_SIMPLE==='true')return c.reply(200,{ok:true,mode:'simple-enquiry-chat',...await require('../../server/simple-customer-chat.cjs').answer(messages)});
  let step=chat.fallback(messages),mode='guided-chat';
  if(process.env.HM_CUSTOMER_AI_ENABLED==='true'&&process.env.HM_CUSTOMER_AI_VIA_SUPABASE==='true'){
   if(typeof p.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.requestId))c.fail(400,'Invalid chat request ID.');
   try{step=await chat.edgeStep(messages,p.requestId,{url:c.env('SUPABASE_URL'),headers:c.serviceRoleHeaders()});mode='ai-chat';}catch{/* Runtime keeps its own atomic allowance; guided fallback sends nothing externally. */}
  }else if(process.env.HM_CUSTOMER_AI_ENABLED==='true'&&process.env.OPENAI_API_KEY&&new Date()<new Date('2026-12-16T00:00:00+05:30')){
   if(typeof p.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.requestId))c.fail(400,'Invalid chat request ID.');
   const reserved=await c.db('rpc/hm_ai_reserve','POST',{p_request:p.requestId});
   if(reserved===true){try{step=await chat.nextStep(messages,{key:process.env.OPENAI_API_KEY});mode='ai-chat';}catch{/* Safe guided chat remains available; the reserved attempt is not refunded. */}}
  }
  step=chat.refineStep(step,messages);
  if(step==='price'){
   const mrp=require('../../server/customer-mrp.cjs');let refs=[];
   if(a.topic(messages.filter(m=>m.role==='user').map(m=>m.content).join(' ')).endsWith('-work'))return c.reply(200,{ok:true,mode,step,reply:'Technician/labour charges depend on the actual work and site. Please share the work details, current site locality/landmark, required date, team size and duration. HM ELECTRICAL will review and confirm the final charges and availability. No booking is confirmed here.',handoff:false,products:[]});
   try{refs=await mrp.references(messages.filter(m=>m.role==='user').map(m=>m.content).join(' '));}catch{/* Missing catalogue evidence must never become a guessed price. */}
   return c.reply(200,{ok:true,mode,step,reply:mrp.text(refs),handoff:false,products:[],mrpReferences:refs});
  }
  return c.reply(200,{ok:true,mode,step,reply:chat.replyFor(step,messages),handoff:step==='handoff',products:[]});
 }
 if(typeof p.question!=='string'||!p.question.trim()||p.question.length>350)c.fail(400,'Enter a material or service requirement, up to 350 characters.');
 // Only public catalogue identity fields are used. No price/cost metadata or supplier records.
 const products=await require('../../server/live-catalogue.cjs').products();
 return c.reply(200,{ok:true,mode:'catalogue-guidance',...a.publicAnswer(p.question,products)});
});
