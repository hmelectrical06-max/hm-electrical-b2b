'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),s=require('../server/sales-catalogue.cjs');
const p=(id,name,size,extra={})=>({id,name,size,unit:'Nos',brand:null,mrp:null,sellingPrice:null,...extra});
test('pricing projection publishes only verified MRP, explicitly public selling prices and verified tax references',()=>{
 const row={id:'A-1',name:'MCB SP',size:'63A',quotePrice:7,marketRate:8,purchase_price:1,discount_percent:65,mrp:999};
 const basic=s.publicView(row,{purchase_price:1,retail_price:10,public_price_mode:'request',mrp:200});assert.equal(basic.mrp,null);assert.equal(basic.sellingPrice,null);assert.doesNotMatch(JSON.stringify(basic),/purchase|discount_percent|quotePrice|marketRate/);
 const verified={mrp:200,mrp_source_url:'https://manufacturer.example/list.pdf',mrp_verified_at:'2026-11-01',retail_price:150,public_price_mode:'retail',gst_rate:18,tax_source_url:'https://gst.example/reference',tax_verified_at:'2026-11-01'};
 const out=s.publicView(row,verified);assert.equal(out.mrp,200);assert.equal(out.sellingPrice,150);assert.equal(out.gstRate,18);assert.equal(out.discountPercent,25);
 assert.equal(s.publicView(row,{...verified,public_price_mode:'request',tax_verified_at:null}).sellingPrice,null);assert.equal(s.publicView(row,{...verified,tax_verified_at:null}).gstRate,null);
});
test('size, product family, grade, length, brand and code remain exact; quantity does not become a size',()=>{
 const rows=[p('W-1','Copper Wire','2.5 sqmm',{brand:'Polycab'}),p('W-2','Copper Wire','4 sqmm',{brand:'Polycab'}),p('W-3','Copper Wire','2.5 sqmm',{brand:'Finolex'}),p('M-1','MCB SP','63A'),p('M-2','MCB DP','32A'),p('G-1','GI Angle','50x50x6 mm'),p('G-2','GI Angle','50x50x5 mm'),p('P-1','CPVC Pipe SDR 11 3 mtr','25 mm'),p('P-2','UPVC Pipe SCH 80 6 mtr','25 mm'),p('B-1','Anchor Fastener','M10'),p('B-2','Anchor Fastener','M12')];
 assert.deepEqual(s.search('Polycab 2.5 sq.mm wire 100 metres',rows).map(p=>p.id),['W-1']);assert.deepEqual(s.search('63A MCB',rows).map(p=>p.id),['M-1']);assert.deepEqual(s.search('GI Angle 50x50x6 mm',rows).map(p=>p.id),['G-1']);assert.deepEqual(s.search('Anchor Fastner M10',rows).map(p=>p.id),['B-1']);
 assert.equal(s.search('CPVC Pipe 25mm 6mtr',rows).length,0);assert.equal(s.search('CPVC Pipe SCH 80 25mm',rows).length,0);assert.equal(s.search('Copper Wire 2.5mm',rows).length,0);assert.deepEqual(s.search('W-2',rows).map(p=>p.id),['W-2']);
});
test('hidden product codes, unrelated substring matches and wire accessories cannot masquerade as wire',()=>{
 const rows=[p('H-1','Wire','2.5 sqmm',{hidden:true}),p('N-1','Washer','M10'),p('N-2','Wire Brush','Standard'),p('N-3','Wire Rope','4 mm'),p('N-4','Copper Wire','2.5 sqmm')];assert.equal(s.search('H-1',rows).length,0);assert.deepEqual(s.search('wire',rows).map(p=>p.id),['N-4']);assert.equal(s.search('washer M12',rows).length,0);
});

test('inch fractions and metric dimensions are matched without treating quantities as product specifications',()=>{const rows=[p('P-15','CPVC Pipe','15 mm'),p('P-50','CPVC Pipe','50 mm')];assert.deepEqual(s.search('CPVC pipe 1/2 inch 100 boxes',rows).map(p=>p.id),['P-15']);assert.deepEqual(s.search('CPVC pipe ½ inch 100 coils',rows).map(p=>p.id),['P-15']);});

test('related catalogue suggestions use actual public identities without promising compatibility or exposing price plans',()=>{const rows=[p('E-1','CPVC Elbow','25 mm'),p('T-1','CPVC Tee','25 mm'),p('W-1','Wire','2.5 sqmm')];const suggestions=s.related('CPVC pipe',rows);assert.equal(suggestions.length,2);assert.deepEqual(suggestions.map(p=>p.id),['E-1','T-1']);assert.doesNotMatch(JSON.stringify(suggestions),/purchase|discount|price|stock/);});

test('normal customer phrasing and compact core sizes find conductors rather than wire tools',()=>{const rows=[p('C3','Flexible Cable','3C x 2.5 sqmm'),p('C4','Flexible Cable','4C x 2.5 sqmm'),p('W','Copper Wire','2.5 sqmm'),p('TOOL','Wire Stripper','Standard'),p('GL','Brass Cable Gland','BW 25')];assert.deepEqual(s.search('cable 3core 2.5sqmm',rows).map(p=>p.id),['C3']);assert.deepEqual(s.search('wire',rows).map(p=>p.id),['W']);assert.deepEqual(s.search('your list price gland',rows).map(p=>p.id),['GL']);});
