'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),simple=require('../server/simple-customer-chat.cjs'),mrp=require('../server/customer-mrp.cjs');
test('three plumbers get one short work question, then an office handoff without location/date questionnaires',async()=>{
 const first=await simple.answer([{role:'user',content:'3 PLUMBER'}]);assert.equal(first.step,'work');assert.match(first.reply,/services available/);assert.match(first.reply,/Kya kaam/);assert.doesNotMatch(first.reply,/landmark|location|duration|date|shift/i);
 const next=await simple.answer([{role:'user',content:'3 PLUMBER'},{role:'assistant',content:first.reply},{role:'user',content:'Bathroom tap fitting aur repair'}]);assert.equal(next.step,'handoff');assert.match(next.reply,/naam aur mobile/);assert.doesNotMatch(next.reply,/landmark|duration|date|shift/i);
});
test('a plain item name immediately returns available make MRP and never requests a make first',async()=>{
 const old=mrp.references;mrp.references=async()=>[{brand:'Ashirvad',name:'CPVC Pipe SDR11 3m',size:'15 mm',unit:'Nos',mrp:390}];
 try{const p=await simple.answer([{role:'user',content:'CPVC pipe'}]);assert.equal(p.step,'price');assert.match(p.reply,/Ashirvad/);assert.match(p.reply,/390.00/);assert.match(p.reply,/size aur kitni quantity/);assert.doesNotMatch(p.reply,/which brand|preferred make|location/i);assert.ok(p.reply.length<=650);
 const next=await simple.answer([{role:'user',content:'CPVC pipe 15mm'},{role:'assistant',content:p.reply},{role:'user',content:'100 pcs'}]);assert.match(next.reply,/Size aur quantity note/);assert.doesNotMatch(next.reply,/Kaunsa size|Kitni quantity/);
 }finally{mrp.references=old;}
});
test('missing material rates hand off without inventing an amount and civil remains excluded',async()=>{
 const old=mrp.references;mrp.references=async()=>[];
 try{let p=await simple.answer([{role:'user',content:'MCB'}]);assert.equal(p.step,'handoff');assert.match(p.reply,/MRP abhi available nahi/);assert.doesNotMatch(p.reply,/Rs\s*\d/);p=await simple.answer([{role:'user',content:'civil labour excavation'}]);assert.equal(p.step,'outside');}finally{mrp.references=old;}
});
test('available make examples preserve each actual size and omit supplier discounts and costs',()=>{
 const row={review_status:'Verified reference',printed_mrp:390,brand:'Ashirvad',material:{name:'CPVC Pipe',specification:'15 mm',unit:'Nos'},purchase_price:100,discount_percent:65};
 const refs=mrp.select('CPVC pipe',[row,{...row,printed_mrp:500},{...row,brand:'Supreme',printed_mrp:410},{...row,brand:'Ajay',printed_mrp:380}]);assert.equal(refs.length,3);assert.deepEqual(new Set(refs.map(r=>r.brand)),new Set(['Ashirvad','Supreme','Ajay']));assert.doesNotMatch(JSON.stringify(refs),/purchase|discount/);assert.ok(mrp.text(refs).length<=650);
});
