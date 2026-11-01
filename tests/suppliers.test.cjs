'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),crypto=require('crypto');
const s=require('../server/suppliers.cjs');
const supplier=()=>({company_name:'TEST Supplier',trade:'Electrical',email:'qa@example.invalid',phone:'9999999999',whatsapp:'',whatsapp_confirmed:false,active:true,verification_status:'Unconfirmed'});
const rfq=()=>({reference:'HM-RFQ-TEST-1',title:'Materials for quotation',items:[{id:'MAT-8000',name:'MCB SP',size:'6A',unit:'Nos',qty:2}],delivery_area:'Mumbai',required_date:null,supplier_note:''});
test('private supplier validation requires safe contacts, URLs and explicit WhatsApp confirmation',()=>{
 assert.equal(s.supplier(supplier()).email,'qa@example.invalid');assert.equal(s.supplier({...supplier(),whatsapp:'+91 99999 99999',whatsapp_confirmed:true}).whatsapp,'919999999999');
 for(const patch of [{email:'a@example.com\nBcc: x@example.com'},{email:'a@example.com,b@example.com'},{source_url:'javascript:alert(1)'},{source_url:'https://user:pass@example.com'},{whatsapp_confirmed:true},{verification_status:'Authorised dealer'},{company_name:''}])assert.throws(()=>s.supplier({...supplier(),...patch}));
});
test('supplier RFQ snapshots exclude customer identity, contact data and selling prices',()=>{
 const items=s.safeItems([{id:'MAT-8000',name:'MCB',size:'6A',unit:'Nos',qty:2,rate:500,selling_price:1000,customer_name:'PRIVATE CUSTOMER',phone:'1234567890'}]);assert.deepEqual(Object.keys(items[0]),['id','name','size','unit','qty']);
 const d=s.draft({...rfq(),items,customer_name:'PRIVATE CUSTOMER',customer_phone:'1234567890',selling_price:1000},supplier(),'email');assert.ok(d.link.startsWith('mailto:'));assert.doesNotMatch(d.message,/PRIVATE CUSTOMER|1234567890|selling_price/);assert.match(d.message,/Qty 2 Nos/);
});
test('WhatsApp drafts require a confirmed number and long RFQs preserve the complete text',()=>{
 assert.throws(()=>s.draft(rfq(),supplier(),'whatsapp'));const d=s.draft(rfq(),{...supplier(),whatsapp:'919999999999',whatsapp_confirmed:true},'whatsapp');assert.ok(d.link.startsWith('https://wa.me/919999999999?text='));
 const long=s.draft({...rfq(),supplier_note:'Long notes '.repeat(500)},supplier(),'email');assert.equal(long.link,null);assert.equal(long.longMessage,true);assert.ok(long.message.includes('Long notes '.repeat(500)));assert.ok(!s.draft(rfq(),supplier(),'other').address);
});
test('supplier totals preserve blank versus zero and validate internal status records',()=>{
 assert.equal(s.response({status:'Quoted',quoted_total:''}).quoted_total,null);assert.equal(s.response({status:'Quoted',quoted_total:0}).quoted_total,0);assert.equal(s.response({status:'Quoted',quoted_total:12.345}).quoted_total,12.35);for(const patch of [{quoted_total:-1},{quoted_total:'Infinity'},{status:'Automatically paid'},{follow_up_date:'2026-02-31'}])assert.throws(()=>s.response({status:'Quoted',...patch}));
});
test('supplier API rejects signed-out access before reading private records',async()=>{
 const handler=require('../netlify/functions/admin-suppliers.js').handler;for(const httpMethod of ['GET','POST','PATCH'])assert.equal((await handler({httpMethod,headers:{}})).statusCode,401);
});
test('supplier schema keeps private purchasing records atomic, idempotent and protected from client roles',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;');
  await db.exec(fs.readFileSync('database/setup.sql','utf8'));await db.exec(fs.readFileSync('server/service-bookings.sql','utf8'));for(const name of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await db.exec('set role service_role');const ids=[crypto.randomUUID(),crypto.randomUUID()],actor=crypto.randomUUID();
  for(const [i,id]of ids.entries())await db.query('insert into hm_suppliers(id,company_name,trade,email) values($1,$2,$3,$4)',[id,'TEST '+i,'Electrical','qa@example.invalid']);
  const enquiry=(await db.query('select * from hm_save($1::jsonb,$2)',[JSON.stringify({request_id:crypto.randomUUID(),name:'PRIVATE CUSTOMER',phone:'9999999999',email:'',location:'PRIVATE ADDRESS',type:'Material order request',details:'TEST ONLY',items:[],consent:true}),'supplier-test'])).rows[0];
  const record={id:crypto.randomUUID(),reference:'HM-RFQ-TEST',source_enquiry_id:enquiry.id,title:'TEST ONLY',delivery_area:'Mumbai',required_date:null,supplier_note:'TEST ONLY',items:[],fingerprint:'same',created_by:actor};
  const create=(r,selected=ids)=>db.query('select * from hm_create_supplier_rfq($1::jsonb,$2::uuid[])',[JSON.stringify(r),selected]);const first=await create(record);await create(record);await create({...record,fingerprint:'changed'});assert.equal(first.rows[0].id,record.id);assert.equal((await db.query('select count(*)::int as n from hm_supplier_rfqs')).rows[0].n,1);assert.equal((await db.query('select count(*)::int as n from hm_supplier_rfq_recipients')).rows[0].n,2);
  const recipient=(await db.query('select * from hm_supplier_rfq_recipients order by id limit 1')).rows[0];
  await db.query('select * from hm_supplier_recipient_action($1,$2,$3::jsonb,$4)',[recipient.id,'draft',JSON.stringify({channel:'email',message:'TEST ONLY'}),actor]);assert.equal((await db.query('select status from hm_supplier_rfq_recipients where id=$1',[recipient.id])).rows[0].status,'Draft');
  await db.query('select * from hm_supplier_recipient_action($1,$2,$3::jsonb,$4)',[recipient.id,'response',JSON.stringify(s.response({status:'Ordered',quoted_total:0,order_reference:'TEST ONLY'})),actor]);await db.query('select * from hm_supplier_recipient_action($1,$2,$3::jsonb,$4)',[recipient.id,'contact',JSON.stringify({channel:'other'}),actor]);assert.equal((await db.query('select status from hm_supplier_rfq_recipients where id=$1',[recipient.id])).rows[0].status,'Ordered');assert.equal((await db.query('select count(*)::int as n from hm_supplier_activity')).rows[0].n,3);
  await assert.rejects(db.query('update hm_supplier_rfqs set title=$1 where id=$2',['Overwrite',record.id]),/permission denied/);await assert.rejects(db.query('delete from hm_suppliers where id=$1',[ids[0]]),/permission denied/);await assert.rejects(db.query('update hm_supplier_activity set action=$1',['Response saved']),/permission denied/);
  await db.query('update hm_suppliers set active=false where id=$1',[ids[0]]);const invalidId=crypto.randomUUID();await assert.rejects(create({...record,id:invalidId,reference:'INVALID'}),/inactive/);assert.equal((await db.query('select count(*)::int as n from hm_supplier_rfqs where id=$1',[invalidId])).rows[0].n,0);
  for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);for(const table of ['hm_suppliers','hm_supplier_rfqs','hm_supplier_rfq_recipients','hm_supplier_activity'])await assert.rejects(db.query('select * from '+table),/permission denied/);await assert.rejects(create({...record,id:crypto.randomUUID(),reference:'DENIED'}),/permission denied/);}
 }finally{await db.close();}
});
