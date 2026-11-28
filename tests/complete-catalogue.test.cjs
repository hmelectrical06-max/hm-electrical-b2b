'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom');
test('complete catalogue refresh adds new specifications and publishes only verified MRP',()=>{
 const dom=new JSDOM('<p id="catalogueSummary"></p><input id="completeCatalogueSearch"><p id="catalogueStatus"></p><table data-complete-catalogue><tbody><tr><td>OLD</td></tr></tbody></table>',{url:'https://example.test/catalogue',runScripts:'outside-only'}),w=dom.window;
 try{w.eval(fs.readFileSync('public/complete-catalogue.js','utf8'));const products=[{id:'NEW-1',name:'Copper wire',size:'2.5 sqmm',unit:'Mtr',mrp:999,purchase_price:10},{id:'NEW-2',name:'MCB',size:'32A',mrp:250,mrpSourceUrl:'https://manufacturer.example/list',mrpVerifiedAt:'2026-11-28'}];
  w.document.dispatchEvent(new w.CustomEvent('hm:content',{detail:{products,services:[{id:'WORK-1',name:'Electrical installation'}]}}));
  assert.equal(w.document.querySelectorAll('tbody tr').length,3);assert.match(w.document.getElementById('catalogueSummary').textContent,/2 materials \+ 1 services/);
  const rows=w.document.querySelectorAll('tbody tr');assert.match(rows[0].textContent,/MRP on request/);assert.doesNotMatch(rows[0].textContent,/999|purchase_price/);assert.match(rows[1].textContent,/₹250/);
  const input=w.document.getElementById('completeCatalogueSearch');input.value='MCB 32A';input.dispatchEvent(new w.Event('input'));assert.equal([...rows].filter(r=>!r.hidden).length,1);assert.match(w.document.getElementById('catalogueStatus').textContent,/1 matching/);
  products[0].name='<script>unsafe</script>';w.document.dispatchEvent(new w.CustomEvent('hm:content',{detail:{products,services:[]}}));assert.equal(w.document.querySelector('tbody script'),null);
 }finally{w.close();}
});
