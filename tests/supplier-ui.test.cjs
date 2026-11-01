'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),crypto=require('crypto'),{JSDOM}=require('jsdom'),rules=require('../server/suppliers.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const dom=new JSDOM('<!doctype html><div id="workspace"><nav aria-label="Admin sections"><button data-view="overview">Overview</button></nav><section class="view" id="overviewView">Overview</section><section class="platform-view" hidden></section></div>',{url:'https://example.invalid/admin/',runScripts:'outside-only'}),w=dom.window;
 w.HTMLElement.prototype.scrollIntoView=function(){};w.crypto.randomUUID=()=>crypto.randomUUID();w.json=(method,p)=>({method,body:JSON.stringify(p)});
 const supplier={id:crypto.randomUUID(),company_name:'TEST Supplier',trade:'Electrical',email:'qa@example.invalid',phone:'9999999999',active:true,whatsapp:'',whatsapp_confirmed:false,verification_status:'Unconfirmed'},other={...supplier,id:crypto.randomUUID(),company_name:'TEST Plumbing',trade:'Plumbing',email:''};
 const enquiry={id:crypto.randomUUID(),name:'PRIVATE BUYER',company_name:'PRIVATE CUSTOMER COMPANY',created_at:'2026-11-02T00:00:00Z',phone:'8888888888',items:[{id:'MAT-8000',name:'MCB SP',size:'6A',unit:'Nos',qty:2,selling_price:999},{id:'MAT-8001',name:'MCB SP',size:'10A',unit:'Nos',qty:3}]};
 const store={suppliers:[supplier,other],enquiries:[enquiry],rfqs:[],recipients:[],activity:[]},calls=[];let rejectSave=false;
 w.api=async(name,options={})=>{calls.push({name,options});const body=options.body?JSON.parse(options.body):null;let result;
  if(!body){const params=new URLSearchParams(name.split('?')[1]||'');if(params.has('id')){const id=params.get('id');result={ok:true,rfq:store.rfqs.find(r=>r.id===id),recipients:store.recipients.filter(r=>r.rfq_id===id).map(r=>({...r,supplier:store.suppliers.find(s=>s.id===r.supplier_id)}))};}
   else if(params.has('history'))result={ok:true,rows:store.activity.filter(r=>r.recipient_id===params.get('history'))};
   else if(params.has('supplierId'))result={ok:true,rows:store.recipients.filter(r=>r.supplier_id===params.get('supplierId')).map(r=>({...r,rfq:store.rfqs.find(q=>q.id===r.rfq_id)}))};
   else result={ok:true,suppliers:store.suppliers,enquiries:store.enquiries,rfqs:store.rfqs};
  }else if(body.action==='supplier'){if(rejectSave)throw Error('TEST save rejected');Object.assign(store.suppliers.find(s=>s.id===body.id)||{},body);result={ok:true,message:'Saved'};}
  else if(body.action==='create-rfq'){const q={id:body.id,reference:'HM-RFQ-TEST',title:body.title,items:rules.chooseItems(enquiry.items,body.itemIds),delivery_area:body.deliveryArea,supplier_note:body.note,required_date:body.requiredDate||null,created_at:'2026-11-02T00:00:00Z'};store.rfqs.push(q);for(const id of body.supplierIds)store.recipients.push({id:crypto.randomUUID(),rfq_id:q.id,supplier_id:id,status:'Draft',quoted_total:null});result={ok:true,id:q.id,reference:q.reference,message:'RFQ saved'};}
  else{const recipient=store.recipients.find(r=>r.id===body.recipientId);if(body.action==='draft'){const draft=rules.draft(store.rfqs.find(r=>r.id===recipient.rfq_id),store.suppliers.find(s=>s.id===recipient.supplier_id),body.channel);store.activity.push({recipient_id:recipient.id,action:'Draft prepared',created_at:'2026-11-02',details:draft});result={ok:true,draft,recipient,message:'Draft ready'};}
   else if(body.action==='response'){Object.assign(recipient,rules.response(body));result={ok:true,recipient,message:'Response saved'};}
   else if(body.action==='contact'){if(!body.confirmedSent)throw Error('Confirm contact first');if(recipient.status==='Draft')recipient.status='Contacted';recipient.contacted_at='2026-11-02T00:00:00Z';result={ok:true,recipient,message:'Contact recorded'};}}
  return{json:async()=>structuredClone(result)};
 };
 w.document.querySelector('[data-view="overview"]').onclick=()=>w.document.getElementById('overviewView').hidden=false;
 w.eval(fs.readFileSync('public/admin/admin-suppliers.js','utf8'));
 const click=label=>{const b=[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);assert.ok(b,'Button '+label);b.click();};
 return{dom,w,store,calls,supplier,other,enquiry,click,failSave:()=>rejectSave=true};
}
test('private supplier UI completes an enquiry-to-RFQ draft and response workflow without sending or marking drafts sent',async()=>{
 const f=setup(),{w,store,click,enquiry,supplier,calls}=f,d=w.document;
 try{
  click('Suppliers');await settle();assert.equal(d.querySelectorAll('.supplier-card').length,2);
  click('Supplier RFQs');await settle();click('New supplier RFQ');let form=d.getElementById('supplierCreateRfq');form.elements.enquiryId.value=enquiry.id;form.elements.enquiryId.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(d.querySelectorAll('[data-rfq-item]').length,2);
  const second=d.querySelector('[data-rfq-item="MAT-8001"]');second.checked=false;second.dispatchEvent(new w.Event('change',{bubbles:true}));const chosen=d.querySelector('[data-rfq-supplier="'+supplier.id+'"]');chosen.checked=true;chosen.dispatchEvent(new w.Event('change',{bubbles:true}));form.elements.title.value='TEST RFQ';form.elements.deliveryArea.value='Mumbai';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
  assert.equal(store.rfqs.length,1);assert.deepEqual(store.rfqs[0].items.map(p=>p.id),['MAT-8000']);assert.equal(d.querySelectorAll('.supplier-rfq-card').length,1);
  click('Prepare email draft');await settle();assert.equal(d.querySelector('[data-status]').textContent,'Draft');assert.equal(store.recipients[0].status,'Draft');assert.equal(calls.filter(c=>c.options.body&&JSON.parse(c.options.body).action==='contact').length,0);assert.ok(d.getElementById('supplierOpenDraft').href.startsWith('mailto:'));assert.ok(!d.getElementById('supplierDraftText').value.includes('PRIVATE BUYER'));assert.ok(!d.getElementById('supplierDraftText').value.includes('selling_price'));
  const response=d.querySelector('[data-response]');response.elements.status.value='Quoted';response.elements.quoted_total.value='1250.50';response.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(d.querySelector('[data-status]').textContent,'Quoted');assert.equal(store.recipients[0].quoted_total,1250.5);
  const contact=d.querySelector('[data-contact]');contact.elements.confirmedSent.checked=true;contact.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(store.recipients[0].status,'Quoted');assert.ok(d.querySelector('[data-contact] p').textContent.includes('2026-11-02'));assert.equal(w.localStorage.length,0);
 }finally{w.close();}
});
test('private supplier UI escapes source text, preserves failed edits and hides itself when another admin section is selected',async()=>{
 const f=setup(),{w,store,click}=f,d=w.document;store.suppliers[0].company_name='<img src=x onerror=alert(1)> TEST';
 try{click('Suppliers');await settle();assert.equal(d.querySelectorAll('.supplier-card img').length,0);d.querySelector('[data-supplier-edit]').click();const form=d.getElementById('supplierEditForm');assert.ok(form);form.elements.company_name.value='Unsaved edit';f.failSave();form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(d.getElementById('supplierMessage').textContent,'TEST save rejected');assert.equal(store.suppliers[0].company_name,'<img src=x onerror=alert(1)> TEST');assert.equal(form.querySelector('button[type="submit"]').disabled,false);click('Overview');assert.equal(d.querySelector('.procurement-view').hidden,true);}finally{w.close();}
});
