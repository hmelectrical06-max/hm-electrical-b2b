'use strict';
const a=require('./enquiry-assistant.cjs'),mrp=require('./customer-mrp.cjs');
const SERVICE='Hi! We provide electrician, plumber and site manpower services. What work do you need? Share a brief description and our team will assist you.';
const HANDOFF='Thank you. Please select “Send enquiry to HM ELECTRICAL” and share your name and mobile number. Our team will contact you to confirm the work, availability and charges.';
const workDetail=s=>/leak|tripp|sparking|blocked|blockage|rewiring|wiring|installation|install |replace|repair|cable lay|termination|welding|fabrication|unloading|fitting|cleaning|maintenance|kharab/i.test(s);
function specifications(messages){const s=messages.filter(m=>m.role==='user').map(m=>m.content).join(' ');const size=/\d+(?:\.\d+)?\s*(?:mm|cm|inch|inches|sq\s*mm|sqmm|amp|a\b|watt|w\b)|\bM\d+\b/i.test(s),qty=/\d+(?:\.\d+)?\s*(?:pcs|pieces?|nos?|metres?|meters?|mtr|rolls?|boxes?|kg|litres?)\b/i.test(s);return {size,qty};}
function materialQuestion(messages){const p=specifications(messages);return !p.size&&!p.qty?'What size and quantity do you need?':!p.size?'What size do you need?':!p.qty?'What quantity do you need (pcs/metres/box)?':'Size and quantity noted. Please send your contact details through the enquiry form; our team will confirm the final rate.';}
let cache,until=0;
async function listed(query){
 if(!cache||Date.now()>until){cache=await require('./live-catalogue.cjs').products();until=Date.now()+120000;}
 const ignored=new Set(['please','need','want','required','price','rate','mrp','pcs','metres','meters','mm','sqmm','quantity','size','the','and','for']);
 const terms=(query.toLowerCase().match(/[a-z]{2,}/g)||[]).filter(w=>!ignored.has(w));
 return terms.length>0&&cache.some(p=>!p.hidden&&terms.every(w=>(String(p.name)+' '+String(p.size)).toLowerCase().split(/[^a-z0-9]+/).some(t=>t===w||t===w+'s')));
}
async function answer(messages){
 const last=messages.at(-1).content,users=messages.filter(m=>m.role==='user').map(m=>m.content),kind=a.topic(last);
 if(kind==='outside')return {step:'outside',reply:'Hi, please share your electrical/plumbing material or technician/manpower requirement. Civil work is not offered.',products:[],handoff:false};
 const previouslyAsked=messages.some(m=>m.role==='assistant'&&m.content===SERVICE);
 const explicitService=/\b(plumbers?|electricians?|technicians?|labou?r|helpers?|workers?|manpower|fitters?|welders?|riggers?|supervisors?)\b/i.test(last);
 let refs=[];
 const materialIndex=users.findLastIndex(s=>a.topic(s).endsWith('-material')),serviceIndex=users.findLastIndex(s=>a.topic(s).endsWith('-work'));
 const materialHistory=materialIndex>serviceIndex||messages.at(-2)?.content.includes('MRP references:')||serviceIndex<0;
 const query=materialHistory?users.slice(Math.max(0,materialIndex)).join(' '):last;
 if(!explicitService)try{refs=await mrp.references(query);}catch{}
 if(refs.length)return {step:'price',reply:mrp.text(refs,{max:500})+'\n'+materialQuestion(messages),products:[],mrpReferences:refs,handoff:specifications(messages).size&&specifications(messages).qty};
 const service=kind.endsWith('-work')||(!materialHistory&&previouslyAsked)||(!materialHistory&&users.some(s=>a.topic(s).endsWith('-work'))&&kind==='unclear');
 if(service){const detailed=workDetail(last)||(previouslyAsked&&!/^(?:\d+\s*)?(?:plumbers?|electricians?|labou?r|helpers?|technicians?)(?:\s+(?:chahiye|needed|required))?[.! ]*$/i.test(last.trim()));return {step:detailed?'handoff':'work',reply:detailed?HANDOFF:SERVICE,products:[],handoff:detailed};}
 // A product name is enough: show the available makes/sizes, without forcing a questionnaire.
 if(kind.endsWith('-material')||materialHistory&&users.some(s=>a.topic(s).endsWith('-material'))||/\b(rate|mrp|price|material|item)\b/i.test(last)){let known=false;try{known=await listed(query);}catch{}return {step:'handoff',reply:(known?'We can arrange supply of this material. Our team will discuss the rate with you. ':'Our team will check supply and confirm the rate for this material. ')+materialQuestion(messages),products:[],mrpReferences:[],handoff:true};}
 return {step:'scope',reply:'Hi! Which material or manpower service do you need?',products:[],handoff:false};
}
module.exports={answer,SERVICE,HANDOFF,workDetail,specifications,materialQuestion};
