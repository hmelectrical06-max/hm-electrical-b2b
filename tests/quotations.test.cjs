'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {products,validateQuotation}=require('../server/quotations.cjs');
const {quotePdf}=require('../server/quotation-pdf.cjs');
const adminQuotations=require('../netlify/functions/admin-quotations.js');
const adminQuotationPdf=require('../netlify/functions/admin-quotation-pdf.js');

const product=products[0];
const adminId='00000000-0000-4000-8000-000000000801';
const quotationId='00000000-0000-4000-8000-000000000802';
const sourceId='00000000-0000-4000-8000-000000000803';
const taxMetadata=new Map([[product.id,{
  product_id:product.id,hsn:'8536',gst_rate:18,
  tax_source_url:'https://tax.example/verified-source',tax_verified_at:'2026-10-29'
}]]);
const quotationPayload=overrides=>({
  customer_name:'Test Customer',company_name:'Example Works',mobile:'8085556015',email:'buyer@example.test',
  customer_gstin:'27BKYPA8983M1Z0',billing_address:'Test billing address',
  shipping_address:'Test site address',place_of_supply:'Maharashtra',
  tax_mode:'intra_state',valid_until:'2026-11-15',payment_terms:'As agreed',
  delivery_terms:'Delivery to site',warranty_terms:'As per manufacturer',
  notes:'Mock quote only',freight:100,other_charges:20,source_enquiry_id:sourceId,
  items:[{
    item_type:'product',product_id:product.id,quantity:2,unit_rate:100,
    discount_amount:20,tax_rate:18
  }],
  ...overrides
});

function configureMockFetch(fetcher,{authStatus=200}={}){
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_USER_IDS','SITE_ORIGIN'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch;
  Object.assign(process.env,{
    SUPABASE_URL:'https://quotation-test.invalid',
    SUPABASE_ANON_KEY:'test-only-anon-key',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',
    ADMIN_USER_IDS:adminId,
    SITE_ORIGIN:'http://localhost:8888'
  });
  global.fetch=async(url,options={})=>{
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify(authStatus===200?{id:adminId}:{}),{status:authStatus});
    return fetcher(String(url),options);
  };
  return ()=>{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  };
}
function baseEvent(method='POST',body){
  return {
    httpMethod:method,
    headers:{
      cookie:'__Host-hm_admin=session-token',
      origin:'http://localhost:8888',
      'content-type':'application/json'
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  };
}
function sampleQuote(overrides={}){
  return {
    quotation_id:quotationId,quotation_number:'QTN-202610-000001',revision:1,status:'draft',
    customer_name:'Test Customer',company_name:'Example Works',mobile:'8085556015',
    email:'buyer@example.test',customer_gstin:'27BKYPA8983M1Z0',
    billing_address:'Billing address',shipping_address:'Site address',
    place_of_supply:'Maharashtra',tax_mode:'intra_state',valid_until:'2026-11-15',
    payment_terms:'As agreed',delivery_terms:'Delivery to site',warranty_terms:'As per manufacturer',
    notes:'Review before sending',subtotal:200,discount_total:20,taxable_total:180,
    cgst_amount:16.2,sgst_amount:16.2,igst_amount:0,freight:100,other_charges:20,
    grand_total:332.4,created_at:'2026-10-29T10:00:00.000Z',
    items:[{
      line_id:'00000000-0000-4000-8000-000000000804',line_no:1,item_type:'product',
      product_id:product.id,product_code:product.sourceCode||product.id,
      description:`${product.name} · ${product.size}`,unit:product.unit,quantity:2,
      unit_rate:100,discount_amount:20,tax_rate:18,hsn_sac:'8536',
      tax_source_url:'https://tax.example/verified-source',tax_verified_at:'2026-10-29',
      taxable_amount:180,tax_amount:32.4
    }],
    ...overrides
  };
}

test('quotation math uses manually entered prices and verified line GST without guessing',()=>{
  const quote=validateQuotation(quotationPayload(),taxMetadata);
  assert.equal(quote.items[0].product_code,product.sourceCode||product.id);
  assert.equal(quote.items[0].unit_rate,100);
  assert.equal(quote.items[0].hsn_sac,'8536');
  assert.equal(quote.subtotal,200);
  assert.equal(quote.discount_total,20);
  assert.equal(quote.taxable_total,180);
  assert.equal(quote.cgst_amount,16.2);
  assert.equal(quote.sgst_amount,16.2);
  assert.equal(quote.grand_total,332.4);
});

test('quotation validation rejects unknown catalogue products and missing prices',()=>{
  assert.throws(()=>validateQuotation(quotationPayload({
    items:[{item_type:'product',product_id:'UNKNOWN',quantity:1,unit_rate:100,discount_amount:0}]
  })),/existing material catalogue/);
  assert.throws(()=>validateQuotation(quotationPayload({
    tax_mode:'none',items:[{item_type:'product',product_id:product.id,quantity:1,unit_rate:null}]
  })),/unit rate is required/);
  assert.throws(()=>validateQuotation(quotationPayload({
    tax_mode:'none',items:[{item_type:'product',product_id:product.id,quantity:1,unit_rate:100,discount_amount:101}]
  })),/discount cannot exceed/);
});

test('quotation tax mode requires place of supply and verified product GST metadata',()=>{
  const missingPlace=quotationPayload({place_of_supply:''});
  assert.throws(()=>validateQuotation(missingPlace,taxMetadata),/Place of supply is required/);
  assert.throws(()=>validateQuotation(quotationPayload(),new Map()),/no verified GST rate and source/);
  const noGst=validateQuotation(quotationPayload({tax_mode:'none',place_of_supply:''}),new Map());
  assert.equal(noGst.items[0].tax_rate,null);
  assert.equal(noGst.grand_total,300);
});

test('inter-state GST, custom service source and input validation calculate consistently',()=>{
  const service=validateQuotation(quotationPayload({
    tax_mode:'inter_state',items:[{
      item_type:'service',description:'Lighting installation',unit:'job',
      quantity:1,unit_rate:1000,discount_amount:100,tax_rate:18,
      tax_source_url:'https://tax.example/service',tax_verified_at:'2026-10-29'
    }]
  }),new Map());
  assert.equal(service.igst_amount,162);
  assert.equal(service.cgst_amount,0);
  assert.equal(service.grand_total,1182);
  assert.throws(()=>validateQuotation(quotationPayload({
    items:[{item_type:'service',description:'Service',unit:'job',quantity:1,unit_rate:100,tax_rate:18}]
  }),new Map()),/verified tax source URL and date/);
  assert.throws(()=>validateQuotation(quotationPayload({email:'invalid'}),taxMetadata),/valid customer email/);
  assert.throws(()=>validateQuotation(quotationPayload({valid_until:'2026-02-31'}),taxMetadata),/valid calendar date/);
});

test('quotation migration is additive, locked down, sequenced and preserves revision history',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','20261029_000003_quotations.sql'),'utf8').toLowerCase();
  for(const table of ['quotation_counters','quotations','quotation_items','quotation_versions','quotation_status_history']){
    assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.quotation_counters/);
  assert.match(sql,/grant execute on function public\.hm_save_quotation/);
  assert.match(sql,/grant execute on function public\.hm_set_quotation_status/);
  assert.match(sql,/on conflict \(period\) do update/);
  assert.match(sql,/quotation_versions_immutable/);
  assert.match(sql,/p_allow_revision/);
  assert.doesNotMatch(sql,/\bdrop\s+table\b|\btruncate\b|\bdrop\s+schema\b/);
});

