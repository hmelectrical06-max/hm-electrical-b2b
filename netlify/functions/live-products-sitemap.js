'use strict';
const live=require('../../server/live-catalogue.cjs'),seo=require('../../server/public-product-seo.cjs');
exports.handler=async e=>{
 const headers={'Content-Type':'application/xml; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'};
 if(!['GET','HEAD'].includes(e.httpMethod))return {statusCode:405,headers:{...headers,Allow:'GET, HEAD'},body:''};
 if(process.env.HM_SITE_MODE!=='production'||process.env.HM_LAUNCH_APPROVED!=='true')return {statusCode:404,headers,body:''};
 try{const rows=await live.all('hm_catalogue_products?select=product_id,data&order=product_id');return {statusCode:200,headers:{...headers,'Cache-Control':'public, max-age=0, s-maxage=30, must-revalidate'},body:e.httpMethod==='HEAD'?'':seo.sitemap(rows)};}catch{return {statusCode:503,headers:{...headers,'Retry-After':'60'},body:''};}
};
