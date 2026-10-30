'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('isolated PostgreSQL validates setup, idempotent enquiries, rate limits, and private roles',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;`);
  await db.exec(fs.readFileSync('database/setup.sql','utf8'));
  await db.exec(fs.readFileSync('server/service-bookings.sql','utf8'));
  for(const name of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await db.exec('set role service_role');
  const p={request_id:'00000000-0000-4000-8000-000000000111',name:'TEST ONLY',company_name:'Test Company',phone:'9999999999',email:'',location:'Test',required_date:'2026-11-15',type:'Material order request',details:'Test only',items:[],consent:true};
  const first=await db.query('select * from hm_save($1::jsonb,$2::text)',[JSON.stringify(p),'fingerprint-a']);
  const again=await db.query('select * from hm_save($1::jsonb,$2::text)',[JSON.stringify(p),'fingerprint-a']);
  assert.equal(first.rows.length,1);assert.equal(again.rows[0].id,first.rows[0].id);
  assert.equal(first.rows[0].company_name,'Test Company');assert.equal(first.rows[0].required_date.toISOString().slice(0,10),'2026-11-15');
  const conflict=await db.query('select * from hm_save($1::jsonb,$2::text)',[JSON.stringify({...p,name:'Changed'}),'fingerprint-b']);assert.equal(conflict.rows[0].fingerprint,'fingerprint-a');
  assert.equal((await db.query("select hm_rate('test-key',2) as ok")).rows[0].ok,true);
  assert.equal((await db.query("select hm_rate('test-key',2) as ok")).rows[0].ok,true);
  assert.equal((await db.query("select hm_rate('test-key',2) as ok")).rows[0].ok,false);
  assert.equal((await db.query('select * from hm_claim_notifications()')).rows.length,1);
  assert.equal((await db.query('select * from hm_claim_notifications()')).rows.length,0);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from enquiries'),/permission denied/);
  await assert.rejects(db.query('select * from hm_claim_notifications()'),/permission denied/);
  await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from enquiries'),/permission denied/);
 }finally{await db.close();}
});
