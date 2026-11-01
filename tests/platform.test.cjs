'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const c=require('../server/core.cjs'),m=require('../server/manpower.cjs');
const payload=()=>({requestId:require('crypto').randomUUID(),trade:'Electrician',quantity:3,siteLocation:'Mumbai TEST ONLY',duration:'2 days',contactName:'TEST ONLY',phone:'9999999999',email:'',requiredDate:new Date(Date.now()+86400000*7).toISOString().slice(0,10),details:'TEST ONLY',consent:true});

test('material navigation and quick categories have their preserved section target',()=>{const html=fs.readFileSync('public/index.html','utf8');assert.equal((html.match(/<section id="store">/g)||[]).length,1);assert.ok(html.indexOf('<section id="store">')<html.indexOf('id="results"'));});
test('manpower request validation rejects unsafe quantities, fields, dates and contacts',()=>{
 assert.equal(m.validate(payload()).quantity,3);for(const patch of [{quantity:0},{quantity:501},{quantity:1.5},{trade:'Admin'},{requiredDate:'2026-02-31'},{requiredDate:'2020-01-01'},{consent:false},{website:'spam'},{phone:'hello'},{siteLocation:'x\nInjected'}])assert.throws(()=>m.validate({...payload(),...patch}));
});
test('seven public trade categories contain no employee identities',()=>{assert.deepEqual(m.trades,['Electrician','Plumber','Fire Fitter','Welder','Helper','Civil Labour','Supervisor']);});
test('all 984 materials have named representative artwork and correct common product families',()=>{
 const art=require('../scripts/product-illustrations.cjs'),s={window:{}};vm.runInNewContext(fs.readFileSync('public/data.js','utf8'),s);
 assert.equal(s.window.HM_DATA.materials.length,984);for(const p of s.window.HM_DATA.materials){assert.notEqual(art.family(p),'specification',p.name);assert.match(art.svg(p),/REPRESENTATIVE ILLUSTRATION/);assert.ok(art.svg(p).includes(p.id));}
 for(const [name,family]of [['Clamp Meter','meter'],['Socket Wrench Set','wrench'],['Cable Cutter','pliers'],['Fire Extinguisher','extinguisher'],['MCB SP','breaker'],['PVC Conduit Pipe Heavy','pipe']])assert.equal(art.family({name}),family);
});
test('live changes keep original product SEO addresses stable',()=>{const {productPath}=require('../public/catalogue-search.js');const original={id:'MAT-8000',name:'MCB SP',size:'6A'};assert.equal(productPath({...original,name:'Updated title',_seoPath:productPath(original)}),productPath(original));});
test('MFA is enforced server-side after real user verification and ignores user metadata roles',async()=>{
 const originalFetch=global.fetch,previous={...process.env};const id='00000000-0000-4000-8000-000000000099';
 Object.assign(process.env,{SUPABASE_URL:'https://auth.example',SUPABASE_ANON_KEY:'public-key',ADMIN_USER_IDS:id,HM_ADMIN_MFA_REQUIRED:'true'});
 const make=aal=>({httpMethod:'GET',headers:{cookie:'__Host-hm_admin=x.'+Buffer.from(JSON.stringify({aal,sub:id})).toString('base64url')+'.x'}});
 let allowed=true;global.fetch=async()=>new Response(JSON.stringify({id:allowed?id:'00000000-0000-4000-8000-000000000098',user_metadata:{role:'admin'}}),{status:200});
 const handler=c.safe(async e=>{await c.admin(e);return c.reply(200,{ok:true});});
 try{assert.equal((await handler(make('aal1'))).statusCode,403);assert.equal((await handler(make('aal2'))).statusCode,200);allowed=false;assert.equal((await handler(make('aal2'))).statusCode,403);global.fetch=async()=>new Response('{}',{status:401});assert.equal((await handler(make('aal2'))).statusCode,401);}finally{global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
});
test('platform endpoints reject signed-out users before any private query',async()=>{
 for(const name of ['admin-platform','admin-product-photo','admin-mfa']){const r=await require('../netlify/functions/'+name+'.js').handler({httpMethod:'GET',headers:{}});assert.equal(r.statusCode,401,name);}
});
test('public runtime selects no employee, request, cost or audit tables',()=>{const source=fs.readFileSync('netlify/functions/public-content.js','utf8');for(const name of ['service_technicians','hm_manpower_requests','hm_audit_log','purchase_price','phone','contact_name'])assert.ok(!source.includes(name),name);});
test('new private tables use RLS, idempotent manpower writes and append-only audit privileges',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;");
 await db.exec(fs.readFileSync('database/setup.sql','utf8'));await db.exec(fs.readFileSync('server/service-bookings.sql','utf8'));for(const name of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
 await db.exec('set role service_role');const p=m.validate(payload());const first=await db.query('select * from hm_save_manpower($1,$2)',[p,'same']);const retry=await db.query('select * from hm_save_manpower($1,$2)',[p,'same']);assert.equal(first.rows[0].id,retry.rows[0].id);assert.equal((await db.query('select count(*)::int as count from hm_audit_log')).rows[0].count,1);
 await assert.rejects(db.query('update hm_audit_log set action=\'Changed\''),/permission denied/);await assert.rejects(db.query('delete from hm_manpower_requests'),/permission denied/);
 await db.exec('reset role;set role anon');for(const table of ['hm_manpower_requests','hm_audit_log','hm_catalogue_products','hm_manpower_categories'])await assert.rejects(db.query('select * from '+table),/permission denied/);
 }finally{await db.close();}
});
