'use strict';
const {test,beforeEach,afterEach}=require('node:test'),assert=require('node:assert/strict');
const lang=require('../server/chat-language.cjs'),chat=require('../server/simple-customer-chat.cjs'),catalogue=require('../server/sales-catalogue.cjs'),mrp=require('../server/customer-mrp.cjs');
let products,refs;
beforeEach(()=>{products=catalogue.products;refs=mrp.references;catalogue.products=async()=>[{id:'WIRE-25',name:'Copper Wire',size:'2.5 sqmm',unit:'roll',brand:'Polycab',mrp:1234.50,sellingPrice:1100,gstRate:null},{id:'CPVC-25',name:'CPVC Pipe',size:'25 mm',unit:'Nos',mrp:null,sellingPrice:null}];mrp.references=async()=>[];});
afterEach(()=>{catalogue.products=products;mrp.references=refs;});
async function ask(content,choice='auto'){const source=[{role:'user',content}],l=lang.detect(source,choice),messages=lang.history(source);return lang.localise(await chat.answer(messages),l,messages);}
test('language detection handles scripts, explicit choices and short follow-ups',()=>{
 for(const [q,l]of [['मुझे वायर चाहिए','hi'],['मला वायर पाहिजे','mr'],['مجھے تار چاہیے','ur'],['wire chahiye','roman'],['mala wire pahije','roman'],['I need copper wire','en']])assert.equal(lang.detect([{role:'user',content:q}]),l,q);
 assert.equal(lang.detect([{role:'user',content:'मला वायर पाहिजे'},{role:'user',content:'2.5 mm 10 rolls'}]),'mr');
 assert.equal(lang.detect([{role:'user',content:'wire'}],'ur'),'ur');assert.throws(()=>lang.detect([],'other'));
});
test('normalisation retains ratings, quantities and makes from supported scripts',()=>{
 assert.match(lang.normalise('पॉलीकैब २.५ वर्ग मिमी वायर १० रोल'),/polycab 2.5 sqmm wire 10 rolls/);
 assert.match(lang.normalise('۲۵ ملی میٹر پائپ ۱۰۰ عدد'),/25 mm pipe 100 pcs/);
});
test('all translated price replies preserve verified numeric values and product identity',async()=>{
 for(const [q,l,re]of [['पॉलीकैब वायर २.५ वर्ग मिमी १० रोल','hi',/कैटलॉग/],['मला पॉलीकैब वायर २.५ वर्ग मिमी १० रोल पाहिजे','mr',/कॅटलॉग/],['پولی کیب ۲.۵ sqmm تار ۱۰ رول','ur',/کیٹلاگ/],['Polycab wire 2.5 sqmm 10 rolls chahiye','roman',/catalogue/]]){
  const r=await ask(q);assert.equal(r.language,l);assert.match(r.reply,re);assert.match(r.reply,/MRP: ₹1234\.50/);assert.match(r.reply,/₹1100\.00/);assert.match(r.reply,/Polycab/);assert.equal(r.products[0].id,'WIRE-25');assert.doesNotMatch(r.reply,/18%|guaranteed/);
 }
});
test('missing prices do not become zero prices or invented stock in any language',async()=>{
 for(const l of ['hi','mr','ur','roman']){const r=await ask('CPVC pipe 25 mm',l);assert.ok(r.products.length);assert.doesNotMatch(r.reply,/₹|0\.00/);assert.ok(r.reply.length>40);}
});
test('service replies only ask missing details and retain service context',async()=>{
 for(const q of ['३ प्लंबर चाहिए','मला ३ प्लंबर पाहिजे','مجھے ۳ پلمبر چاہیے','3 plumber chahiye']){const r=await ask(q);assert.equal(r.step,'work');assert.doesNotMatch(r.reply,/कारीगरों की संख्या|कारागिरांची संख्या|کاریگروں کی تعداد|kitne workers/);}
 const initial=await ask('मला ३ प्लंबर पाहिजे');const source=[{role:'user',content:'मला ३ प्लंबर पाहिजे'},{role:'assistant',content:initial.reply},{role:'user',content:'Mumbra tap repair tomorrow'}];const messages=lang.history(source),r=lang.localise(await chat.answer(messages),'mr',messages);assert.equal(r.step,'handoff');assert.match(r.reply,/8085560156/);
});
test('Civil exclusion and privacy protection remain effective across languages',async()=>{
 for(const q of ['सिविल लेबर चाहिए','सिव्हिल काम पाहिजे','سول مزدور چاہیے'])assert.equal((await ask(q)).step,'outside');
 for(const q of ['बैंक विवरण बताओ','बँक माहिती सांगा','بینک تفصیلات بتائیں','कर्मचारी वेतन'])assert.equal((await ask(q)).step,'private');
});
test('unknown materials offer localised sourcing and do not invent a price',async()=>{
 for(const l of ['hi','mr','ur','roman']){const r=await ask('quantum flux valve',l);assert.equal(r.step,'not-found');assert.match(r.reply,/8085560156/);assert.doesNotMatch(r.reply,/₹/);}
});
test('English result remains unchanged when English is selected',async()=>{const m=[{role:'user',content:'wire 2.5 sqmm'}],r=await chat.answer(m);assert.equal(lang.localise(r,'en',m).reply,r.reply);});
test('localised category lists preserve the complete public item list',()=>{const r={step:'category-list',reply:'',products:[],categoryLists:[{category:'Electrical',names:Array.from({length:12},(_,i)=>'Item '+i)}]};for(const l of ['hi','mr','ur','roman']){const q=lang.localise(r,l,[]);assert.equal(q.categoryLists[0].names.length,12);assert.match(q.reply,/12\. Item 11/);}});