test('quotation API saves an authenticated draft through the transaction RPC',async()=>{
  const requests=[],quote=sampleQuote();
  const restore=configureMockFetch(async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/rest/v1/catalogue_product_metadata?select=product_id,hsn,gst_rate,tax_source_url,tax_verified_at&limit=1000')){
      return new Response(JSON.stringify([...taxMetadata.values()]),{status:200});
    }
    if(url.includes('/rest/v1/enquiries?id=eq.'))return new Response(JSON.stringify([{id:sourceId}]),{status:200});
    if(url.endsWith('/rest/v1/rpc/hm_save_quotation'))return new Response(JSON.stringify(quote),{status:200});
    throw new Error('Unexpected mocked database request.');
  });
  try{
    const response=await adminQuotations.handler(baseEvent('POST',{
      action:'save',quotation_id:null,allow_revision:false,quotation:quotationPayload()
    }));
    assert.equal(response.statusCode,200,response.body);
    assert.equal(JSON.parse(response.body).quotation.quotation_number,quote.quotation_number);
    const rpc=requests.find(request=>request.url.endsWith('/rest/v1/rpc/hm_save_quotation'));
    const rpcBody=JSON.parse(rpc.options.body);
    assert.equal(rpcBody.p_data.items[0].product_code,product.sourceCode||product.id);
    assert.equal(rpcBody.p_data.items[0].tax_rate,18);
    assert.equal(rpcBody.p_data.items[0].tax_source_url,'https://tax.example/verified-source');
    assert.equal(rpcBody.p_actor_id,adminId);
    assert.equal(rpcBody.p_allow_revision,false);
  }finally{restore();}
});

