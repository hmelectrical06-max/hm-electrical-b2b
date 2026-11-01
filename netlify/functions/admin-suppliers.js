'use strict';
const c=require('../../server/core.cjs'),s=require('../../server/suppliers.cjs');
const one=rows=>{if(!Array.isArray(rows)||rows.length!==1)c.fail(404,'The supplier record was not found.');return rows[0];};
async function detail(id){const rfq=one(await c.db('hm_supplier_rfqs?id=eq.'+s.uuid(id)+'&select=*')),recipients=await c.db('hm_supplier_rfq_recipients?rfq_id=eq.'+id+'&select=*&order=updated_at.desc');const suppliers=await c.db('hm_suppliers?select='+s.supplierSelect+'&limit=1000');return {rfq,recipients:recipients.map(r=>({...r,supplier:suppliers.find(x=>x.id===r.supplier_id)}))};}
exports.handler=c.safe(async e=>{
 const user=await c.admin(e),query=e.queryStringParameters||{};
 if(e.httpMethod==='GET'){
  if(query.supplierId){const id=s.uuid(query.supplierId),rows=await c.db('hm_supplier_rfq_recipients?supplier_id=eq.'+id+'&select=*&order=updated_at.desc&limit=200'),ids=[...new Set(rows.map(r=>r.rfq_id))];const rfqs=ids.length?await c.db('hm_supplier_rfqs?select=id,reference,title,created_at&id=in.('+ids.join(',')+')'):[];return c.reply(200,{ok:true,rows:rows.map(r=>({...r,rfq:rfqs.find(x=>x.id===r.rfq_id)}))});}
  if(query.id)return c.reply(200,{ok:true,...await detail(query.id)});
  if(query.history){const id=s.uuid(query.history);return c.reply(200,{ok:true,rows:await c.db('hm_supplier_activity?recipient_id=eq.'+id+'&select=*&order=id.desc&limit=100')});}
  const [suppliers,enquiries,rfqs]=await Promise.all([c.db('hm_suppliers?select='+s.supplierSelect+'&order=company_name&limit=1000'),c.db('enquiries?select=id,name,company_name,created_at,items,type&order=created_at.desc&limit=200'),c.db('hm_supplier_rfqs?select=id,reference,title,source_enquiry_id,created_at&order=created_at.desc&limit=200')]);return c.reply(200,{ok:true,suppliers,enquiries,rfqs});
 }
 if(!['POST','PATCH'].includes(e.httpMethod))return c.reply(405,{ok:false});c.origin(e);const p=c.body(e,35000);
 if(p.action==='supplier'){
  const id=s.uuid(p.id),data=s.supplier(p),previous=await c.db('hm_suppliers?id=eq.'+id+'&select=id');const stamp={updated_by:user.id,updated_at:new Date().toISOString()};
  const saved=previous.length?await c.db('hm_suppliers?id=eq.'+id,'PATCH',{...data,...stamp}):await c.db('hm_suppliers','POST',{id,...data,...stamp,created_by:user.id});one(saved);return c.reply(200,{ok:true,id,message:'Supplier saved privately.'});
 }
 if(p.action==='create-rfq'){
  const id=s.uuid(p.id),source=s.uuid(p.enquiryId);if(!Array.isArray(p.supplierIds)||p.supplierIds.length<1||p.supplierIds.length>100)c.fail(400,'Choose 1 to 100 suppliers.');const ids=[...new Set(p.supplierIds.map(s.uuid))].sort();
  const [enquiryRows,active]=await Promise.all([c.db('enquiries?id=eq.'+source+'&select=id,items'),c.db('hm_suppliers?select=id&active=eq.true&id=in.('+ids.join(',')+')')]);const enquiry=one(enquiryRows);if(active.length!==ids.length)c.fail(400,'A selected supplier is missing or inactive.');
  const data={id,reference:'HM-RFQ-'+new Date(Date.now()+19800000).toISOString().slice(0,10).replaceAll('-','')+'-'+id.slice(0,8).toUpperCase(),source_enquiry_id:source,title:require('../../server/manpower.cjs').text(p.title,180,true),delivery_area:require('../../server/manpower.cjs').text(p.deliveryArea||'',200),required_date:s.date(p.requiredDate),supplier_note:require('../../server/manpower.cjs').text(p.note||'',3000,false,true),items:s.chooseItems(enquiry.items||[],p.itemIds),created_by:user.id};
  if(!data.items.length&&!data.supplier_note)c.fail(400,'This enquiry has no catalogue items. Add a supplier-facing requirement note.');const {reference,created_by,...stable}=data;data.fingerprint=c.fingerprint({...stable,suppliers:ids});
  const saved=one(await c.db('rpc/hm_create_supplier_rfq','POST',{p_rfq:data,p_suppliers:ids}));if(saved.fingerprint!==data.fingerprint)c.fail(409,'This draft reference was already used for different details. Refresh and create a new RFQ.');return c.reply(201,{ok:true,id:saved.id,reference:saved.reference,message:'Private supplier RFQ saved. No message or order has been sent.'});
 }
 if(['draft','contact','response'].includes(p.action)){
  const id=s.uuid(p.recipientId),recipient=one(await c.db('hm_supplier_rfq_recipients?id=eq.'+id+'&select=*'));
  let data;
  if(p.action==='draft'){
   const supplier=one(await c.db('hm_suppliers?id=eq.'+recipient.supplier_id+'&select='+s.supplierSelect));if(!supplier.active)c.fail(400,'This supplier is inactive. Review the supplier before contacting.');const rfq=one(await c.db('hm_supplier_rfqs?id=eq.'+recipient.rfq_id+'&select=*'));data=s.draft(rfq,supplier,p.channel);
  }else if(p.action==='contact'){
   if(p.confirmedSent!==true||!['email','whatsapp','other'].includes(p.channel))c.fail(400,'Confirm that you actually contacted this supplier.');data={channel:p.channel,confirmation:'Admin confirmed contact outside the website'};
  }else data=s.response(p);
  const saved=one(await c.db('rpc/hm_supplier_recipient_action','POST',{p_id:id,p_action:p.action,p_data:data,p_actor:user.id}));return c.reply(200,{ok:true,recipient:saved,...(p.action==='draft'?{draft:data}:{}),message:p.action==='draft'?'Draft prepared privately. Review it and send it yourself; preparing a draft does not mark it sent.':p.action==='contact'?'Your contact confirmation was recorded.':'Supplier response and procurement status saved privately.'});
 }
 c.fail(400,'Invalid supplier action.');
});
