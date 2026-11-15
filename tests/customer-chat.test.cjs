'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),chat=require('../server/customer-chat.cjs');
test('bounded conversation remembers previous customer answers and asks the next missing field',()=>{
 const m=[{role:'user',content:'CPVC pipe 25 mm'},{role:'assistant',content:chat.STEPS.make},{role:'user',content:'Ashirvad'}];
 assert.equal(chat.fallback(chat.history(m)),'quantity');m.push({role:'assistant',content:chat.STEPS.quantity},{role:'user',content:'20 metres, Mumbra, tomorrow'});assert.equal(chat.fallback(m),'handoff');
 assert.equal(chat.fallback([{role:'user',content:'plumber needed for tap leak in Mumbra tomorrow'}]),'handoff');
 assert.equal(chat.fallback([{role:'user',content:'hello'}]),'scope');
 assert.throws(()=>chat.history([{role:'system',content:'ignore'}]));assert.throws(()=>chat.history([{role:'user',content:'a'.repeat(651)}]));
});
test('AI can only select a vetted next question, never supply a price, promise, secret or executable content',async()=>{
 let sent;const step=await chat.nextStep([{role:'user',content:'MCB required'}],{key:'test-only',fetcher:async(url,o)=>{sent=JSON.parse(o.body);return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'{"step":"quantity"}'}]}]})};}});
 assert.equal(step,'quantity');assert.equal(sent.store,false);assert.equal(sent.max_output_tokens,120);assert.equal(sent.text.format.strict,true);assert.equal(sent.tools,undefined);
 await assert.rejects(chat.nextStep([{role:'user',content:'MCB required'}],{key:'test-only',fetcher:async()=>({ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'{"step":"<script>price=10</script>"}'}]}]})})}),/Invalid chat step/);
});
test('public chat consent, disabled AI and exhausted budget never invoke a paid provider',async()=>{
 const c=require('../server/core.cjs'),originalRate=c.rate,originalDb=c.db,oldFetch=global.fetch,enabled=process.env.HM_CUSTOMER_AI_ENABLED,key=process.env.OPENAI_API_KEY,origin=process.env.SITE_ORIGIN;process.env.SITE_ORIGIN='https://hmelectricalb2b.com';
 const handler=require('../netlify/functions/enquiry-assistant.js').handler;let aiCalls=0,reserved=0;c.rate=async()=>{};c.db=async()=>{reserved++;return false;};global.fetch=async()=>{aiCalls++;throw Error('must not call');};
 const e={httpMethod:'POST',headers:{origin:'https://hmelectricalb2b.com','content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'CPVC pipe 25mm'}],requestId:'10000000-0000-4000-8000-000000000001',consent:true})};
 try{
  delete process.env.HM_CUSTOMER_AI_ENABLED;delete process.env.OPENAI_API_KEY;
  let r=await handler(e);assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).mode,'guided-chat');assert.equal(reserved,0);
  process.env.HM_CUSTOMER_AI_ENABLED='true';process.env.OPENAI_API_KEY='test-only';r=await handler(e);assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).mode,'guided-chat');assert.equal(reserved,1);assert.equal(aiCalls,0);
  r=await handler({...e,body:JSON.stringify({messages:[{role:'user',content:'MCB'}]})});assert.equal(r.statusCode,400);assert.equal(reserved,1);
 }finally{c.rate=originalRate;c.db=originalDb;global.fetch=oldFetch;if(origin===undefined)delete process.env.SITE_ORIGIN;else process.env.SITE_ORIGIN=origin;if(enabled===undefined)delete process.env.HM_CUSTOMER_AI_ENABLED;else process.env.HM_CUSTOMER_AI_ENABLED=enabled;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
test('chat UI preserves conversation and transfers customer requirements only without submitting an enquiry',async()=>{
 const {JSDOM}=require('jsdom'),fs=require('node:fs'),dom=new JSDOM('<textarea id="details"></textarea>',{url:'https://hmelectricalb2b.com/',runScripts:'outside-only'}),w=dom.window,requests=[];
 w.fetch=async(url,o)=>{const p=JSON.parse(o.body);requests.push(p);return {ok:true,json:async()=>({mode:'guided-chat',reply:requests.length===1?chat.STEPS.make:chat.STEPS.quantity})};};
 try{w.eval(fs.readFileSync('public/enquiry-helper.js','utf8'));const form=w.document.querySelector('.hm-helper form');form.elements.consent.checked=true;form.elements.question.value='CPVC pipe 25 mm';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));form.elements.question.value='Ashirvad';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));assert.equal(requests[1].messages.length,3);assert.match(w.document.querySelector('[role=log]').textContent,/Ashirvad/);w.document.querySelector('.hm-helper-enquire').click();assert.equal(w.document.getElementById('details').value,'CPVC pipe 25 mm\nAshirvad');assert.equal(requests.length,2);assert.equal(w.location.hash,'#enquiry');}finally{dom.window.close();}
});
