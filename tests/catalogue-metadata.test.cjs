'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalogue=require('../server/catalogue.json');
const {csvColumns,parseCsv,validateRows,exportCsv}=require('../server/catalogue-metadata.cjs');
const adminCatalogue=require('../netlify/functions/admin-catalogue.js');

const products=catalogue.filter(product=>!String(product.sourceCode||'').startsWith('WORK-'));
const first=products[0];
const header=csvColumns.join(',');
const csvRow=values=>csvColumns.map(column=>'"'+String(values[column]??'').replaceAll('"','""')+'"').join(',');

test('CSV export preserves the existing product IDs and leaves unverified fields blank',()=>{
  const csv=exportCsv(products);
  assert.ok(csv.startsWith('\uFEFF'));
  const rows=parseCsv(csv);
  assert.equal(rows.length,984);
  assert.equal(rows[0].product_id,first.id);
  assert.equal(rows[0].mrp,'');
  assert.equal(rows[0].manufacturer_sku,'');
  assert.equal(new Set(rows.map(row=>row.product_id)).size,984);
});

test('CSV parser handles quoted commas, newlines, and escaped quotes',()=>{
  const parsed=parseCsv(`${header}\r\n${csvRow({
    product_id:first.id,brand:'Brand, Series',manufacturer:'Manufacturer',manufacturer_sku:'SKU-1',
    manufacturer_source_url:'https://manufacturer.example/product',specifications:'Line one\nLine "two"',hsn:'8536'
  })}`);
  assert.equal(parsed[0].brand,'Brand, Series');
  assert.equal(parsed[0].specifications,'Line one\nLine "two"');
});

test('CSV parser rejects malformed headers, unclosed quotes, and oversized input',()=>{
  assert.throws(()=>parseCsv('product_id,brand\nMAT-8000,Brand'),/CSV headers must match/);
  assert.throws(()=>parseCsv(`${header}\n${first.id},"unfinished`),/unclosed quoted field/);
  assert.throws(()=>parseCsv('x'.repeat(3*1024*1024+1)),/exceeds 3 MB/);
});

test('metadata import matches exact catalogue IDs and validates prices, tax, photo and duplicate rows',()=>{
  const payloads=[
    {product_id:first.id,brand:'Example brand',manufacturer_sku:'OFFICIAL-1',manufacturer_source_url:'https://manufacturer.example/sku',mrp:'120.50',mrp_source_url:'https://manufacturer.example/prices',mrp_verified_at:'2026-10-29',gst_rate:'18',tax_source_url:'https://gst.example/tax',tax_verified_at:'2026-10-29',public_price_mode:'mrp'},
    {product_id:'MAT-NOT-IN-CATALOGUE',brand:'Invented'},
    {product_id:first.id,brand:'Duplicate'},
    {product_id:products[1].id,wholesale_price:'-10'},
    {product_id:products[2].id,gst_rate:'101'},
    {product_id:products[3].id,product_photo_url:'http://example.test/photo.jpg'},
    {product_id:products[4].id,product_photo_url:'https://example.test/photo.jpg',photo_rights_source_url:'https://example.test/licence',photo_rights_verified:'true'},
    {product_id:products[5].id,product_photo_url:'https://example.test/photo.jpg',photo_rights_verified:'true'},
    {product_id:products[6].id,brand:'No source'},
    {product_id:products[7].id,hsn:'12345',tax_source_url:'https://gst.example/tax',tax_verified_at:'2026-10-29'}
  ];
  const result=validateRows(payloads,products);
  assert.equal(result.valid.length,2);
  assert.deepEqual(result.valid[0].changes,{
    product_id:first.id,brand:'Example brand',manufacturer_sku:'OFFICIAL-1',
    manufacturer_source_url:'https://manufacturer.example/sku',
    mrp_source_url:'https://manufacturer.example/prices',mrp_verified_at:'2026-10-29',
    tax_source_url:'https://gst.example/tax',tax_verified_at:'2026-10-29',
    mrp:120.5,gst_rate:18,public_price_mode:'mrp'
  });
  assert.equal(result.valid[1].changes.photo_rights_verified,true);
  assert.equal(result.invalid.length,8);
  assert.match(result.invalid[0].message,/does not match an existing material/);
  assert.match(result.invalid[1].message,/Duplicate product ID/);
  assert.match(result.invalid[2].message,/non-negative number/);
  assert.match(result.invalid[3].message,/between 0 and 100/);
  assert.match(result.invalid[4].message,/HTTPS URL/);
  assert.match(result.invalid[5].message,/rights-source URLs/);
  assert.match(result.invalid[6].message,/official HTTPS source/);
  assert.match(result.invalid[7].message,/4, 6 or 8 digits/);
});

