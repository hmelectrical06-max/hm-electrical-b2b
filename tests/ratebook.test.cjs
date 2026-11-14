'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const r=require('../server/ratebook.cjs');
test('customer rate uses an explicit owner markup on buying cost with no automatic margin',()=>{
 assert.equal(r.sellingRate(r.net(1000,65),20),420);
 assert.equal(r.sellingRate(100,18),118);
 assert.equal(r.sellingRate(100,0),100);
 assert.equal(r.sellingRate(155.10,12.5),174.49);
 for(const value of ['',undefined,null,-1,1000.01,true])assert.throws(()=>r.sellingRate(100,value));
 const row={printed_mrp:1000,brand:'Ajay',supplier_id:'s',discount_rule_id:'r'};
 assert.equal(r.decorate(row,[{id:'r',supplier_id:'s',brand:'Ajay',discount_percent:45}]).indicative_selling_floor,null);
});
test('MRP discounts and minimum 18 percent selling margin use independent exact rules',()=>{
 assert.equal(r.net(1000,65),350);assert.equal(r.net(1000,51),490);assert.equal(r.net(1000,42),580);assert.equal(r.net(1000,45),550);
 assert.equal(r.sellingFloor(100,18),121.96);assert.equal(r.sellingFloor(350,18),426.83);
 for(const v of ['',null,NaN,-1,true,Infinity,' ',.001])assert.throws(()=>r.net(v,45));
 for(const v of [-1,100.01,''])assert.throws(()=>r.net(100,v));assert.throws(()=>r.sellingFloor(100,17.99));
 for(let cents=1;cents<20000;cents+=17){const cost=cents/100,price=r.sellingFloor(cost,18);assert.ok((price-cost)/price>=.18-1e-12);}
});
test('confirmed selling plans become stale when the price, discount or specification changes',()=>{
 const rule={id:'r',brand:'Ajay',supplier_id:'s',discount_percent:45,updated_at:'2026-11-12T10:00:00+00:00'};
 const plan={landed_cost:100,margin:18,selling_floor:121.96,confirmed_at:'2026-11-12T10:00:00.000Z'},row={brand:'Ajay',supplier_id:'s',discount_rule_id:'r',printed_mrp:200,review_status:'Verified reference',updated_at:'2026-11-12T10:00:00+00:00',source_details:{pricing_plan:plan}};
 assert.deepEqual(r.decorate(row,[rule]).saved_selling_plan,plan);
 assert.equal(r.decorate(row,[{...rule,updated_at:'2026-11-12T10:00:01Z'}]).saved_selling_plan,null);
 assert.equal(r.decorate({...row,material:{updated_at:'2026-11-13T10:00:00Z'}},[rule]).saved_selling_plan,null);
});
test('a different supplier or make cannot supply the discount; unreviewed rates are gated',()=>{
 const row={printed_mrp:1000,brand:'Ajay',supplier_id:'s1',discount_rule_id:'r1',review_status:'Verified reference'};
 assert.equal(r.decorate(row,[{id:'r1',supplier_id:'s1',brand:'Ajay',discount_percent:45}]).discounted_mrp,550);
 assert.equal(r.decorate(row,[{id:'r1',supplier_id:'s1',brand:'Supreme',discount_percent:42}]).discounted_mrp,null);
 assert.equal(r.decorate(row,[{id:'r1',supplier_id:'s2',brand:'Ajay',discount_percent:45}]).quote_ready,false);
 assert.equal(r.decorate({...row,review_status:'Needs review'},[{id:'r1',supplier_id:'s1',brand:'Ajay',discount_percent:45}]).quote_ready,false);
});
test('ratebook denies anonymous access before database reads',async()=>{
 const handler=require('../netlify/functions/admin-ratebook').handler;
 for(const method of ['GET','POST']){const out=await handler({httpMethod:method,headers:{},queryStringParameters:{},body:'{}'});assert.equal(out.statusCode,401);assert.ok(!out.body.includes('discount_percent'));}
});
test('private price tables have RLS and no public/client grant; public serializers never use them',()=>{
 const sql=fs.readFileSync('database/private-ratebook.sql','utf8');for(const t of ['hm_material_master','hm_supplier_discount_rules','hm_supplier_price_rows'])assert.ok(sql.includes('alter table public.'+t+' enable row level security'));
 assert.ok(sql.includes('from public,anon,authenticated'));assert.ok(sql.includes('hm_record_audit'));
 const pub=fs.readFileSync('netlify/functions/public-content.js','utf8');assert.ok(!pub.includes('hm_supplier_price_rows'));
});
test('private ratebook renders one parent item with two make references and gates unreviewed calculator',async()=>{
 const dom=new JSDOM('<nav aria-label="Daily work"><details><summary>More</summary><div></div></details></nav><div id="workspace"></div>',{runScripts:'outside-only',url:'https://hmelectricalb2b.com/admin/'}),w=dom.window;
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.json=(method,body)=>({method,body});w.HM_DOWNLOADS={save(){}};
 const material={id:'material',name:'CPVC pipe SDR 11 3 mtr',specification:'15 mm',unit:'Nos'},rules=[{id:'rule',brand:'Ajay',supplier_id:'supplier',scope:'Supplied MRP list',discount_percent:45}];
 w.api=async name=>({json:async()=>name.includes('rules=1')?{rules,suppliers:[{id:'supplier',company_name:'Supplier'}]}:{rules,rows:[{id:'one',material_id:'material',material,brand:'Ajay',supplier:{company_name:'Supplier'},printed_mrp:282,discounted_mrp:155.1,discount_percent:45,review_status:'Verified reference',quote_ready:true},{id:'two',material_id:'material',material,brand:'Supreme',supplier:{company_name:'Supplier'},printed_mrp:212,discounted_mrp:122.96,discount_percent:42,review_status:'Needs review',quote_ready:false}],more:false}});
 w.eval(fs.readFileSync('public/admin/admin-ratebook.js','utf8'));w.document.querySelector('[data-ratebook]').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.document.querySelectorAll('.ratebook-material').length,1);assert.equal(w.document.querySelectorAll('[data-calculate]').length,2);assert.equal(w.document.querySelector('[data-calculate="two"]').disabled,true);
 w.document.querySelector('[data-calculate="one"]').click();assert.equal(w.document.querySelector('[name="markup"]').value,'');assert.equal(w.document.querySelector('[name="landed_cost"]').value,'');
 dom.window.close();
});
