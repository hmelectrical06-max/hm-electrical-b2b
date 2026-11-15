'use strict';
const c=require('./core.cjs'),a=require('./enquiry-assistant.cjs'),mail=require('./email-notifications.cjs');
const enabled=()=>process.env.HM_CUSTOMER_EMAIL_ENABLED==='true';
const validEmail=s=>typeof s==='string'&&s.length<=254&&/^[^\s@<>;,\r\n]+@[^\s@<>;,\r\n]+\.[^\s@<>;,\r\n]+$/.test(s);
function normalise(kind,r){
 if(kind==='manpower')return {name:r.contact_name,email:r.email,consent:r.consent,closed:r.status==='Closed',details:r.trade+' required. '+(r.details||''),summary:[r.quantity+' '+r.trade+'(s)',r.site_location,'Required: '+r.required_date,'Duration: '+r.duration].join('\n'),location:r.site_location,date:r.required_date};
 if(kind==='booking')return {name:r.customer_name,email:r.email,consent:true,closed:['Cancelled','Completed'].includes(r.status),details:r.category+' '+r.description,summary:[r.category,r.description,r.area,'Preferred: '+mail.formatDateTime(r.preferred_at)].join('\n'),location:r.area,date:r.preferred_at};
 return {name:r.name,email:r.email,consent:r.consent,closed:r.status==='Closed',details:[r.type,r.details,...(r.items||[]).map(i=>i.name)].join(' '),summary:[r.details,...(r.items||[]).map(i=>`${i.name} ${i.size||''} × ${i.qty} ${i.unit||''}`),r.location,r.required_date?'Required: '+r.required_date:''].filter(Boolean).join('\n'),location:r.location,date:r.required_date};
}
function compose(kind,r){
 const p=normalise(kind,r),topic=a.topic(p.details);if(!p.consent||p.closed||!validEmail(p.email)||topic==='outside'||kind==='manpower'&&!['Electrician','Plumber','Welder','Helper','Supervisor'].includes(r.trade))return null;
 const work=topic.endsWith('-work'),name=a.clean(p.name,100).replace(/[<>\r\n]/g,' ');
 const ask=work&&require('./simple-customer-chat.cjs').workDetail(r.details||'')?'Aapka work detail mil gaya hai. Aage HM ELECTRICAL ki team aapse baat karke charges aur availability confirm karegi.':work?'Electrician/plumber aur site manpower services available hain. Kya kaam hai? Short work detail is email par reply kar dijiye; aage HM ELECTRICAL ki team aapse baat karegi.':'Aapki material requirement mil gayi hai. Available printed MRP reference diya ja sakta hai; final selling rate hamari team confirm karegi.';
 const text=[`Hi ${name},`,'',ask,'',a.clean(p.summary,500),'','Final charges aur technician availability office confirm karega. This acknowledgement does not confirm a booking or dispatch.','',`Reference: ${r.reference||r.id}`,'HM ELECTRICAL | 8085560156','hmelectrical06@gmail.com','https://hmelectricalb2b.com/','Operating shop: Shop No. 02, Ibrahim Hight, Mannat Banglow, Khardi Road, Thane 421204','Registered office: A-85, Naik Nagar, LBS Marg, Sion West, Mumbai 400022'].join('\n');
 return {subject:'HM ELECTRICAL | Please confirm your enquiry '+(r.reference||r.id),text};
}
async function queue(kind,r,{catchup=false}={}){
 if(!enabled())return {queued:false};
 if(!['website','manpower','booking'].includes(kind))throw Error('INVALID_REPLY_SOURCE');
 const start=Date.parse(process.env.HM_CUSTOMER_EMAIL_START_AT||'');
 if(!Number.isFinite(start)||!catchup&&(!r.created_at||Date.parse(r.created_at)<start))return {queued:false};
 const payload=compose(kind,r);if(!payload)return {queued:false};
 const rows=await c.db('hm_customer_replies?on_conflict=lead_key','POST',{lead_key:kind+':'+r.id,recipient:normalise(kind,r).email.trim().toLowerCase(),payload},{Prefer:'resolution=ignore-duplicates,return=representation'});
 return {queued:rows.length===1};
}
async function queueSafely(kind,r){try{return await queue(kind,r);}catch{console.error('[customer-reply] Queue unavailable; saved enquiry remains safe.');return {queued:false};}}
async function dispatch(){
 if(!enabled())return {accepted:0};
 const rows=await c.db('rpc/hm_claim_customer_replies','POST',{});let accepted=0;
 for(const r of rows)try{
  const [kind,id]=r.lead_key.split(':'),table={website:'enquiries',manpower:'hm_manpower_requests',booking:'service_bookings'}[kind];
  if(!table||!/^[0-9a-f-]{36}$/i.test(id))throw Error('INVALID_REPLY_SOURCE');
  const latest=await c.db(table+'?id=eq.'+id+'&select=*'),current=latest[0]&&normalise(kind,latest[0]);
  if(!current||current.closed||!current.consent||String(current.email).trim().toLowerCase()!==r.recipient){await c.db('hm_customer_replies?id=eq.'+r.id,'PATCH',{status:'stopped',lease_until:null,last_error:'ENQUIRY_CLOSED_OR_CONTACT_CHANGED'});continue;}
  const providerId=await mail.sendCustomerEmail({to:r.recipient,idempotencyKey:'hm-customer-'+r.id,...r.payload});
  await c.db('hm_customer_replies?id=eq.'+r.id,'PATCH',{status:'accepted',provider_id:providerId,accepted_at:new Date().toISOString(),lease_until:null,last_error:null});accepted++;
 }catch(error){
  await c.db('hm_customer_replies?id=eq.'+r.id,'PATCH',{status:'pending',lease_until:null,last_error:mail.emailFailureCode(error),next_attempt_at:new Date(Date.now()+Math.min(60,r.attempts*5)*60000).toISOString()});
 }
 return {accepted};
}
async function sweep(){
 if(!enabled())return {accepted:0};
 const start=process.env.HM_CUSTOMER_EMAIL_START_AT;if(!Number.isFinite(Date.parse(start||'')))return {accepted:0};
 for(const [kind,table] of [['website','enquiries'],['manpower','hm_manpower_requests'],['booking','service_bookings']]){
  const rows=await c.db(table+'?select=*&created_at=gte.'+encodeURIComponent(start)+'&created_at=gte.'+encodeURIComponent(new Date(Date.now()-20*3600000).toISOString())+'&order=created_at.desc&limit=100');
  for(const r of rows)await queueSafely(kind,r);
 }
 return dispatch();
}
module.exports={enabled,validEmail,normalise,compose,queue,queueSafely,dispatch,sweep};