test('blank CSV values do not create clearing changes',()=>{
  const result=validateRows([{product_id:first.id,brand:'',mrp:'',gst_rate:''}],products);
  assert.deepEqual(result.valid[0].changes,{product_id:first.id});
});

test('catalogue migration is additive and restricts metadata to server-role access',()=>{
  const migration=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','20261029_000001_catalogue_metadata.sql'),'utf8').toLowerCase();
  assert.match(migration,/create table if not exists public\.catalogue_product_metadata/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on public\.catalogue_product_metadata from public, anon, authenticated/);
  assert.match(migration,/grant select, insert, update, delete on public\.catalogue_product_metadata to service_role/);
  assert.doesNotMatch(migration,/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\bdrop\s+schema\b/);
  assert.match(migration,/mrp is null or \(mrp_source_url is not null and mrp_verified_at is not null\)/);
  assert.match(migration,/hsn is null and gst_rate is null/);
});

test('admin catalogue API previews without writes and uses a merge-only upsert',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_USER_IDS','SITE_ORIGIN'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch,requests=[];
  Object.assign(process.env,{
    SUPABASE_URL:'https://catalogue-test.invalid',
    SUPABASE_ANON_KEY:'test-only-anon-key',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',
    ADMIN_USER_IDS:'00000000-0000-4000-8000-000000000601',
    SITE_ORIGIN:'http://localhost:8888'
  });
  global.fetch=async(url,options={})=>{
    const target=String(url);requests.push({target,options});
    if(target.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000601'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/rest/v1/catalogue_product_metadata?select=*&limit=1000'))return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/rest/v1/catalogue_product_metadata?on_conflict=product_id')){
      const body=JSON.parse(options.body);
      return new Response(JSON.stringify(body),{status:201,headers:{'Content-Type':'application/json'}});
    }
    throw new Error('Unexpected mocked fetch target.');
  };
  try{
    const csv=`${header}\r\n${csvRow({
      product_id:first.id,brand:'Verified brand',manufacturer_source_url:'https://manufacturer.example/sku',mrp:'120.50',
      mrp_source_url:'https://manufacturer.example/prices',mrp_verified_at:'2026-10-29'
    })}`;
    const baseEvent={httpMethod:'POST',headers:{cookie:'__Host-hm_admin=session-token',origin:'http://localhost:8888','content-type':'application/json'}};
    const preview=await adminCatalogue.handler({...baseEvent,body:JSON.stringify({action:'preview-import',csv})});
    assert.equal(preview.statusCode,200,preview.body);
    assert.equal(JSON.parse(preview.body).valid,1);
    assert.equal(requests.some(item=>item.target.includes('/rest/v1/catalogue_product_metadata?on_conflict=')),false);

    const save=await adminCatalogue.handler({...baseEvent,body:JSON.stringify({action:'save-import',csv})});
    assert.equal(save.statusCode,200,save.body);
    assert.equal(JSON.parse(save.body).saved,1);
    const write=requests.find(item=>item.target.includes('/rest/v1/catalogue_product_metadata?on_conflict='));
    assert.equal(write.options.method,'POST');
    assert.equal(write.options.headers.Prefer,'resolution=merge-duplicates,return=representation');
    assert.equal(JSON.parse(write.options.body)[0].product_id,first.id);
    assert.equal(JSON.parse(write.options.body)[0].updated_by,'00000000-0000-4000-8000-000000000601');
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('admin catalogue export is authenticated and exports CSV',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_USER_IDS'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch;
  Object.assign(process.env,{
    SUPABASE_URL:'https://catalogue-export-test.invalid',
    SUPABASE_ANON_KEY:'test-only-anon-key',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',
    ADMIN_USER_IDS:'00000000-0000-4000-8000-000000000602'
  });
  global.fetch=async(url)=>{
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000602'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(String(url).includes('/rest/v1/catalogue_product_metadata?select=*&limit=1000'))return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    throw new Error('Unexpected mocked fetch target.');
  };
  try{
    const response=await adminCatalogue.handler({
      httpMethod:'GET',queryStringParameters:{format:'csv'},
      headers:{cookie:'__Host-hm_admin=session-token'}
    });
    assert.equal(response.statusCode,200);
    assert.match(response.headers['Content-Type'],/text\/csv/);
    assert.equal(parseCsv(response.body).length,984);
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});
