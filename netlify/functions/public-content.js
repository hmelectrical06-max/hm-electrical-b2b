'use strict';
const c=require('../../server/core.cjs');
exports.handler=c.safe(async e=>{
 if(e.httpMethod!=='GET')return c.reply(405,{ok:false});
 const kind=e.queryStringParameters?.kind||'all';
 if(!['all','products','services','manpower'].includes(kind))c.fail(400,'Invalid content request.');
 const out={ok:true,enabled:process.env.HM_DUAL_SERVICE_ENABLED==='true',observedAt:new Date().toISOString()};
 if(kind==='all'||kind==='products'){
  const [rows,metadata]=await Promise.all([c.db('hm_catalogue_products?select=product_id,data,updated_at&limit=1000'),c.db('catalogue_product_metadata?select=product_id,brand,manufacturer_sku,specifications,hsn,product_photo_url,photo_rights_verified,photo_rights_source_url,mrp,mrp_source_url,mrp_verified_at,availability,updated_at&limit=1000')]);
  const overlay=new Map(metadata.map(r=>[r.product_id,r]));
  out.products=rows.map(r=>{const m=overlay.get(r.product_id)||{},d=r.data;return {...d,id:r.product_id,...(m.brand?{brand:m.brand}:{}),...(m.specifications?{specifications:m.specifications}:{}),...(m.hsn?{hsn:m.hsn}:{}),availability:m.availability||'on_request',verifiedProductPhoto:m.photo_rights_verified===true&&/^https:\/\//.test(m.product_photo_url||'')&&m.photo_rights_source_url?m.product_photo_url:null,...(m.mrp>0&&m.mrp_source_url&&m.mrp_verified_at?{mrp:m.mrp,mrpSourceUrl:m.mrp_source_url,mrpVerifiedAt:m.mrp_verified_at,priceStatus:'Verified'}:{}),updatedAt:m.updated_at||r.updated_at};});
 }
 if(kind==='all'||kind==='services')out.services=(await c.db('hm_service_listings?select=service_id,data,enabled&limit=1000')).map(r=>({...r.data,id:r.service_id,enabled:r.enabled}));
 if(kind==='all'||kind==='manpower')out.manpower=await c.db('hm_manpower_categories?select=trade,description,available_count,availability,updated_at&order=trade.asc');
 return c.reply(200,out,{'Cache-Control':'public, max-age=0, s-maxage=15, must-revalidate'});
});
