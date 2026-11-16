'use strict';
const normal=require('./sales-catalogue.cjs').normal;
const brands=/\b(?:ashirvad|supreme|ajay|polycab|havells|finolex|bosch|dewalt|braco|ador|legrand|schneider|anchor|kei|esab|hilti|makita)\b/g;
const quantity=/\b\d+(?:\.\d+)?\s*(?:pcs|pieces?|nos?|metres?|meters?|mtr|rolls?|coils?|boxes?|kg|litres?)\b/g;
const size=/\b(?:\d+(?:\.\d+)?\s*x\s*)*\d+(?:\.\d+)?(?:\/\d+)?\s*(?:mm|cm|sqmm|inch|inches|amp|a|watt|w)\b|\bm\s*\d+\b/g;
function query(messages,{materialHint,serviceIntent}){
 let base='';
 for(const m of messages.filter(m=>m.role==='user')){
  const text=normal(m.content);
  if(materialHint(text)){base=text;continue;}
  if(serviceIntent(text)){base='';continue;}
  if(!base)continue;
  const make=text.match(brands),dimensions=text.match(size),qty=text.match(quantity),grade=text.match(/\b(?:sdr|sch|class)\s*\d+(?:\.\d+)?\b/g);
  if(make)base=base.replace(brands,'')+' '+make.join(' ');
  if(dimensions)base=base.replace(size,'')+' '+dimensions.join(' ');
  if(qty)base=base.replace(quantity,'')+' '+qty.join(' ');
  if(grade)base=base.replace(/\b(?:sdr|sch|class)\s*\d+(?:\.\d+)?\b/g,'')+' '+grade.join(' ');
 }
 return base?normal(base):normal(messages.at(-1).content);
}
function intake(messages,{materialHint,serviceIntent,workDetail,contact}){
 let turns=[];
 for(const m of messages.filter(m=>m.role==='user')){const s=normal(m.content);if(materialHint(s)&&!serviceIntent(s))turns=[];else turns.push(s);}
 const text=turns.join(' '),location=/\b(mumbai|mumbra|thane|kausa|borivali|sion|worli|bhiwandi|pune|ahmedabad|sanand|panvel)\b|\b(?:location|site|at|near)\s+[a-z][a-z ]{2,}/i.test(text),count=/\b\d+\s*(?:plumbers?|electricians?|welders?|fitters?|riggers?|helpers?|supervisors?|technicians?|labou?r|workers?|persons?|people|men)\b|(?:manpower|team|quantity)\s+\d+/i.test(text),date=/\b(?:today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/.test(text),work=workDetail(text);
 const missing=[!work?'work type':null,!location?'location':null,!count?'required manpower':null,!date?'starting date':null].filter(Boolean);
 const prefix='Yes, HM ELECTRICAL provides skilled manpower. ';
 return missing.length?{step:'work',reply:prefix+'Please share your '+missing.join(', ').replace(/, ([^,]+)$/,' and $1')+'. Final rates and booking require company approval.',products:[],handoff:false}:{step:'handoff',reply:'Thank you. Your work and manpower requirements are noted. Select “Request quotation / service” to send your enquiry, or '+contact+' Final rates, deployment and booking require company approval.',products:[],handoff:true};
}
module.exports={query,intake};
