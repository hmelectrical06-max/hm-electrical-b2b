'use strict';
const c=require('./core.cjs');
const trades=['Electrician','Plumber','Fire Fitter','Welder','Helper','Civil Labour','Supervisor'];
const statuses=['New','Contacted','Quoted','Confirmed','Closed'];
const text=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/.test(v)||(required&&!v.trim()))c.fail(400,'Please check the manpower request fields.');return v.trim();};
function validate(p){
 if(!p||p.website||p.consent!==true||!trades.includes(p.trade))c.fail(400,'Select a trade and accept the contact consent.');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.requestId||''))c.fail(400,'Invalid request ID.');
 if(!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>500)c.fail(400,'Quantity must be between 1 and 500 people.');
 const date=text(p.requiredDate,10,true),today=new Date(Date.now()+19800000).toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<today)c.fail(400,'Choose a valid required date, today or later.');
 const phone=text(p.phone,20,true),email=text(p.email||'',254);
 if(!/^[+\d() .-]+$/.test(phone)||!/^\d{10,15}$/.test(phone.replace(/\D/g,''))||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))c.fail(400,'Enter a valid phone number and email.');
 return {request_id:p.requestId,trade:p.trade,quantity:p.quantity,site_location:text(p.siteLocation,300,true),duration:text(p.duration,120,true),contact_name:text(p.contactName,120,true),phone,email,required_date:date,details:text(p.details||'',2000),consent:true};
}
const emailText=r=>`MANPOWER REQUEST ${r.id}\nTrade: ${r.trade}\nQuantity: ${r.quantity}\nSite: ${r.site_location}\nDuration: ${r.duration}\nRequired date: ${r.required_date}\nContact: ${r.contact_name}\nPhone: ${r.phone}\nEmail: ${r.email||'Not supplied'}\nDetails: ${r.details}\nRequest only; availability and engagement require office confirmation.`;
module.exports={trades,statuses,validate,text,emailText};
