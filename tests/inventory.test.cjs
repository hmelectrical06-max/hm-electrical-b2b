'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {catalogue,movementTypes,validateMovement}=require('../server/inventory.cjs');
const adminInventory=require('../netlify/functions/admin-inventory.js');

const product=catalogue[0];
const adminId='00000000-0000-4000-8000-000000000701';
const movementPayload=overrides=>({
  product_id:product.id,movement_type:'goods_receipt',quantity:2,
  reference_type:'purchase',reference_id:'PO-LOCAL-1',
  idempotency_key:'00000000-0000-4000-8000-000000000702',note:'',
  ...overrides
});

function configureMockFetch(fetcher,{authStatus=200}={}){
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_USER_IDS','SITE_ORIGIN'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch;
  Object.assign(process.env,{
    SUPABASE_URL:'https://inventory-test.invalid',
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

test('inventory movement validation accepts exact catalogue products and supported quantities',()=>{
  assert.equal(catalogue.length,984);
  assert.equal(movementTypes.length,8);
  const validated=validateMovement(movementPayload({quantity:-1,movement_type:'adjustment'}));
  assert.equal(validated.product.id,product.id);
  assert.equal(validated.movement.p_quantity,-1);
  assert.equal(validated.movement.p_reference_id,'PO-LOCAL-1');
});

test('inventory movement validation rejects unknown products and unsafe values',()=>{
  assert.throws(()=>validateMovement(movementPayload({product_id:'UNKNOWN'})),/existing material catalogue/);
  assert.throws(()=>validateMovement(movementPayload({quantity:-1})),/must be positive/);
  assert.throws(()=>validateMovement(movementPayload({quantity:0.0001})),/three decimal places/);
  assert.throws(()=>validateMovement(movementPayload({movement_type:'reservation'})),/supported stock movement/);
  assert.throws(()=>validateMovement(movementPayload({reference_id:'bad\u0000ref'})),/valid reference/);
  assert.throws(()=>validateMovement(movementPayload({idempotency_key:'bad key'})),/request ID/);
});

test('inventory migration creates a private append-only ledger and atomic balance RPC',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','20261029_000002_inventory_ledger.sql'),'utf8').toLowerCase();
  assert.match(sql,/create table if not exists public\.inventory_balances/);
  assert.match(sql,/create table if not exists public\.inventory_movements/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.inventory_balances, public\.inventory_movements from public, anon, authenticated/);
  assert.match(sql,/before update or delete on public\.inventory_movements/);
  assert.match(sql,/for update/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/grant execute on function public\.hm_inventory_movement/);
  assert.match(sql,/v_balance\.on_hand - v_balance\.reserved/);
  assert.doesNotMatch(sql,/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\bdrop\s+schema\b/);
});

test('inventory API exposes only catalogue balances to an authenticated admin',async()=>{
  let restored=false;
  const restore=configureMockFetch(async url=>{
    if(url.includes('/rest/v1/inventory_balances?select=')){
      return new Response(JSON.stringify([{
        product_id:product.id,on_hand:6,reserved:2,updated_at:'2026-10-29T08:00:00.000Z'
      }]),{status:200});
    }
    throw new Error('Unexpected mocked database request.');
  });
  try{
    const response=await adminInventory.handler({
      httpMethod:'GET',headers:{cookie:'__Host-hm_admin=session-token'}
    });
    const body=JSON.parse(response.body);
    assert.equal(response.statusCode,200);
    assert.equal(body.total,984);
    assert.equal(body.rows.find(row=>row.id===product.id).on_hand,6);
    assert.equal(body.rows.find(row=>row.id===product.id).reserved,2);
    assert.equal(body.rows.find(row=>row.id===product.id).purchase_price,undefined);
    assert.equal(body.rows.find(row=>row.id===catalogue[1].id).on_hand,null);
  }finally{restore();restored=true;}
  assert.equal(restored,true);
});

test('inventory API records a movement through the atomic RPC with the authenticated actor',async()=>{
  const requests=[];
  const restore=configureMockFetch(async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/rest/v1/rpc/hm_inventory_movement')){
      return new Response(JSON.stringify({movement_id:'00000000-0000-4000-8000-000000000703'}),{status:200});
    }
    throw new Error('Unexpected mocked database request.');
  });
  try{
    const response=await adminInventory.handler({
      httpMethod:'POST',
      headers:{cookie:'__Host-hm_admin=session-token',origin:'http://localhost:8888','content-type':'application/json'},
      body:JSON.stringify(movementPayload())
    });
    assert.equal(response.statusCode,200,response.body);
    assert.equal(JSON.parse(response.body).movement_id,'00000000-0000-4000-8000-000000000703');
    assert.equal(requests.length,1);
    const body=JSON.parse(requests[0].options.body);
    assert.equal(body.p_product_id,product.id);
    assert.equal(body.p_quantity,2);
    assert.equal(body.p_actor_id,adminId);
  }finally{restore();}
});

