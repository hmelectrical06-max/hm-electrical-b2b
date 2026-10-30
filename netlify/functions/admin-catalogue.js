'use strict';

const c=require('../../server/core.cjs');
const catalogue=require('../../server/catalogue.json')
  .filter(product=>!String(product.sourceCode||'').startsWith('WORK-'));
const {csvColumns,parseCsv,validateRows,exportCsv}=require('../../server/catalogue-metadata.cjs');
const migrationMessage='Catalogue metadata is not set up yet. Review and apply supabase/migrations/20261029_000001_catalogue_metadata.sql to the intended Supabase project.';

async function loadMetadata(){
  try{
    const rows=await c.db('catalogue_product_metadata?select=*&limit=1000');
    return new Map(rows.map(row=>[row.product_id,row]));
  }catch(error){
    if(error.message==='A required service endpoint was not found. Check the Supabase URL and apply database/setup.sql.')c.fail(503,migrationMessage);
    throw error;
  }
}

function importRows(payload){
  if(typeof payload.csv!=='string')c.fail(400,'Choose a CSV file first.');
  try{return parseCsv(payload.csv);}
  catch(error){c.fail(400,error.message);}
}

exports.handler=c.safe(async event=>{
  const user=await c.admin(event);
  if(event.httpMethod==='GET'){
    const metadata=await loadMetadata();
    const products=catalogue.map(product=>({...product,metadata:metadata.get(product.id)||{}}));
    if(event.queryStringParameters?.format==='csv'){
      return {
        statusCode:200,
        headers:{
          'Content-Type':'text/csv; charset=utf-8',
          'Content-Disposition':'attachment; filename="hm-catalogue-metadata.csv"',
          'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff'
        },
        body:exportCsv(products)
      };
    }
    return c.reply(200,{ok:true,total:products.length,columns:csvColumns,products});
  }
  if(event.httpMethod!=='POST')return c.reply(405,{ok:false,message:'Method not allowed.'});
  c.origin(event);
  const payload=c.body(event,4*1024*1024);
  const parsed=importRows(payload);
  const result=validateRows(parsed,catalogue);
  if(payload.action==='preview-import'){
    return c.reply(200,{
      ok:true,total:parsed.length,valid:result.valid.length,invalid:result.invalid,
      products:result.valid.map(item=>({
        line:item.line,product_id:item.product.id,name:item.product.name,
        size:item.product.size,unit:item.product.unit,fields:Object.keys(item.changes).length-1
      }))
    });
  }
  if(payload.action!=='save-import')c.fail(400,'Choose preview-import or save-import.');
  if(result.invalid.length)c.fail(400,`Import cancelled: fix ${result.invalid.length} invalid or duplicate CSV row(s) before saving.`);
  if(!result.valid.length)c.fail(400,'The CSV contains no valid catalogue metadata rows.');
  const metadataRows=result.valid.map(item=>({
    ...item.changes,
    updated_by:user.id,
    updated_at:new Date().toISOString()
  }));
  const stored=await c.db(
    'catalogue_product_metadata?on_conflict=product_id',
    'POST',
    metadataRows,
    {Prefer:'resolution=merge-duplicates,return=representation'}
  );
  if(!Array.isArray(stored)||stored.length!==metadataRows.length)c.fail(503,'The database did not confirm every catalogue metadata row.');
  return c.reply(200,{ok:true,saved:stored.length});
});
