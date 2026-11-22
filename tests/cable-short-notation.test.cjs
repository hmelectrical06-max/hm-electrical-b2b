'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),chat=require('../server/sales-catalogue.cjs'),browser=require('../public/catalogue-search.js');
const rows=[{id:'AL240',name:'Aluminium Armoured XLPE Cable',size:'3.5C x 240 sqmm',brand:null},{id:'AL300',name:'Aluminium Armoured XLPE Cable',size:'3.5C x 300 sqmm',brand:null},{id:'CU240',name:'Copper armoured power cable',size:'4C x 240 sqmm',brand:null}];
test('decimal core count, slash notation and conductor shorthand match the exact catalogue specification',()=>{
 for(const q of ['3.5C/240sqmm Al cable Rate','3.5 core 240 sqmm aluminium cable','3.5C x 240sqmm AL cable'])assert.deepEqual(chat.search(q,rows).map(p=>p.id),['AL240'],q);
 assert.equal(chat.specs('3.5C/240sqmm Al cable').cores,'3.5');
 assert.deepEqual(chat.search('4C/240sqmm Cu cable',rows).map(p=>p.id),['CU240']);
 assert.equal(chat.search('4C/240sqmm Al cable',rows).length,0);
});
test('storefront search accepts the same abbreviated cable query',()=>{assert.ok(browser.matchesProduct(rows[0],'3.5C/240sqmm Al cable Rate'));assert.equal(browser.matchesProduct(rows[1],'3.5C/240sqmm Al cable Rate'),false);assert.equal(browser.matchesProduct(rows[2],'3.5C/240sqmm Al cable Rate'),false);});