test('inventory API rejects invalid movements before calling the database RPC',async()=>{
  const requests=[];
  const restore=configureMockFetch(async(url,options)=>{
    requests.push({url,options});
    throw new Error('No database request expected.');
  });
  try{
    const response=await adminInventory.handler({
      httpMethod:'POST',
      headers:{cookie:'__Host-hm_admin=session-token',origin:'http://localhost:8888','content-type':'application/json'},
      body:JSON.stringify(movementPayload({product_id:'NOT-A-CATALOGUE-ITEM'}))
    });
    assert.equal(response.statusCode,400);
    assert.match(JSON.parse(response.body).message,/existing material catalogue/);
    assert.equal(requests.length,0);
  }finally{restore();}
});

test('inventory API rejects unauthenticated access without querying stock',async()=>{
  const requests=[];
  const restore=configureMockFetch(async(url,options)=>{
    requests.push({url,options});
    throw new Error('No database request expected.');
  },{authStatus:401});
  try{
    const response=await adminInventory.handler({httpMethod:'GET',headers:{}});
    assert.equal(response.statusCode,401);
    assert.equal(requests.length,0);
  }finally{restore();}
});

test('inventory API identifies the additive migration when its database table is missing',async()=>{
  const restore=configureMockFetch(async url=>{
    if(url.includes('/rest/v1/inventory_balances?select='))return new Response('{}',{status:404});
    throw new Error('Unexpected mocked database request.');
  });
  try{
    const response=await adminInventory.handler({
      httpMethod:'GET',headers:{cookie:'__Host-hm_admin=session-token'}
    });
    assert.equal(response.statusCode,503);
    assert.match(JSON.parse(response.body).message,/20261029_000002_inventory_ledger\.sql/);
  }finally{restore();}
});

test('inventory API reports safe stock conflicts without exposing database errors',async()=>{
  const restore=configureMockFetch(async()=>{
    return new Response(JSON.stringify({message:'The quantity exceeds available stock.'}),{status:400});
  });
  try{
    const response=await adminInventory.handler({
      httpMethod:'POST',
      headers:{cookie:'__Host-hm_admin=session-token',origin:'http://localhost:8888','content-type':'application/json'},
      body:JSON.stringify(movementPayload({movement_type:'customer_dispatch'}))
    });
    assert.equal(response.statusCode,400);
    assert.match(JSON.parse(response.body).message,/exceeds available stock/);
  }finally{restore();}
});

test('inventory API does not expose unrecognized database error text',async()=>{
  const restore=configureMockFetch(async()=>{
    return new Response(JSON.stringify({message:'internal relation secret_table does not exist'}),{status:400});
  });
  try{
    const response=await adminInventory.handler({
      httpMethod:'POST',
      headers:{cookie:'__Host-hm_admin=session-token',origin:'http://localhost:8888','content-type':'application/json'},
      body:JSON.stringify(movementPayload({movement_type:'customer_dispatch'}))
    });
    assert.equal(response.statusCode,503);
    assert.doesNotMatch(response.body,/secret_table/);
  }finally{restore();}
});
