'use strict';
const c=require('../../server/core.cjs'),seo=require('../../server/public-product-seo.cjs');
const response=(statusCode,body,headers={})=>({statusCode,headers:{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','X-Robots-Tag':'noindex',...headers},body});
exports.handler=async e=>{
 if(!['GET','HEAD'].includes(e.httpMethod))return response(405,'Method not allowed',{'Allow':'GET, HEAD'});
 if(process.env.HM_SITE_MODE!=='production'||process.env.HM_LAUNCH_APPROVED!=='true')return response(404,'Page not found');
 const slug=e.queryStringParameters?.slug||'',match=slug.match(/^(add-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[a-z][a-z0-9]*-\d+)-/);
 if(slug.length>500||!match||!/^[a-z0-9-]+\/?$/.test(slug))return response(404,'Material not found');
 const id=match[1].startsWith('add-')&&match[1].length===40?'ADD-'+match[1].slice(4):match[1].toUpperCase();
 try{
  const rows=await c.db('hm_catalogue_products?product_id=eq.'+encodeURIComponent(id)+'&select=product_id,data&limit=1');
  if(rows.length!==1||!seo.visible(rows[0]))return response(404,'Material not found');
  const canonical=seo.route({...rows[0].data,id});
  if('/products/'+slug.replace(/\/$/,'')+'/'!==canonical)return response(301,'',{'Location':canonical});
  const meta=await c.db('catalogue_product_metadata?product_id=eq.'+encodeURIComponent(id)+'&select=brand,specifications,hsn,product_photo_url,photo_rights_verified,photo_rights_source_url&limit=1');
  return response(200,e.httpMethod==='HEAD'?'':seo.page(seo.view(rows[0],meta[0])),{'X-Robots-Tag':'index, follow','Cache-Control':'public, max-age=0, s-maxage=30, must-revalidate'});
 }catch{return response(503,'Material information is temporarily unavailable. Please retry or contact HM ELECTRICAL.',{'Retry-After':'60'});}
};
