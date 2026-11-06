'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const c=require('../server/core.cjs'),seo=require('../server/public-product-seo.cjs');
const id='ADD-12345678-1234-4123-8123-123456789abc';
const row=()=>({product_id:id,data:{id,name:'New MCB',size:'16A',unit:'Nos',category:'Electrical Protection',group:'MCB',description:'Confirm rating',hidden:false,private_note:'NEVER-PUBLISH',purchase_price:876543210}});
test('new material page renders crawlable content, escaped text and no private fields',()=>{
 const p=seo.view(row(),{brand:'<script>bad</script>',purchase_price:999,retail_price:888});const html=seo.page(p);
 assert.match(html,/New MCB/);assert.match(html,/rel="canonical"/);assert.match(html,/index,follow/);assert.match(html,/Enquire about this specification/);assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);
 assert.doesNotMatch(html,/NEVER-PUBLISH|876543210|purchase_price|retail_price|"@type":"Product"/);assert.match(html,/representative illustration/);assert.match(html,/BreadcrumbList/);
});
test('live sitemap includes new and edited stable paths but excludes hidden records and private values',()=>{
 const a=row(),b=row();b.product_id='QA-8000';b.data={...b.data,_seoPath:'/products/qa-8000-original-name/'};const hidden=row();hidden.data.hidden=true;
 const xml=seo.sitemap([a,b,hidden]);assert.equal((xml.match(/<url>/g)||[]).length,2);assert.ok(xml.includes(seo.domain+seo.route({...a.data,id})));assert.match(xml,/qa-8000-original-name/);assert.doesNotMatch(xml,/NEVER-PUBLISH|123456<|purchase_price/);
 assert.throws(()=>seo.route({_seoPath:'https://evil.invalid/'}));
});
test('new material IDs support private rate/photo workflows without allowing query injection',async()=>{
 const original=c.db,queries=[];c.db=async q=>{queries.push(q);return[row()];};
 try{assert.equal((await require('../server/live-catalogue.cjs').product(id)).id,id);assert.match(queries[0],/123456789abc/);await assert.rejects(()=>require('../server/live-catalogue.cjs').product(id+'&select=*'));assert.equal(queries.length,1);}finally{c.db=original;}
});
test('live page serves new materials, preserves canonical paths and fails closed for hidden or unavailable data',async()=>{
 const original=c.db,previous={HM_SITE_MODE:process.env.HM_SITE_MODE,HM_LAUNCH_APPROVED:process.env.HM_LAUNCH_APPROVED};
 process.env.HM_SITE_MODE='production';process.env.HM_LAUNCH_APPROVED='true';const saved=row();saved.data._seoPath=seo.route({...saved.data,id});
 const e={httpMethod:'GET',queryStringParameters:{slug:saved.data._seoPath.slice('/products/'.length)}};
 const handler=require('../netlify/functions/public-product-page.js').handler;
 let mode='ok';c.db=async q=>{if(mode==='unavailable')throw Error('SECRET');return q.startsWith('hm_catalogue_products?')?(mode==='missing'?[]:[{...saved,data:{...saved.data,hidden:mode==='hidden'}}]):[{purchase_price:999999,brand:'Example'}];};
 try{
  const r=await handler(e);assert.equal(r.statusCode,200);assert.match(r.body,/Example/);assert.doesNotMatch(r.body,/999999|purchase_price/);
  assert.equal((await handler({...e,httpMethod:'HEAD'})).body,'');
  const moved=await handler({...e,queryStringParameters:{slug:id.toLowerCase()+'-wrong-name/'}});assert.equal(moved.statusCode,301);assert.equal(moved.headers.Location,saved.data._seoPath);
  mode='hidden';assert.equal((await handler(e)).statusCode,404);mode='missing';assert.equal((await handler(e)).statusCode,404);mode='unavailable';const down=await handler(e);assert.equal(down.statusCode,503);assert.equal(down.headers['X-Robots-Tag'],'noindex');assert.ok(!down.body.includes('SECRET'));
  delete process.env.HM_SITE_MODE;assert.equal((await handler(e)).statusCode,404);
 }finally{c.db=original;for(const [k,v]of Object.entries(previous))v===undefined?delete process.env[k]:process.env[k]=v;}
});

test('renaming an existing material keeps its established static SEO path',()=>{const p=require('../server/catalogue.json')[0];assert.equal(seo.route({...p,name:'Changed name',size:'Changed size'}),require('../public/catalogue-search.js').productPath(p));});
