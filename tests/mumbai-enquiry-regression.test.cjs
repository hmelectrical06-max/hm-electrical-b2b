'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const cat=require('../server/sales-catalogue.cjs'),browser=require('../public/catalogue-search.js'),book=require('../server/material-enquiry-book.json');
const cable={id:'ADD-0017',name:'Flexible Cable',size:'1C x 2.5 sqmm',brand:null,mrp:null,sellingPrice:null};
test('exact live failure matches size, cores and natural request punctuation',()=>{
 for(const q of ['Flexible Cable 1C x 2.5 sqmm, 100 metres. What is the price?','I need flexible cable 1core 2.5sqmm 100 metres in Mumbai.'])assert.equal(cat.search(q,[cable]).length,1,q);
 assert.equal(cat.search('Flexible cable 4C x 2.5 sqmm',[cable]).length,0);
 assert.equal(cat.search('Flexible cable 1C x 4 sqmm',[cable]).length,0);
});
test('Mumbai enquiry phrasing and brand request find generic public catalogue without changing make',()=>{
 const p={id:'WIRE',name:'FR copper wire',size:'2.5 sqmm',brand:null,category:'Wires and Cables'};
 assert.ok(browser.matchesProduct(p,'I need Polycab 2.5 sq mm wire 10 rolls Mumbai price'));
 assert.equal(p.brand,null);
 assert.equal(browser.matchesProduct({...p,brand:'Finolex'},'Polycab 2.5 wire'),false);
});
test('source book includes missing-price records and only whitelisted customer fields',()=>{
 assert.equal(book.length,13399);assert.equal(book.filter(p=>p.mrp>0).length,1686);assert.ok(book.some(p=>p.mrp===null));
 for(const p of book){assert.equal(p.sellingPrice,null);assert.equal(p.availability,'on_request');for(const k of Object.keys(p))assert.ok(['id','name','size','brand','sku','unit','group','mrp','sellingPrice','gstRate','availability','reference'].includes(k),k);}
});
