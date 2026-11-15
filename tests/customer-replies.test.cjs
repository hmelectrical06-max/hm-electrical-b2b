'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),r=require('../server/customer-replies.cjs'),c=require('../server/core.cjs');
const lead={id:'10000000-0000-4000-8000-000000000001',contact_name:'Nazif',trade:'Plumber',quantity:4,site_location:'Kausa Mumbra',required_date:'2026-11-16',duration:'1 day',details:'',consent:true,email:'customer@example.com',status:'New',created_at:'2026-11-15T09:31:43Z'};
test('customer confirmation keeps the supplied location and team size, asks actual work and leaves every commitment to the office',()=>{
 const p=r.compose('manpower',lead);assert.match(p.text,/^Hi Nazif,/);assert.match(p.text,/4 Plumber/);assert.match(p.text,/Kausa Mumbra/);assert.match(p.text,/exactly what work/);assert.match(p.text,/does not confirm a booking/);assert.doesNotMatch(p.text,/this is Asif|bank|payment link|discount.*\d|Rs \d/i);
 for(const change of [{email:''},{consent:false},{status:'Closed'},{trade:'Fire Fitter'},{email:'a@example.com\r\nBcc: victim@example.com'}])assert.equal(r.compose('manpower',{...lead,...change}),null);
});
test('existing customer emails are not bulk queued, repeat submissions cannot replace a stored acknowledgement',async()=>{
 const db=c.db,old={enabled:process.env.HM_CUSTOMER_EMAIL_ENABLED,start:process.env.HM_CUSTOMER_EMAIL_START_AT};let calls=0;
 process.env.HM_CUSTOMER_EMAIL_ENABLED='true';process.env.HM_CUSTOMER_EMAIL_START_AT='2026-11-15T10:00:00Z';c.db=async(path,method,body,headers)=>{calls++;assert.match(path,/on_conflict=lead_key/);assert.equal(body.lead_key,'manpower:'+lead.id);assert.equal(headers.Prefer,'resolution=ignore-duplicates,return=representation');return calls===1?[body]:[];};
 try{assert.equal((await r.queue('manpower',lead)).queued,false);assert.equal(calls,0);assert.equal((await r.queue('manpower',lead,{catchup:true})).queued,true);assert.equal((await r.queue('manpower',lead,{catchup:true})).queued,false);}finally{c.db=db;for(const [key,v] of [['HM_CUSTOMER_EMAIL_ENABLED',old.enabled],['HM_CUSTOMER_EMAIL_START_AT',old.start]])if(v===undefined)delete process.env[key];else process.env[key]=v;}
});
test('customer emails use the business reply address and stable provider idempotency key',async()=>{
 const old=global.fetch,env={EMAIL_FROM:process.env.EMAIL_FROM,HM_EMAIL_PROVIDER_TOKEN:process.env.HM_EMAIL_PROVIDER_TOKEN};Object.assign(process.env,{EMAIL_FROM:'HM ELECTRICAL <noreply@example.com>',HM_EMAIL_PROVIDER_TOKEN:'test-only'});let sent;
 global.fetch=async(url,o)=>{sent={body:JSON.parse(o.body),headers:o.headers};return Response.json({id:'provider-test'});};
 try{await require('../server/email-notifications.cjs').sendCustomerEmail({to:lead.email,idempotencyKey:'hm-customer-id',...r.compose('manpower',lead)});assert.deepEqual(sent.body.to,[lead.email]);assert.equal(sent.body.reply_to,'hmelectrical06@gmail.com');assert.equal(sent.headers['Idempotency-Key'],'hm-customer-id');assert.equal(sent.body.cc,undefined);await assert.rejects(require('../server/email-notifications.cjs').sendCustomerEmail({to:'a@b.com, victim@example.com'}),/INVALID/);}finally{global.fetch=old;for(const [k,v]of Object.entries(env))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('private SQL queue leases once, caps recipient sends and stops ambiguous retries before provider idempotency expires',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role; create table service_bookings(id uuid,customer_name text,category text,description text,area text,preferred_at timestamptz,status text,created_at timestamptz); create table enquiries(id uuid,name text,details text,location text,items jsonb,status text,created_at timestamptz); create table hm_manpower_requests(id uuid,contact_name text,trade text,quantity integer,details text,required_date date,duration text,site_location text,status text,created_at timestamptz);create table hm_ai_external_leads(id uuid,name text,details text,location text,status text,created_at timestamptz);create table hm_ai_drafts(lead_key text);grant select on enquiries,service_bookings,hm_manpower_requests,hm_ai_external_leads,hm_ai_drafts to service_role;");
  // Embedded Postgres has no cross-process advisory locking; production uses it to serialize claims.
  await db.exec("create or replace function pg_advisory_xact_lock(bigint) returns void language sql as 'select';");
  await db.exec(fs.readFileSync('database/customer-replies.sql','utf8'));
  for(let i=0;i<4;i++)await db.query("insert into hm_customer_replies(lead_key,recipient,payload)values($1,'one@example.com','{}')",['manpower:'+i]);
  await db.exec('set role service_role');const first=(await db.query('select * from hm_claim_customer_replies()')).rows;assert.equal(first.length,3);assert.equal((await db.query('select * from hm_claim_customer_replies()')).rows.length,0);
  await db.exec("update hm_customer_replies set status='pending',attempts=1,created_at=now()-interval '23 hours',expires_at=now()-interval '1 hour',lease_until=null;");assert.equal((await db.query('select * from hm_claim_customer_replies()')).rows.length,0);assert.equal((await db.query("select count(*)::int n from hm_customer_replies where status='review'")).rows[0].n,4);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from hm_customer_replies'),/permission denied/);await assert.rejects(db.query('select * from hm_claim_customer_replies()'),/permission denied/);
 }finally{await db.close();}
});
