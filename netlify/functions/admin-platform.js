'use strict';
const c=require('../../server/core.cjs'),m=require('../../server/manpower.cjs');
const knownProducts=new Map(require('../../server/catalogue.json').filter(p=>!p.id.startsWith('WORK-')).map(p=>[p.id,p]));
exports.handler=c.safe(async e=>{
 const user=await c.admin(e),view=e.queryStringParameters?.view||'manpower';
 if(e.httpMethod==='GET'){
  if(view==='manpower')return c.reply(200,{ok:true,categories:await c.db('hm_manpower_categories?select=*&order=trade.asc'),requests:await c.db('hm_manpower_requests?select=id,trade,quantity,site_location,duration,contact_name,phone,email,required_date,details,status,created_at&order=created_at.desc&limit=100')});
  if(view==='audit')return c.reply(200,{ok:true,rows:await c.db('hm_audit_log?select=id,actor_user_id,action,entity_table,entity_id,changed_fields,created_at&order=id.desc&limit=100')});
  if(view==='services')return c.reply(200,{ok:true,rows:await c.db('hm_service_listings?select=*&order=service_id&limit=1000')});
  if(view==='products')return c.reply(200,{ok:true,rows:await c.db('hm_catalogue_products?select=*&order=product_id&limit=1000')});
  c.fail(400,'Invalid admin view.');
 }
 if(e.httpMethod!=='PATCH')return c.reply(405,{ok:false});
 c.origin(e);const p=c.body(e,15000),stamp={updated_by:user.id,updated_at:new Date().toISOString()};
 if(p.action==='availability'){
  if(!m.trades.includes(p.trade)||!Number.isInteger(p.availableCount)||p.availableCount<0||p.availableCount>10000||!['available','on_request','fully_booked'].includes(p.availability))c.fail(400,'Invalid trade availability.');
  const rows=await c.db('hm_manpower_categories?trade=eq.'+encodeURIComponent(p.trade),'PATCH',{description:m.text(p.description||'',600,false,true),available_count:p.availableCount,availability:p.availability,...stamp});if(rows.length!==1)c.fail(404,'Trade not found.');
 }else if(p.action==='request-status'){
  if(!/^[0-9a-f-]{36}$/i.test(p.id)||!m.statuses.includes(p.status))c.fail(400,'Invalid request status.');
  const rows=await c.db('hm_manpower_requests?id=eq.'+p.id,'PATCH',{status:p.status,updated_at:stamp.updated_at});if(rows.length!==1)c.fail(404,'Request not found.');
 }else if(p.action==='product'){
  if(!knownProducts.has(p.id))c.fail(400,'Choose an existing catalogue product.');
  const current=await c.db('hm_catalogue_products?product_id=eq.'+encodeURIComponent(p.id)+'&select=data');if(current.length!==1)c.fail(404,'Product not found.');
  const data={...current[0].data};for(const key of ['name','size','unit','category','group'])data[key]=m.text(p[key],key==='name'?180:160,true);
  data.description=m.text(p.description||'',2000,false,true);
  await c.db('hm_catalogue_products?product_id=eq.'+encodeURIComponent(p.id),'PATCH',{data,...stamp});
 }else if(p.action==='service'){
  if(!/^WORK-\d{4}$/.test(p.id)||typeof p.enabled!=='boolean')c.fail(400,'Invalid service.');
  const current=await c.db('hm_service_listings?service_id=eq.'+p.id+'&select=data');if(current.length!==1)c.fail(404,'Service not found.');
  const data={...current[0].data};for(const key of ['name','category','section','unit','scope'])data[key]=m.text(p[key],key==='scope'?600:180,true);
  await c.db('hm_service_listings?service_id=eq.'+p.id,'PATCH',{data,enabled:p.enabled,...stamp});
 }else c.fail(400,'Invalid admin action.');
 return c.reply(200,{ok:true,message:'Saved. Public content refreshes automatically.'});
});
