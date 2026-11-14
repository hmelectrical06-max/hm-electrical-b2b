'use strict';
const c=require('../../server/core.cjs'),r=require('../../server/ratebook.cjs');
const one=a=>{if(!Array.isArray(a)||a.length!==1)c.fail(404,'Record not found.');return a[0];};
const selection='*,material:hm_material_master!inner(*),supplier:hm_suppliers(id,company_name)';
exports.handler=c.safe(async e=>{
 const user=await c.admin(e),q=e.queryStringParameters||{};
 if(e.httpMethod==='GET'){
  const rules=await c.db('hm_supplier_discount_rules?select=*&order=brand,scope&limit=1000');
  if(q.rules==='1')return c.reply(200,{ok:true,rules,suppliers:await c.db('hm_suppliers?select=id,company_name&active=eq.true&order=company_name&limit=1000')});
  const page=Number(q.page||0);if(!Number.isInteger(page)||page<0||page>1000)c.fail(400,'Invalid page.');
  let filter='';if(q.brand)filter+='&brand=eq.'+encodeURIComponent(r.text(q.brand,80,true));
  if(q.materialId)filter+='&material_id=eq.'+r.uuid(q.materialId);
  if(q.search){const s=r.search(q.search);
   if(/^(?:F[A-Z0-9]{8,}|700\d{5}|SUP-[A-F0-9]{8,})$/i.test(s))filter+='&manufacturer_sku=ilike.'+encodeURIComponent('*'+s+'*');
   else{const terms=s.replace(/(\d)(mm|cm|mtr|inch)\b/gi,'$1 $2').split(/\s+/).filter(Boolean).slice(0,10);if(terms.length)filter+='&material.and=('+terms.map(t=>'or(name.ilike.'+encodeURIComponent('*'+t+'*')+',specification.ilike.'+encodeURIComponent('*'+t+'*')+')').join(',')+')';}
  }
  const rows=await c.db('hm_supplier_price_rows?select='+selection+filter+'&order=material_id,brand,id&limit=101&offset='+(page*100));
  return c.reply(200,{ok:true,rows:rows.slice(0,100).map(x=>r.decorate(x,rules)),rules,page,more:rows.length>100});
 }
 if(e.httpMethod!=='POST')return c.reply(405,{ok:false});c.origin(e);const p=c.body(e,8000),stamp={updated_by:user.id,updated_at:new Date().toISOString()};
 if(p.action==='calculate'){
  const selling_floor=r.sellingRate(p.landed_cost,p.markup),markup=r.number(p.markup,1000);
  if(p.save===true){
   if(p.confirmed!==true)c.fail(400,'Confirm the supplier cost, tax basis and unit first.');
   const id=r.uuid(p.id),row=one(await c.db('hm_supplier_price_rows?id=eq.'+id+'&select=*')),rules=await c.db('hm_supplier_discount_rules?id=eq.'+r.uuid(row.discount_rule_id)+'&select=*');
   if(!r.decorate(row,rules).quote_ready)c.fail(400,'Review the source row and confirm its supplier discount before saving a selling rate.');
   await c.db('hm_supplier_price_rows?id=eq.'+id,'PATCH',{source_details:{...row.source_details,pricing_plan:{landed_cost:r.number(p.landed_cost,99999999999,true),markup,pricing_method:'cost_markup',selling_floor,confirmed_at:stamp.updated_at}},...stamp});
  }
  return c.reply(200,{ok:true,selling_floor,markup,message:p.save===true?'Private customer selling-rate plan saved. A later MRP, discount or specification change requires reconfirmation.':'Customer rate uses your selected extra percentage on landed cost. Recheck tax basis and quantity before issuing a quotation.'});
 }
 if(p.action==='material'){
  const id=r.uuid(p.id),name=r.text(p.name,250,true),specification=r.text(p.specification||'',500),unit=p.unit;
  if(!['Nos','Mtr','Ltr','Kg','Box','Set','Roll','Bag'].includes(unit))c.fail(400,'Choose the correct material unit.');
  const item_key=(name+'|'+specification+'|'+unit).toLowerCase().replace(/\s+/g,' ').slice(0,700),existing=await c.db('hm_material_master?item_key=eq.'+encodeURIComponent(item_key)+'&select=id');
  if(existing.some(x=>x.id!==id))c.fail(409,'This material and specification already exist. Search it and add the make there.');
  const current=await c.db('hm_material_master?id=eq.'+id+'&select=id');
  one(await c.db('hm_material_master'+(current.length?'?id=eq.'+id:''),current.length?'PATCH':'POST',{...(current.length?{}:{id}),item_key,name,specification,unit,updated_at:stamp.updated_at}));
  return c.reply(200,{ok:true,id,message:'Private material master saved. Add makes under this same item; no public listing was created.'});
 }
 if(p.action==='create-rule'){
  const supplier_id=r.uuid(p.supplier_id);one(await c.db('hm_suppliers?id=eq.'+supplier_id+'&active=eq.true&select=id'));
  const brand=r.text(p.brand,80,true),scope=r.text(p.scope,200,true),all=await c.db('hm_supplier_discount_rules?supplier_id=eq.'+supplier_id+'&select=brand,scope');
  if(all.some(x=>x.brand.toLowerCase()===brand.toLowerCase()&&x.scope.toLowerCase()===scope.toLowerCase()))c.fail(409,'This discount rule already exists. Edit that rule instead.');
  one(await c.db('hm_supplier_discount_rules','POST',{id:r.uuid(p.id),supplier_id,brand,scope,basis:'MRP',discount_percent:r.number(p.discount_percent,100),notes:r.text(p.notes||'',2000),...stamp}));
  return c.reply(201,{ok:true,message:'Private supplier/make discount saved. Assign it only to matching rows.'});
 }
 if(p.action==='rule'){
  const id=r.uuid(p.id);one(await c.db('hm_supplier_discount_rules?id=eq.'+id+'&select=id'));
  one(await c.db('hm_supplier_discount_rules?id=eq.'+id,'PATCH',{discount_percent:r.number(p.discount_percent,100),notes:r.text(p.notes||'',2000),...stamp}));
  return c.reply(200,{ok:true,message:'Private MRP discount saved. Linked rate references recalculate automatically.'});
 }
 if(p.action==='price'){
  const id=r.uuid(p.id),row=one(await c.db('hm_supplier_price_rows?id=eq.'+id+'&select=id,supplier_id,brand'));
  let ruleId=null;if(p.discount_rule_id){const rule=one(await c.db('hm_supplier_discount_rules?id=eq.'+r.uuid(p.discount_rule_id)+'&select=id,supplier_id,brand'));if(rule.supplier_id!==row.supplier_id||rule.brand!==row.brand)c.fail(400,'Discount must belong to this supplier and make.');ruleId=rule.id;}
  if(!['Verified reference','Needs review'].includes(p.review_status))c.fail(400,'Choose a review status.');
  one(await c.db('hm_supplier_price_rows?id=eq.'+id,'PATCH',{printed_mrp:r.number(p.printed_mrp,99999999999,true),discount_rule_id:ruleId,review_status:p.review_status,tax_basis:r.text(p.tax_basis,500,true),...stamp}));
  return c.reply(200,{ok:true,message:'Private rate reference saved. No customer price was published.'});
 }
 if(p.action==='add'){
  const materialId=r.uuid(p.material_id);one(await c.db('hm_material_master?id=eq.'+materialId+'&select=id'));
  const supplierId=r.uuid(p.supplier_id);one(await c.db('hm_suppliers?id=eq.'+supplierId+'&active=eq.true&select=id'));
  const brand=r.text(p.brand,80,true),ruleId=p.discount_rule_id?r.uuid(p.discount_rule_id):null;
  if(ruleId){const rule=one(await c.db('hm_supplier_discount_rules?id=eq.'+ruleId+'&select=supplier_id,brand'));if(rule.supplier_id!==supplierId||rule.brand!==brand)c.fail(400,'Discount must belong to this supplier and make.');}
  const id=r.uuid(p.id);one(await c.db('hm_supplier_price_rows','POST',{id,material_id:materialId,supplier_id:supplierId,brand,manufacturer_sku:r.text(p.manufacturer_sku||'',100),source_key:'admin:'+id,printed_mrp:r.number(p.printed_mrp,99999999999,true),discount_rule_id:ruleId,source_file:r.text(p.source_file||'Admin entry',250),tax_basis:r.text(p.tax_basis,500,true),review_status:'Needs review',...stamp}));
  return c.reply(201,{ok:true,message:'Make added under the existing material. Review the supplier reference before quoting.'});
 }
 c.fail(400,'Invalid rate book action.');
});
