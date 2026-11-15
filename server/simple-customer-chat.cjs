'use strict';
const a=require('./enquiry-assistant.cjs'),mrp=require('./customer-mrp.cjs');
const SERVICE='Hi! We provide electrician, plumber and site manpower services. What work do you need? Share a brief description and our team will assist you.';
const CONTACT='Please call HM ELECTRICAL on 8085560156 or email hmelectrical06@gmail.com to confirm your requirement.';
const HANDOFF='Thank you. '+CONTACT+' Our team will confirm availability and final charges. You can also send the enquiry form.';
const workDetail=s=>/leak|tripp|sparking|blocked|blockage|rewiring|wiring|installation|install |replace|repair|cable lay|termination|welding|fabrication|unloading|fitting|cleaning|maintenance|kharab/i.test(s);
function specifications(messages){const s=messages.filter(m=>m.role==='user').map(m=>m.content).join(' ');const size=/\d+(?:\.\d+)?\s*(?:mm|cm|inch|inches|sq\s*mm|sqmm|amp|a\b|watt|w\b)|\bM\d+\b/i.test(s),qty=/\d+(?:\.\d+)?\s*(?:pcs|pieces?|nos?|metres?|meters?|mtr|rolls?|boxes?|kg|litres?)\b/i.test(s);return {size,qty};}
function materialQuestion(messages){const p=specifications(messages);return !p.size&&!p.qty?'What size and quantity do you need?':!p.size?'What size do you need?':!p.qty?'What quantity do you need (pcs/metres/box)?':'Size and quantity noted. Please call 8085560156 or email hmelectrical06@gmail.com for the final rate.';}
let cache,until=0;
async function listed(query){
 if(!cache||Date.now()>until){cache=await require('./live-catalogue.cjs').products();until=Date.now()+120000;}
 const ignored=new Set(['please','need','want','required','price','rate','mrp','pcs','metres','meters','mm','sqmm','quantity','size','the','and','for']);
 const terms=(query.toLowerCase().match(/[a-z]{2,}/g)||[]).filter(w=>!ignored.has(w));
 return terms.length>0&&cache.some(p=>!p.hidden&&terms.every(w=>(String(p.name)+' '+String(p.size)).toLowerCase().split(/[^a-z0-9]+/).some(t=>t===w||t===w+'s')));
}
function normalQuery(s){return s.replace(/\b(?:tar|taar)\b/gi,'wire').replace(/\bpaip\b/gi,'pipe').replace(/\b(?:bulb|lamp)\b/gi,'light').replace(/\bbreaker\b/gi,'MCB').replace(/\b(?:socket pipe|coupling)\b/gi,'coupler').replace(/\b(?:labor|mistri)\b/gi,'labour');}
function companyReply(q){
 const k=require('./public-company-knowledge.json');
 const words=q.toLowerCase().match(/[a-z]{4,}/g)||[];
 const found=k.projects.filter(x=>words.some(w=>!['project','projects','details','about','company','electrical','material','team','work'].includes(w)&&x.name.toLowerCase().split(/[^a-z]+/).includes(w)));
 if(found.length)return 'From our public project portfolio: '+found.slice(0,3).map(x=>x.name+' — '+x.detail).join('; ')+'. Full portfolio: https://hmelectricalb2b.com/company-projects.html';
 const person=k.team.find(x=>words.some(w=>!['team','electrical','company','profile','details','about'].includes(w)&&x.name.toLowerCase().split(/[^a-z]+/).includes(w)));
 if(person)return person.name+' — '+person.detail+'. Public team sheet: https://hmelectricalb2b.com/company-team.html';
 if(/\b(projects?|experience|clients?|portfolio)\b/i.test(q))return 'Our public project portfolio includes '+k.projects.slice(0,4).map(x=>x.name).join(', ')+'. View the full project sheet: https://hmelectricalb2b.com/company-projects.html';
 if(/\b(team|staff|owner|proprietor|leadership)\b/i.test(q))return 'HM ELECTRICAL is led by proprietor Mohammad Asif. We handle electrician, plumber, fitter, welder, helper and supervisor enquiries. Public team profiles: https://hmelectricalb2b.com/company-team.html. Our office confirms team availability for each requirement.';
 if(/\b(company|profile|about|contact|address|location|shop|office)\b/i.test(q)&&!/pipe|wire|cable|mcb/i.test(q))return 'HM ELECTRICAL supplies materials and handles electrical, plumbing and site manpower enquiries across Mumbai, Mumbra and Thane. Operating shop: Khardi Road, Mumbra, Thane. Registered office: A-85, Naik Nagar, LBS Marg, Sion West, Mumbai 400022. Call 8085560156 or email hmelectrical06@gmail.com. Profile: https://hmelectricalb2b.com/company-profile.html';
 return null;
}
async function answer(messages){
 const last=normalQuery(messages.at(-1).content),users=messages.filter(m=>m.role==='user').map(m=>normalQuery(m.content)),kind=a.topic(last);
 if(/\b(confirm|confirmation|proceed|order|book|booking|call|phone|mobile|email|mail|contact|talk|speak)\b|baat|bat kar|aage|number|nomber/i.test(last))return {step:'handoff',reply:CONTACT+' Final rates, stock and service bookings are confirmed by our team.',products:[],handoff:true};
 const company=companyReply(last);if(company)return {step:'company',reply:company,products:[],handoff:false};
 if(kind==='outside')return {step:'outside',reply:'Hi, please share your electrical/plumbing material or technician/manpower requirement. Civil work is not offered.',products:[],handoff:false};
 const previouslyAsked=messages.some(m=>m.role==='assistant'&&m.content===SERVICE);
 const explicitService=/\b(plumbers?|electricians?|technicians?|labou?r|helpers?|workers?|manpower|fitters?|welders?|riggers?|supervisors?)\b/i.test(last);
 let refs=[];
 const materialIndex=users.findLastIndex(s=>a.topic(s).endsWith('-material')),serviceIndex=users.findLastIndex(s=>a.topic(s).endsWith('-work'));
 const materialHistory=materialIndex>serviceIndex||messages.at(-2)?.content.includes('MRP references:')||serviceIndex<0;
 const query=materialHistory?users.slice(Math.max(0,materialIndex)).join(' '):last;
 if(!explicitService)try{refs=await mrp.references(query);}catch{}
 if(refs.length)return {step:'price',reply:mrp.text(refs,{max:500})+'\n'+materialQuestion(messages),products:[],mrpReferences:refs,handoff:specifications(messages).size&&specifications(messages).qty};
 let known=false;if(!explicitService&&!workDetail(last))try{known=await listed(query);}catch{}
 if(known)return {step:'handoff',reply:'We can arrange supply of this material. Our team will discuss the rate with you. '+materialQuestion(messages),products:[],mrpReferences:[],handoff:true};
 const service=kind.endsWith('-work')||(!materialHistory&&previouslyAsked)||(!materialHistory&&users.some(s=>a.topic(s).endsWith('-work'))&&kind==='unclear');
 if(service){const detailed=workDetail(last)||(previouslyAsked&&!/^(?:\d+\s*)?(?:plumbers?|electricians?|labou?r|helpers?|technicians?)(?:\s+(?:chahiye|needed|required))?[.! ]*$/i.test(last.trim()));return {step:detailed?'handoff':'work',reply:detailed?HANDOFF:SERVICE,products:[],handoff:detailed};}
 // A product name is enough: show the available makes/sizes, without forcing a questionnaire.
 if(kind.endsWith('-material')||materialHistory&&users.some(s=>a.topic(s).endsWith('-material'))||/\b(rate|mrp|price|material|item)\b/i.test(last)){let known=false;try{known=await listed(query);}catch{}return {step:'handoff',reply:(known?'We can arrange supply of this material. Our team will discuss the rate with you. ':'Our team will check supply and confirm the rate for this material. ')+materialQuestion(messages),products:[],mrpReferences:[],handoff:true};}
 return {step:'scope',reply:'Hi! Which material or manpower service do you need?',products:[],handoff:false};
}
module.exports={CONTACT,normalQuery,companyReply,answer,SERVICE,HANDOFF,workDetail,specifications,materialQuestion};
