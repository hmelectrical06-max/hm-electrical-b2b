'use strict';

const c=require('../../server/core.cjs');
const {products,validateQuotation}=require('../../server/quotations.cjs');
const unavailableMessage='Quotation database is not set up. Review and apply supabase/migrations/20261029_000003_quotations.sql, after the catalogue metadata migration.';
const missingMetadataMessage='Verified tax metadata is not available. Apply supabase/migrations/20261029_000001_catalogue_metadata.sql and verify each product tax rate before creating a GST quotation.';
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function quotationDb(path,method='GET',data){
  try{return await c.db(path,method,data);}
  catch(error){
    if(error.message==='A required service endpoint was not found. Check the Supabase URL and apply database/setup.sql.'){
      c.fail(503,unavailableMessage);
    }
    throw error;
  }
}
async function loadTaxMetadata(){
  try{
    const rows=await c.db('catalogue_product_metadata?select=product_id,hsn,gst_rate,tax_source_url,tax_verified_at&limit=1000');
    return new Map(rows.map(row=>[row.product_id,row]));
  }catch(error){
    if(error.message==='A required service endpoint was not found. Check the Supabase URL and apply database/setup.sql.'){
      c.fail(503,missingMetadataMessage);
    }
    throw error;
  }
}
async function getQuotation(id){
  const rows=await quotationDb(`quotations?quotation_id=eq.${id}&select=*&limit=1`);
  if(!rows.length)c.fail(404,'Quotation not found.');
  const quote=rows[0];
  const [items,versions,statusHistory]=await Promise.all([
    quotationDb(`quotation_items?quotation_id=eq.${id}&select=*&order=line_no.asc`),
    quotationDb(`quotation_versions?quotation_id=eq.${id}&select=revision,created_at,actor_id&order=revision.desc&limit=50`),
    quotationDb(`quotation_status_history?quotation_id=eq.${id}&select=previous_status,new_status,created_at,actor_id&order=created_at.desc&limit=50`)
  ]);
  return {...quote,items,versions,status_history:statusHistory};
}

exports.handler=c.safe(async event=>{
  const user=await c.admin(event);
  if(event.httpMethod==='GET'){
    const query=event.queryStringParameters||{};
    if(query.view==='summary'){
      const statuses=['draft','sent','accepted','rejected','expired'];
      const counts=await Promise.all(statuses.map(status=>
        c.dbCount('quotations?select=quotation_id&status=eq.'+status)
      ));
      return c.reply(200,{ok:true,counts:Object.fromEntries(statuses.map((status,index)=>[status,counts[index]]))});
    }
    if(query.view==='enquiries'){
      const rows=await quotationDb('enquiries?select=id,name,phone,email,location,details,type,items,created_at&order=created_at.desc&limit=100');
      return c.reply(200,{ok:true,rows});
    }
    if(query.id){
      if(!uuidPattern.test(query.id))c.fail(400,'Quotation reference is invalid.');
      if(query.revision!==undefined){
        const revision=Number(query.revision);
        if(!Number.isInteger(revision)||revision<1)c.fail(400,'Quotation revision is invalid.');
        const versions=await quotationDb(`quotation_versions?quotation_id=eq.${query.id}&revision=eq.${revision}&select=snapshot&limit=1`);
        if(!versions.length)c.fail(404,'Quotation revision not found.');
        const history=await quotationDb(`quotation_versions?quotation_id=eq.${query.id}&select=revision,created_at,actor_id&order=revision.desc&limit=50`);
        return c.reply(200,{ok:true,quotation:{...versions[0].snapshot,versions:history}});
      }
      return c.reply(200,{ok:true,quotation:await getQuotation(query.id)});
    }
    const page=Number(query.page||0);
    if(!Number.isInteger(page)||page<0||page>10000)c.fail(400,'Invalid quotation page.');
    const rows=await quotationDb(`quotations?select=*&order=created_at.desc&limit=30&offset=${page*30}`);
    return c.reply(200,{ok:true,rows,page});
  }
  if(event.httpMethod!=='POST')return c.reply(405,{ok:false,message:'Method not allowed.'});
  c.origin(event);
  const payload=c.body(event,200000);
  if(payload.action==='change-status'){
    if(!uuidPattern.test(payload.quotation_id||'')||!['sent','accepted','rejected','expired'].includes(payload.status)){
      c.fail(400,'Choose a valid quotation and status.');
    }
    const updated=await quotationDb('rpc/hm_set_quotation_status','POST',{
      p_quotation_id:payload.quotation_id,p_status:payload.status,p_actor_id:user.id
    });
    return c.reply(200,{ok:true,quotation:updated});
  }
  if(payload.action!=='save')c.fail(400,'Choose save or change-status.');
  const quotationId=payload.quotation_id||null;
  if(quotationId&&!uuidPattern.test(quotationId))c.fail(400,'Quotation reference is invalid.');
  const taxMode=payload.quotation?.tax_mode;
  const productLines=Array.isArray(payload.quotation?.items)&&payload.quotation.items.some(item=>item?.item_type==='product');
  const taxMetadata=taxMode&&taxMode!=='none'&&productLines?await loadTaxMetadata():new Map();
  let normalized;
  try{normalized=validateQuotation(payload.quotation,taxMetadata);}
  catch(error){c.fail(400,error.message);}
  if(normalized.source_enquiry_id){
    const source=await quotationDb(`enquiries?id=eq.${normalized.source_enquiry_id}&select=id&limit=1`);
    if(!source.length)c.fail(400,'The selected source enquiry could not be found.');
  }
  const result=await quotationDb('rpc/hm_save_quotation','POST',{
    p_quotation_id:quotationId,
    p_data:normalized,
    p_actor_id:user.id,
    p_allow_revision:payload.allow_revision===true
  });
  if(!result||!result.quotation_id)c.fail(503,'The database did not confirm the quotation draft.');
  return c.reply(200,{ok:true,quotation:result});
});
