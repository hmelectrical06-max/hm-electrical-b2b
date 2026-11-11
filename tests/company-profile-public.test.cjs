'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const approved=require('../docs/company-profile-public.json');
const overview=require('../docs/company-overview-public.json');
test('current public overview is reviewed and historical profile bytes remain preserved',()=>{
 const pdfs=[];
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.pdf$/i.test(e.name))pdfs.push(path.relative('public',f).replaceAll('\\','/'));}};
 walk('public');assert.deepEqual(pdfs.sort(),[approved.file,overview.file].sort());
 const simple=fs.readFileSync(path.join('public',overview.file));assert.equal(createHash('sha256').update(simple).digest('hex'),overview.sha256);assert.equal((simple.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,2);
 const bytes=fs.readFileSync(path.join('public',approved.file));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),approved.sha256,'A replacement PDF must receive a fresh privacy review and approval.');
 assert.equal((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,approved.publicPageCount);
});
test('About Us and company profile expose separate View and Download actions',()=>{
 const home=fs.readFileSync('public/index.html','utf8'),profile=fs.readFileSync('public/company-profile.html','utf8');
 assert.match(home,/<a href="\/company-profile.html">About Us<\/a>/);
 assert.match(home,/id="company-profile"/);
 for(const html of [home,profile]){
  const links=[...html.matchAll(/<a\b[^>]*href="([^"]+\.pdf)"[^>]*>/g)].map(m=>m[0]);
  assert.ok(links.some(a=>a.includes('/'+overview.file)&&a.includes('target="_blank"')));
  assert.ok(links.some(a=>a.includes('/'+overview.file)&&a.includes(' download=')));
 }
 assert.ok(!profile.includes('onclick='));
 assert.doesNotMatch(profile,/civil work|civil labour/i);
 assert.match(fs.readFileSync('netlify.toml','utf8'),/from = "\/downloads\/HM-ELECTRICAL-Company-Profile-2026-Public.pdf"\s+to = "\/downloads\/HM-ELECTRICAL-Company-Overview-2026.pdf"\s+status = 301\s+force = true/);
});
