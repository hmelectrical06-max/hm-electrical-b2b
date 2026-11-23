'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('chat language choice reaches the endpoint and Urdu uses right-to-left bubbles without submitting a lead',async()=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<main></main>',{url:'https://hmelectricalb2b.com/chat/',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({mode:'simple-enquiry-chat',language:'ur',reply:'براہ کرم سائز اور مقدار بتائیں۔'})};};
 try{
  w.eval(fs.readFileSync('public/enquiry-helper.js','utf8'));
  const select=w.document.querySelector('.hm-chat-language select');assert.equal(select.options.length,6);assert.equal(select.value,'auto');
  select.value='ur';select.dispatchEvent(new w.Event('change'));const form=w.document.querySelector('.hm-helper-panel form');assert.equal(form.querySelector('button').textContent,'پیغام بھیجیں');
  form.elements.question.value='مجھے تار چاہیے';form.elements.consent.checked=true;await form.onsubmit({preventDefault(){}});
  assert.equal(calls.length,1);assert.equal(calls[0].body.language,'ur');assert.ok(calls[0].url.endsWith('enquiry-assistant'));
  const bubbles=w.document.querySelectorAll('.hm-chat-log p');assert.equal(bubbles[0].dir,'rtl');assert.equal(bubbles[1].dir,'rtl');assert.equal(bubbles[1].lang,'ur');assert.match(bubbles[1].textContent,/سائز/);
  assert.equal(w.document.querySelector('.hm-chat-lead-form').hidden,true);
 }finally{w.close();}
});
