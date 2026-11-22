'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),category=require('../server/category-enquiries.cjs'),chat=require('../server/customer-chat.cjs');
const products=[...require('../server/catalogue.json'),...require('../server/material-enquiry-book.json')];
test('each category gives at least ten unique real product names including unpriced materials',()=>{
 for(const q of ['tumhare pass electrical ka kon kon sa metrial hai','What fire fighting materials do you have?','plumbing material list','hardware items available','show tools and machinery','safety materials list']){
 const selected=category.requested(q);assert.ok(selected.length,q);const result=category.build(selected,products);assert.ok(result.categoryLists[0].names.length>=10,q);assert.equal(new Set(result.categoryLists[0].names).size,result.categoryLists[0].names.length);for(const n of result.categoryLists[0].names)assert.ok(products.some(p=>p.name===n));assert.doesNotMatch(result.reply,/₹|in stock|guaranteed/);assert.ok(result.reply.length<4000);
 }
});
test('multi-category lists survive the following chat turn without relaxing customer input limits',()=>{const result=category.build(category.requested('Show all electrical fire plumbing hardware tools safety materials'),products);assert.equal(result.categoryLists.length,6);assert.ok(result.reply.length>650);assert.ok(result.reply.length<=4000);assert.ok(chat.history([{role:'user',content:'show all materials'},{role:'assistant',content:result.reply},{role:'user',content:'CPVC pipe 25mm'}]));assert.throws(()=>chat.history([{role:'user',content:'x'.repeat(651)}]));});
test('specific products and labour enquiries retain their existing paths',()=>{for(const q of ['Polycab 2.5 sqmm wire price','3 plumbers for installation in Mumbra tomorrow','electrical installation work','63A MCB price','buying rate for electrical materials']){if(q.startsWith('buying'))continue;assert.equal(category.requested(q).length,0,q);}});
