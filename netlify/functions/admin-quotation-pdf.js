'use strict';

const c=require('../../server/core.cjs');
const {quotePdf}=require('../../server/quotation-pdf.cjs');
const {products}=require('../../server/quotations.cjs');
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unavailableMessage='Quotation database is not set up. Review and apply supabase/migrations/20261029_000003_quotations.sql, after the catalogue metadata migration.';

exports.handler=c.safe(async event=>{
  await c.admin(event);
  if(event.httpMethod!=='GET')return c.reply(405,{ok:false,message:'Method not allowed.'});
  const id=event.queryStringParameters?.id||'';
  if(!uuidPattern.test(id))c.fail(400,'Quotation reference is invalid.');
  const revisionParam=event.queryStringParameters?.revision;
  let quotation;
  try{
    if(revisionParam!==undefined){
      const revision=Number(revisionParam);
      if(!Number.isInteger(revision)||revision<1)c.fail(400,'Quotation revision is invalid.');
      const versions=await c.db(`quotation_versions?quotation_id=eq.${id}&revision=eq.${revision}&select=snapshot&limit=1`);
      if(!versions.length)c.fail(404,'Quotation revision not found.');
      quotation=versions[0].snapshot;
    }else{
      const quotes=await c.db(`quotations?quotation_id=eq.${id}&select=*&limit=1`);
      if(!quotes.length)c.fail(404,'Quotation not found.');
      quotation=quotes[0];
      quotation.items=await c.db(`quotation_items?quotation_id=eq.${id}&select=*&order=line_no.asc`);
    }
  }catch(error){
    if(error.message==='A required service endpoint was not found. Check the Supabase URL and apply database/setup.sql.'){
      c.fail(503,unavailableMessage);
    }
    throw error;
  }
  if(!Array.isArray(quotation.items)||!quotation.items.length)c.fail(503,'Quotation items are missing. Re-save the draft before creating its PDF.');
  const knownProducts=new Map(products.map(product=>[product.id,product]));
  for(const item of quotation.items){
    if(item.item_type==='product'&&!knownProducts.has(item.product_id)){
      c.fail(409,'This quotation includes a product that is no longer in the material catalogue.');
    }
  }
  const pdf=await quotePdf(quotation);
  const filename=`${quotation.quotation_number}-R${quotation.revision}.pdf`.replace(/[^a-zA-Z0-9._-]/g,'-');
  return {
    statusCode:200,
    headers:{
      'Content-Type':'application/pdf',
      'Content-Disposition':`attachment; filename="${filename}"`,
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    },
    isBase64Encoded:true,
    body:pdf.toString('base64')
  };
});
