'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const search=require('../public/catalogue-search.js');

const browser={window:{}};
vm.runInNewContext(fs.readFileSync('public/data.js','utf8'),browser);
const products=browser.window.HM_DATA.materials;

test('all source catalogue products are searchable by name, category, size, and both codes',()=>{
 assert.equal(products.length,984);
 assert.equal(new Set(products.map(product=>product.id)).size,products.length);
 for(const product of products){
  for(const field of ['name','category','size','id','sourceCode']){
   assert.ok(search.matchesProduct(product,product[field]),`${product.id} should match ${field}: ${product[field]}`);
  }
 }
});

test('search includes source specifications, optional HSN, and non-destructive synonyms',()=>{
 const item={id:'X-1',sourceCode:'SRC-1',requestedCode:'REQ-1',name:'MCB SP',category:'Electrical Protection',group:'MCB',size:'6A',unit:'Nos',specification:'verified specification zinc plated',description:'documented example description',hsn:'8536'};
 for(const term of ['MCB','miniature circuit breaker','single pole','1 pole','circuit breaker','switchgear','8536','REQ-1','6 a','zinc plated','documented example']){
  assert.ok(search.matchesProduct(item,term),`Expected match for "${term}"`);
 }
 assert.equal(search.matchesProduct(item,'fire fighting'),false);
 assert.equal(item.name,'MCB SP');
 assert.equal(item.hsn,'8536');
 assert.equal(search.matches('running project status','project'),true);
 assert.equal(search.matches('running project status','team'),false);
});

test('known catalogue category aliases find materials from the intended category',()=>{
 const cases=[
  ['Fire Fighting','firefighting'],
  ['Plumbing and PHE','public health engineering'],
  ['Fasteners and Hardware','fixings'],
  ['Tools and Machinery','equipment'],
  ['Wires and Cables','electrical cable'],
  ['Switches and Sockets','outlet'],
  ['Cable Management','trunking'],
  ['Electrical Protection','circuit breaker']
 ];
 for(const [category,query] of cases){
  const product=products.find(item=>item.category===category);
  assert.ok(product,`Missing source category ${category}`);
  assert.ok(search.matchesProduct(product,query),`${category} should match "${query}"`);
 }
});

test('catalogue photo and technical metadata gaps remain explicit and source files resolve',()=>{
 assert.equal(products.filter(product=>product.image&&!/placeholder|illustration/i.test(product.image)).length,0);
 assert.equal(products.filter(product=>product.imageVerified===true||product.photoRightsVerified===true).length,0);
 assert.equal(products.filter(product=>product.hsn||product.hsnCode||product.HSN).length,0);
 assert.equal(products.filter(product=>product.description||product.specification||product.specifications).length,0);
 for(const product of products){
  assert.ok(product.image,`${product.id} should retain its source image field`);
  assert.ok(fs.existsSync(`public/${product.image}`),`${product.id} image reference should resolve`);
  assert.ok(product.size,`${product.id} should retain its source specification/size`);
  assert.ok(product.unit,`${product.id} should retain its source unit`);
 }
});

test('individual product routes preserve the existing SEO slug format and remain unique',()=>{
 const routes=products.map(search.productPath);
 assert.equal(new Set(routes).size,products.length);
 assert.ok(routes.every(route=>/^\/products\/[a-z0-9-]+\/$/.test(route)));
 for(const product of products){
  const expected=`/products/${`${product.id} ${product.name} ${product.size}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}/`;
  assert.equal(search.productPath(product),expected);
 }
});
