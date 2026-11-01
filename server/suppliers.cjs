'use strict';
const c=require('./core.cjs'),{text}=require('./manpower.cjs');
const statuses=['Draft','Contacted','Quoted','Selected','Ordered','Received','Closed'];
const supplierFields=['company_name','trade','product_range','contact_person','phone','alternate_phone','email','whatsapp','address','source_url','trade_notes','call_status','rate_notes','payment_terms','delivery_terms','notes'];
const supplierSelect='id,source_id,company_name,trade,product_range,contact_person,phone,alternate_phone,email,whatsapp,whatsapp_confirmed,address,source_url,source_checked_at,verification_status,trade_notes,call_status,rate_notes,payment_terms,delivery_terms,notes,active,updated_at';
function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))c.fail(400,'Invalid record reference.');return value;}
function date(value){if(value===null||value===undefined||value==='')return null;value=text(value,10,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)c.fail(400,'Enter a valid date.');return value;}
function supplier(p){const out={};for(const key of supplierFields){const max=['product_range','trade_notes','rate_notes','notes'].includes(key)?2000:['address','payment_terms','delivery_terms'].includes(key)?800:key==='source_url'?1500:key==='email'?254:200;out[key]=text(p[key]||'',max,['company_name','trade'].includes(key),['product_range','address','trade_notes','rate_notes','payment_terms','delivery_terms','notes'].includes(key));}
 if(out.trade.length>100)c.fail(400,'Trade must be at most 100 characters.');
 if(out.email&&!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(out.email))c.fail(400,'Enter one valid supplier email address.');
 out.whatsapp=out.whatsapp.replace(/[+ ().-]/g,'');if(out.whatsapp&&!/^[1-9][0-9]{9,14}$/.test(out.whatsapp))c.fail(400,'Enter the WhatsApp number with its country code.');
 if(typeof p.active!=='boolean'||typeof p.whatsapp_confirmed!=='boolean')c.fail(400,'Confirm supplier status and WhatsApp details.');out.active=p.active;out.whatsapp_confirmed=p.whatsapp_confirmed;if(out.whatsapp_confirmed&&!out.whatsapp)c.fail(400,'Add the confirmed WhatsApp number first.');
 if(!['Unconfirmed','Contacted','Contact confirmed'].includes(p.verification_status))c.fail(400,'Choose the contact verification status.');out.verification_status=p.verification_status;
 if(out.source_url){let u;try{u=new URL(out.source_url);}catch{c.fail(400,'Enter a valid source website URL.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)c.fail(400,'Use a normal HTTP or HTTPS source website URL.');}
 return out;
}
function safeItems(items){if(!Array.isArray(items)||items.length>1000)c.fail(400,'The source enquiry items could not be read.');return items.map(p=>{if(!Number.isFinite(Number(p.qty))||Number(p.qty)<=0)c.fail(400,'A source enquiry quantity is invalid.');return {id:text(String(p.id||''),100,true),name:text(String(p.name||''),300,true),size:text(String(p.size||''),300),unit:text(String(p.unit||''),80),qty:Number(p.qty)};});}
function response(p){if(!statuses.includes(p.status))c.fail(400,'Choose a valid supplier response status.');let amount=null;if(p.quoted_total!==null&&p.quoted_total!==''&&p.quoted_total!==undefined){amount=Number(p.quoted_total);if(!Number.isFinite(amount)||amount<0||amount>1e12)c.fail(400,'Enter a valid supplier quotation total.');amount=Math.round(amount*100)/100;}
 const out={status:p.status,quoted_total:amount,follow_up_date:date(p.follow_up_date)};for(const key of ['quote_reference','response_notes','payment_terms','delivery_terms','order_reference'])out[key]=text(p[key]||'',key==='response_notes'?3000:800,false,true);return out;
}
function draft(rfq,supplier,channel){if(!['email','whatsapp','other'].includes(channel))c.fail(400,'Choose email, WhatsApp or copy text.');if(channel==='email'&&!supplier.email)c.fail(400,'Add a valid email for this supplier first.');if(channel==='whatsapp'&&(!supplier.whatsapp||!supplier.whatsapp_confirmed))c.fail(400,'Add and confirm this supplier’s WhatsApp number first.');
 const subject='HM ELECTRICAL purchase enquiry '+rfq.reference;
 const lines=['Hello '+supplier.company_name+',','',subject,rfq.title,'',...rfq.items.map((p,i)=>`${i+1}. ${p.id} | ${p.name}${p.size?' | '+p.size:''} | Qty ${p.qty} ${p.unit}`),...(rfq.delivery_area?['','Delivery area: '+rfq.delivery_area]:[]),...(rfq.required_date?['Required date: '+rfq.required_date]:[]),...(rfq.supplier_note?['','Requirement notes:',rfq.supplier_note]:[]),'','Please confirm make/model, availability, unit rates, applicable GST, freight, delivery time, payment terms and quotation validity.','This is a request for quotation. A purchase order or engagement is confirmed separately.','','HM ELECTRICAL',c.company.phone,c.company.email];
 const message=lines.join('\n'),address=channel==='email'?supplier.email:channel==='whatsapp'?supplier.whatsapp:'';
 const link=message.length>1800?null:channel==='email'?'mailto:'+encodeURIComponent(address)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(message):channel==='whatsapp'?'https://wa.me/'+address+'?text='+encodeURIComponent(message):null;
 return {subject,message,address,channel,link,longMessage:message.length>1800};
}
module.exports={statuses,supplierFields,supplierSelect,uuid,date,supplier,response,safeItems,draft};
