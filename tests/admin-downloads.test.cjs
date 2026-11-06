'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('private downloads retain a manual save link, preserve bytes and clear links on sign-out',async()=>{
 const dom=new JSDOM('<main id="workspace"></main>',{url:'https://example.test/admin/',runScripts:'outside-only'}),w=dom.window,urls=[],revoked=[],clicks=[];
 w.URL.createObjectURL=b=>{urls.push(b);return 'blob:https://example.test/'+urls.length;};w.URL.revokeObjectURL=u=>revoked.push(u);w.HTMLAnchorElement.prototype.click=function(){clicks.push(this.download);};
 w.eval(fs.readFileSync('public/admin/admin-downloads.js','utf8'));
 const bytes=new w.Blob(['%PDF-private-test'],{type:'application/pdf'});
 const link=await w.HM_DOWNLOADS.response({headers:{get:()=> 'attachment; filename="HM-quotation.pdf"'},blob:async()=>bytes},'fallback.pdf');
 assert.equal(link.download,'HM-quotation.pdf');assert.equal(urls[0],bytes);assert.ok(link.isConnected);assert.equal(revoked.length,0);assert.equal(clicks[0],'HM-quotation.pdf');
 for(let i=0;i<5;i++)w.HM_DOWNLOADS.save(bytes,'file-'+i+'.pdf');assert.equal(w.document.querySelectorAll('#adminReadyDownloads a').length,5);assert.equal(revoked.length,1);
 w.HM_DOWNLOADS.clear();assert.equal(revoked.length,6);assert.equal(w.document.getElementById('adminReadyDownloads'),null);assert.throws(()=>w.HM_DOWNLOADS.save(new w.Blob([]),'empty.pdf'),/empty/);dom.window.close();
});
