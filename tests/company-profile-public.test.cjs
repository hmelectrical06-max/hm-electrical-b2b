'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const approved=require('../docs/company-profile-public.json');
test('website ships the exact approved public profile and no other PDF',()=>{
 const pdfs=[];
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.pdf$/i.test(e.name))pdfs.push(path.relative('public',f).replaceAll('\\','/'));}};
 walk('public');assert.deepEqual(pdfs,[approved.file]);
 const bytes=fs.readFileSync(path.join('public',approved.file));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),approved.sha256,'A replacement PDF must receive a fresh privacy review and approval.');
 assert.equal((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,approved.publicPageCount);
});
test('About Us and company profile expose separate View and Download actions',()=>{
 const home=fs.readFileSync('public/index.html','utf8'),profile=fs.readFileSync('public/company-profile.html','utf8');
 assert.match(home,/<a href="#company">About Us<\/a>/);
 assert.match(home,/id="company-profile"/);
 for(const html of [home,profile]){
  const links=[...html.matchAll(/<a\b[^>]*href="([^"]+\.pdf)"[^>]*>/g)].map(m=>m[0]);
  assert.ok(links.some(a=>a.includes('/'+approved.file)&&a.includes('target="_blank"')));
  assert.ok(links.some(a=>a.includes('/'+approved.file)&&a.includes(' download=')));
 }
 assert.ok(!profile.includes('onclick='));
});