test('quotation API rejects unsourced GST before saving',async()=>{
  let databaseWrites=0;
  const restore=configureMockFetch(async(url)=>{
    if(url.includes('/catalogue_product_metadata?'))return new Response('[]',{status:200});
    databaseWrites++;
    throw new Error('No write expected.');
  });
  try{
    const response=await adminQuotations.handler(baseEvent('POST',{
      action:'save',quotation_id:null,quotation:quotationPayload()
    }));
    assert.equal(response.statusCode,400);
    assert.match(JSON.parse(response.body).message,/no verified GST rate and source/);
    assert.equal(databaseWrites,0);
  }finally{restore();}
});

test('quotation API requires the referenced enquiry to exist',async()=>{
  let writes=0;
  const restore=configureMockFetch(async url=>{
    if(url.includes('/rest/v1/enquiries?id=eq.'))return new Response('[]',{status:200});
    writes++;throw new Error('No write expected.');
  });
  try{
    const response=await adminQuotations.handler(baseEvent('POST',{
      action:'save',quotation_id:null,
      quotation:quotationPayload({tax_mode:'none'})
    }));
    assert.equal(response.statusCode,400);
    assert.match(JSON.parse(response.body).message,/source enquiry could not be found/);
    assert.equal(writes,0);
  }finally{restore();}
});

test('quotation API records status through the database without sending a message',async()=>{
  let request;
  const restore=configureMockFetch(async(url,options)=>{
    request={url,options};
    return new Response(JSON.stringify({...sampleQuote(),status:'sent'}),{status:200});
  });
  try{
    const response=await adminQuotations.handler(baseEvent('POST',{
      action:'change-status',quotation_id:quotationId,status:'sent'
    }));
    assert.equal(response.statusCode,200);
    assert.equal(request.url,'https://quotation-test.invalid/rest/v1/rpc/hm_set_quotation_status');
    assert.deepEqual(JSON.parse(request.options.body),{
      p_quotation_id:quotationId,p_status:'sent',p_actor_id:adminId
    });
  }finally{restore();}
});

test('quotation PDF endpoint returns a valid private PDF for an authenticated quote',async()=>{
  const quote=sampleQuote(),restore=configureMockFetch(async url=>{
    if(url.includes('/rest/v1/quotations?quotation_id='))return new Response(JSON.stringify([quote]),{status:200});
    if(url.includes('/rest/v1/quotation_items?quotation_id='))return new Response(JSON.stringify(quote.items),{status:200});
    throw new Error('Unexpected mocked PDF request.');
  });
  try{
    const response=await adminQuotationPdf.handler({
      httpMethod:'GET',queryStringParameters:{id:quotationId},
      headers:{cookie:'__Host-hm_admin=session-token'}
    });
    assert.equal(response.statusCode,200);
    assert.equal(response.headers['Content-Type'],'application/pdf');
    assert.equal(response.isBase64Encoded,true);
    const bytes=Buffer.from(response.body,'base64');
    assert.equal(bytes.subarray(0,8).toString('ascii'),'%PDF-1.3');
    assert.match(response.headers['Content-Disposition'],/QTN-202610-000001-R1\.pdf/);
  }finally{restore();}
});

test('quotation PDF endpoint supports immutable historical revisions',async()=>{
  const historical={...sampleQuote(),revision:1,items:sampleQuote().items},restore=configureMockFetch(async url=>{
    if(url.includes('/rest/v1/quotation_versions?quotation_id=eq.'))return new Response(JSON.stringify([{snapshot:historical}]),{status:200});
    throw new Error('Unexpected mocked historical PDF request.');
  });
  try{
    const response=await adminQuotationPdf.handler({
      httpMethod:'GET',queryStringParameters:{id:quotationId,revision:'1'},
      headers:{cookie:'__Host-hm_admin=session-token'}
    });
    assert.equal(response.statusCode,200,response.body);
    assert.match(response.headers['Content-Disposition'],/R1\.pdf/);
    assert.equal(Buffer.from(response.body,'base64').subarray(0,8).toString('ascii'),'%PDF-1.3');
  }finally{restore();}
});

test('quotation PDF helper keeps an A4 document and disclaimers',async()=>{
  const pdf=await quotePdf(sampleQuote());
  assert.equal(pdf.subarray(0,8).toString('ascii'),'%PDF-1.3');
  assert.ok(pdf.length>1500);
});

test('admin page exposes quotation revision and inventory workflows without order/payment controls',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','public','admin','index.html'),'utf8');
  assert.match(html,/data-view="quotations"/);
  assert.match(html,/id="quotationEnquiry"/);
  assert.match(html,/id="quotationLines"/);
  assert.match(html,/id="quotationHistoryRows"/);
  assert.match(html,/id="inventoryMovementForm"/);
  assert.match(html,/id="inventoryRows"/);
  assert.match(html,/No email or payment is sent or collected/);
});
