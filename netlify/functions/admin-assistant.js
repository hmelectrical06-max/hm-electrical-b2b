'use strict';
const c=require('../../server/core.cjs'),a=require('../../server/enquiry-assistant.cjs');
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const tables={website:'enquiries',external:'hm_ai_external_leads',manpower:'hm_manpower_requests',booking:'service_bookings'};
function mapLead(kind,p){if(kind==='manpower'||kind==='booking'){const n=require('../../server/customer-replies.cjs').normalise(kind,p);return {...p,name:n.name,phone:p.phone||p.mobile,location:n.location,details:n.summary,items:[]};}return p;}
async function leadFor(key){const [kind,id]=String(key||'').split(':');if(!tables[kind]||!uuid(id))c.fail(400,'Choose a valid enquiry.');const rows=await c.db(tables[kind]+'?id=eq.'+id+'&select=*');if(rows.length!==1)c.fail(404,'Enquiry not found.');const p=mapLead(kind,rows[0]);return {...p,details:[p.details,...(p.items||[]).map(i=>`${i.name} ${i.size||''} ${i.qty} ${i.unit||''}`)].filter(Boolean).join('\n')};}
exports.handler=c.safe(async e=>{
 const user=await c.admin(e);
 if(e.httpMethod==='GET'){
  const [web,external,drafts,budget,manpower,bookings,customerReplies]=await Promise.all([c.db('enquiries?select=id,name,phone,email,location,details,items,status,created_at&order=created_at.desc&limit=100'),c.db('hm_ai_external_leads?select=*&order=created_at.desc&limit=100'),c.db('hm_ai_drafts?select=*&order=created_at.desc&limit=100'),c.db('hm_ai_budget?month=eq.'+a.month()+'&select=reserved_inr,requests'),c.db('hm_manpower_requests?select=*&trade=in.(Electrician,Plumber,Welder,Helper,Supervisor)&order=created_at.desc&limit=100'),c.db('service_bookings?select=*&order=created_at.desc&limit=100'),c.db('hm_customer_replies?select=lead_key,status,accepted_at,last_error&order=created_at.desc&limit=100')]);
  const leads=[...web.map(p=>({...p,key:'website:'+p.id,source:'website'})),...external.map(p=>({...p,key:'external:'+p.id})),...manpower.map(p=>({...mapLead('manpower',p),key:'manpower:'+p.id,source:'website manpower'})),...bookings.map(p=>({...mapLead('booking',p),key:'booking:'+p.id,source:'website technician'}))].sort((a,b)=>b.created_at.localeCompare(a.created_at));
  for(const lead of leads)lead.customerReply=customerReplies.find(r=>r.lead_key===lead.key)||null;
  return c.reply(200,{ok:true,leads,drafts,budget:{month:a.month(),limit:500,reserved:budget[0]?.reserved_inr||0,requests:budget[0]?.requests||0,maxRequests:100},connections:{website:true,customerAi:process.env.HM_CUSTOMER_AI_ENABLED==='true'&&(!!process.env.OPENAI_API_KEY||process.env.HM_CUSTOMER_AI_VIA_SUPABASE==='true'),justdial:process.env.HM_JD_WEBHOOK_ENABLED==='true'&&!!process.env.HM_JD_WEBHOOK_SECRET,ai:process.env.HM_AI_ENABLED==='true'&&!!process.env.OPENAI_API_KEY,customerEmail:process.env.HM_CUSTOMER_EMAIL_ENABLED==='true',automaticMessaging:false},mode:'email-confirmation-and-private-drafts'});
 }
 if(e.httpMethod!=='POST')return c.reply(405,{ok:false});c.origin(e);const p=c.body(e,14000);
 if(p.action==='import'){
  let lead;try{lead=a.normaliseLead(p);}catch(err){c.fail(400,err.message);}lead.created_by=user.id;
  const rows=await c.db('hm_ai_external_leads?on_conflict=source_key','POST',lead,{Prefer:'resolution=ignore-duplicates,return=representation'});return c.reply(200,{ok:true,duplicate:!rows.length});
 }
 if(p.action==='approve'){
  if(!uuid(p.id)||typeof p.reply!=='string'||!p.reply.trim()||p.reply.length>2000)c.fail(400,'Enter a reply up to 2,000 characters.');
  const rows=await c.db('hm_ai_drafts?id=eq.'+p.id,'PATCH',{reply:p.reply.trim(),status:'approved',approved_by:user.id,approved_at:new Date().toISOString()});if(rows.length!==1)c.fail(404,'Draft not found.');return c.reply(200,{ok:true,message:'Approved and saved. Not sent to customer.'});
 }
 if(p.action!=='draft'||!uuid(p.requestId))c.fail(400,'Invalid assistant request.');
 const existing=await c.db('hm_ai_drafts?id=eq.'+p.requestId+'&select=*');if(existing.length)return c.reply(200,{ok:true,draft:existing[0]});
 const lead=await leadFor(p.leadKey);let note='',engine='standard';
 if(p.ai===true){
  if(process.env.HM_AI_ENABLED!=='true'||!process.env.OPENAI_API_KEY)c.fail(409,'AI provider is not connected. Use Standard reply meanwhile.');
  // Fixed low-cost model and bounded input/output. Re-review published pricing before re-enabling after this date.
  if(new Date()>=new Date('2026-12-16T00:00:00+05:30'))c.fail(409,'AI price review is due. Standard replies remain available.');
  const reserved=await c.db('rpc/hm_ai_reserve','POST',{p_request:p.requestId});if(reserved!==true)c.fail(409,'Monthly AI limit reached, or this attempt already ran. Use Standard reply.');
  try{note=await a.staffNote(lead,{key:process.env.OPENAI_API_KEY});engine=a.MODEL;}catch{note='AI note unavailable. Review the original requirement. This attempt remains counted to avoid accidental duplicate charges.';engine='standard-fallback';}
 }
 const draft={id:p.requestId,lead_key:p.leadKey,reply:a.template(lead),staff_note:note,engine,status:'draft',created_by:user.id};
 const rows=await c.db('hm_ai_drafts?on_conflict=id','POST',draft,{Prefer:'resolution=ignore-duplicates,return=representation'});return c.reply(200,{ok:true,draft:rows[0]||draft});
});
