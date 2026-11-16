'use strict';
const catalogue=require('./sales-catalogue.cjs'),mrp=require('./customer-mrp.cjs'),company=require('./sales-company.cjs');
const CONTACT=company.CONTACT;
const SERVICE='Hi! We provide electrician, plumber and site manpower services. What work do you need? Share a brief description and our team will assist you.';
const HANDOFF='Thank you. '+CONTACT+' Our team will confirm availability and final charges. You can also send the enquiry form.';
const workDetail=s=>/leak|tripp|sparking|blocked|blockage|rewiring|wiring|installation|install |replace|repair|cable lay|termination|welding|fabrication|unloading|fitting|cleaning|maintenance|kharab/i.test(s);
const civil=s=>/\bcivil\b|shutter\w*|pile head|excavation|masonry|concrete|reinforcement fixing/i.test(s);
const serviceIntent=s=>/\b(plumbers?|electricians?|technicians?|labou?r|helpers?|workers?|manpower|fitters?|welders?|riggers?|supervisors?)\b|(?:installation|maintenance|repair|contracting|erection|wiring|fabrication|phe work|hvac work|mechanical work)/i.test(s);
const materialHint=s=>/\b(wire|cable|pipe|cpvc|upvc|pvc|mcb|mccb|rccb|rcbo|gi|ms|angle|fastener|anchor|nut|bolt|washer|sprinkler|valve|hose|hydrant|fitting|elbow|tee|reducer|socket|switch|light|led|conduit|gland|lug|earthing|grinder|drill|machine|helmet|glove|shoe|safety|welding rod|paint|primer|thinner|tool|material|product|item|detector)\b|\b(?:mat|csv|ss|add|fp|pl)-[a-z0-9-]+/i.test(s);
const normalQuery=catalogue.normal;
const companyReply=company.reply;
function contextQuery(messages){
 const last=normalQuery(messages.at(-1).content),users=messages.filter(m=>m.role==='user').map(m=>normalQuery(m.content));
 if(materialHint(last))return last;
 const prior=users.slice(0,-1).findLast(s=>materialHint(s)||serviceIntent(s));
 if(prior&&materialHint(prior)&&(catalogue.specs(last).size||catalogue.specs(last).qty||/^(?:ashirvad|supreme|ajay|polycab|havells|finolex|bosch|dewalt|braco)(?:\s|$)/.test(last))){
  const base=catalogue.specs(last).size?prior.replace(/\b\d+(?:\.\d+)?\s*(?:mm|cm|sqmm|inch|inches|amp|a|watt|w)\b/g,''):prior;
  return base+' '+last;
 }
 return last;
}
function specifications(messages){return catalogue.specs(contextQuery(messages));}
function materialQuestion(messages,{codeMatched=false,sizeRequired=true}={}){
 const p=specifications(messages),size=p.size||codeMatched||!sizeRequired;
 return !size&&!p.qty?'What size and quantity do you need?':!size?'What size/specification do you need?':!p.qty?'Please share your required quantity for a final quotation.':'Size and quantity noted. '+CONTACT+' Our team will confirm the final quotation.';
}
function money(n){return '₹'+Number(n).toFixed(2);}
function productText(p){
 const lines=[p.name.slice(0,72)+(p.size?' | '+p.size.slice(0,65):''),[p.brand?'Make: '+p.brand:null,p.unit?'Unit: '+p.unit:null,p.sku||p.id?'Code: '+(p.sku||p.id):null].filter(Boolean).join(' | ')];
 if(p.mrp!==null&&p.mrp!==undefined)lines.push('MRP: '+money(p.mrp)+(p.unit?'/'+p.unit:''));
 if(p.sellingPrice!==null&&p.sellingPrice!==undefined)lines.push('Our Price: '+money(p.sellingPrice)+(p.unit?'/'+p.unit:'')+(p.minimumQuantity?' (minimum '+p.minimumQuantity+' '+p.unit+')':''));
 if(p.gstRate!==null&&p.gstRate!==undefined)lines.push('GST rate: '+p.gstRate+'%; inclusion in the quoted price is confirmed by our team.');
 return lines.filter(Boolean).join('\n');
}
function materialReply(products,messages){
 const priced=products.some(p=>p.mrp!==null&&p.mrp!==undefined||p.sellingPrice!==null&&p.sellingPrice!==undefined);
 const q=contextQuery(messages),codeMatched=products.some(p=>[p.id,p.sku].filter(Boolean).some(code=>normalQuery(code)===q));
 const sizeRequired=products.some(p=>p.size&&!/^(standard|n\/a)$/i.test(p.size));
 const ask=materialQuestion(messages,{codeMatched,sizeRequired}),prefix='Yes, this material is listed in our HM ELECTRICAL catalogue.\n';
 let shown=products.slice(0,2),suffix=priced?'\nMRP is a reference; final selling price and stock require confirmation.\n'+ask:'\nCurrent price is available on request. '+ask+(catalogue.specs(q).qty?'':' '+CONTACT);
 let reply=prefix+shown.map(productText).join('\n\n')+suffix;
 while(reply.length>650&&shown.length>1){shown.pop();reply=prefix+shown.map(productText).join('\n\n')+suffix;}
 if(reply.length>650){suffix='\n'+(priced?'Final rate and stock require confirmation. ':'Price on request. ')+((catalogue.specs(q).qty)?CONTACT:'Please share the required quantity. '+CONTACT);reply=prefix+productText(shown[0])+suffix;}
 return {step:priced?'price':'handoff',reply:reply.slice(0,650),products:shown,mrpReferences:shown.filter(p=>p.mrp!==null&&p.mrp!==undefined).map(p=>({name:p.name,size:p.size,brand:p.brand,unit:p.unit,mrp:p.mrp,sku:p.sku})),handoff:!priced||catalogue.specs(q).qty};
}
async function answer(messages){
 const last=normalQuery(messages.at(-1).content),query=contextQuery(messages);
 if(/supplier.{0,20}discount|buying (?:rate|cost|price)|purchase (?:rate|cost|price)|bank (?:details|account)|aadhaar|aadhar|employee.{0,20}(?:salary|personal|mobile)|api key|password|secret key/i.test(last))return {step:'private',reply:'Private supplier terms, buying costs, bank details, credentials and employee personal records are not shared in this public chat. For an authorised business enquiry, '+CONTACT,products:[],handoff:true};
 if(civil(last))return {step:'outside',reply:'Civil work and civil labour are not offered. We handle material supply, electrical, Fire Fighting, Plumbing/PHE, HVAC/mechanical, fabrication and technician enquiries. '+CONTACT,products:[],handoff:false};
 if(/\b(confirm|confirmation|proceed|booking|call|phone|mobile|email|mail|contact|talk|speak)\b|place (?:an? )?order|book (?:a |an )?(?:technician|plumber|electrician)|baat|bat kar|aage|nomber/i.test(last))return {step:'handoff',reply:CONTACT+' Final rates, stock and service bookings are confirmed by our team.',products:[],handoff:true};
 const publicInfo=!materialHint(last)?companyReply(last):null;if(publicInfo)return {step:'company',reply:publicInfo.slice(0,650),products:[],handoff:false};
 const previousService=messages.some(m=>m.role==='assistant'&&m.content===SERVICE);
 const isService=serviceIntent(last)&&!(/\b(welding machine|welding rod|drill machine|safety|helmet|glove|shoe|fire sprinkler|fire hydrant|fire hose)\b/.test(last))||previousService&&!materialHint(last)&&query===last;
 if(isService){const detailed=workDetail(last)||previousService&&!/^(?:\d+\s*)?(?:plumbers?|electricians?|labou?r|helpers?|technicians?)(?:\s+(?:chahiye|needed|required))?[.! ]*$/i.test(last.trim());return {step:detailed?'handoff':'work',reply:detailed?HANDOFF:SERVICE,products:[],handoff:detailed};}
 if(/^(?:hi|hello|hey|help|good morning|good evening)[.! ]*$/.test(last))return {step:'scope',reply:'Hi! Which material or manpower service do you need?',products:[],handoff:false};
 let items;
 try{items=await catalogue.products();}catch{return {step:'unavailable',reply:'Our catalogue is temporarily unavailable. '+CONTACT+' Our team will check the material and rate for you.',products:[],handoff:true};}
 const matches=catalogue.search(query,items);
 let refs=[];try{refs=await mrp.references(query);}catch{/* An unavailable rate source never becomes a guessed amount. */}
 // Verified reference rows are used only for a material family that is publicly listed.
 const familyQuery=query.replace(/\b(ashirvad|supreme|ajay|polycab|havells|finolex|braco|bosch|dewalt|ador|legrand|schneider|anchor|lauritz)\b/g,'').replace(/\b[356]\s*(?:m|mtr)\b/g,'');
 let familyMatches=matches.length?matches:catalogue.search(familyQuery,items);
 if(!familyMatches.length&&refs.some(r=>r.sku&&query.includes(r.sku))){const ref=refs[0],words=normalQuery(ref.name).split(' '),family=words.filter(w=>/^(?:cpvc|upvc|pvc|pipe|elbow|tee|socket|reducer|coupler|union|valve|bush|cap|plug|bend)$/.test(w)).join(' ');if(family)familyMatches=catalogue.search(family,items);}
 if(refs.length&&familyMatches.length)return materialReply(refs.map(catalogue.referenceView),messages);
 if(matches.length)return materialReply(matches,messages);
 if(/\b(fire fighting|firefighting|hvac|mechanical|plumbing|phe|electrical)\b/.test(last)&&!materialHint(last))return {step:'work',reply:'HM ELECTRICAL handles '+company.SERVICES+' What work do you need?',products:[],handoff:false};
 return {step:'not-found',reply:'This item is not currently listed in our catalogue. However, our team may be able to arrange it through our supplier network. Please call 8085560156 / 7905681022 for availability and pricing.',products:[],handoff:true};
}
module.exports={CONTACT,normalQuery,companyReply,answer,SERVICE,HANDOFF,workDetail,specifications,materialQuestion,contextQuery,materialReply};
