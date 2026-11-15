'use strict';
const a=require('./enquiry-assistant.cjs'),mrp=require('./customer-mrp.cjs');
const SERVICE='Hi, electrician/plumber aur site manpower services available hain. Kya kaam hai? Short work detail bhej dijiye; aage HM ELECTRICAL ki team aapse baat karegi.';
const HANDOFF='Thank you. Ab “Send enquiry to HM ELECTRICAL” par apna naam aur mobile number dekar request bhej dijiye. Aage hamari team aapse baat karke charges aur availability confirm karegi.';
const workDetail=s=>/leak|tripp|sparking|blocked|blockage|rewiring|wiring|installation|install |replace|repair|cable lay|termination|welding|fabrication|unloading|fitting|cleaning|maintenance|kharab/i.test(s);
function specifications(messages){const s=messages.filter(m=>m.role==='user').map(m=>m.content).join(' ');const size=/\d+(?:\.\d+)?\s*(?:mm|cm|inch|inches|sq\s*mm|sqmm|amp|a\b|watt|w\b)|\bM\d+\b/i.test(s),qty=/\d+(?:\.\d+)?\s*(?:pcs|pieces?|nos?|metres?|meters?|mtr|rolls?|boxes?|kg|litres?)\b/i.test(s);return {size,qty};}
function materialQuestion(messages){const p=specifications(messages);return !p.size&&!p.qty?'Kaunsa size aur kitni quantity chahiye?':!p.size?'Kaunsa size chahiye?':!p.qty?'Kitni quantity chahiye (pcs/metres/box)?':'Size aur quantity note kar li hai. Contact bhej dijiye; final rate hamari team confirm karegi.';}
async function answer(messages){
 const last=messages.at(-1).content,users=messages.filter(m=>m.role==='user').map(m=>m.content),kind=a.topic(last);
 if(kind==='outside')return {step:'outside',reply:'Hi, please share your electrical/plumbing material or technician/manpower requirement. Civil work is not offered.',products:[],handoff:false};
 const previouslyAsked=messages.some(m=>m.role==='assistant'&&m.content===SERVICE);
 const explicitService=/\b(plumbers?|electricians?|technicians?|labou?r|helpers?|workers?|manpower|fitters?|welders?|riggers?|supervisors?)\b/i.test(last);
 let refs=[];
 const materialHistory=messages.some(m=>m.role==='assistant'&&m.content.includes('MRP references:'))||!users.some(s=>a.topic(s).endsWith('-work'));
 const query=materialHistory?users.join(' '):last;
 if(!explicitService)try{refs=await mrp.references(query);}catch{}
 if(refs.length)return {step:'price',reply:mrp.text(refs,{max:500})+'\n'+materialQuestion(messages),products:[],mrpReferences:refs,handoff:specifications(messages).size&&specifications(messages).qty};
 const service=kind.endsWith('-work')||previouslyAsked||(!materialHistory&&users.some(s=>a.topic(s).endsWith('-work'))&&kind==='unclear');
 if(service){const detailed=workDetail(last)||(previouslyAsked&&!/^(?:\d+\s*)?(?:plumbers?|electricians?|labou?r|helpers?|technicians?)(?:\s+(?:chahiye|needed|required))?[.! ]*$/i.test(last.trim()));return {step:detailed?'handoff':'work',reply:detailed?HANDOFF:SERVICE,products:[],handoff:detailed};}
 // A product name is enough: show the available makes/sizes, without forcing a questionnaire.
 if(kind.endsWith('-material')||materialHistory&&users.some(s=>a.topic(s).endsWith('-material'))||/\b(rate|mrp|price|material|item)\b/i.test(last))return {step:'handoff',reply:'Is item ka verified MRP abhi available nahi hai. '+materialQuestion(messages)+' “Send enquiry to HM ELECTRICAL” se contact bhej dijiye; hamari team rate batayegi.',products:[],mrpReferences:[],handoff:true};
 return {step:'scope',reply:'Hi! Item ka naam likhiye, available make aur MRP dikhayenge. Technician/labour chahiye to kaam ki short detail bhejiye; aage hamari team baat karegi.',products:[],handoff:false};
}
module.exports={answer,SERVICE,HANDOFF,workDetail,specifications,materialQuestion};
