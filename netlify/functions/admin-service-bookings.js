'use strict';

const c=require('../../server/core.cjs');
const {bookingStatuses,paymentStatuses,technicianAvailability,validateTechnician,validateCharge}=require('../../server/service-bookings.cjs');
const bucket='hm-service-booking-photos';
const serviceRoleHeaders=()=>({apikey:c.env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+c.env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'});
const storageUrl=path=>c.env('SUPABASE_URL').replace(/\/+$/,'')+'/storage/v1/'+path;
function validId(id){return typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);}
function optionalText(value,max){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||!value.trim())c.fail(400,'Invalid technician fields.');return value.trim();}
function urlForSignedPath(value){
  if(typeof value!=='string'||!value.startsWith('/object/sign/'))c.fail(503,'The private photo service returned an invalid link.');
  return c.env('SUPABASE_URL').replace(/\/+$/,'')+'/storage/v1'+value;
}
async function signedPhoto(path){
  if(typeof path!=='string'||!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(path))c.fail(503,'The stored photo path is invalid.');
  const result=await c.request(storageUrl(`object/sign/${bucket}/${path}`),{
    method:'POST',headers:serviceRoleHeaders(),body:JSON.stringify({expiresIn:300})
  });
  return urlForSignedPath(result?.signedURL);
}
async function techniciansWithCounts(){
  const technicians=await c.db('service_technicians?select=id,name,mobile,trade,availability,is_active,created_at&order=created_at.asc');
  return Promise.all(technicians.map(async technician=>({
    ...technician,
    assignedJobs:await c.dbCount(`service_bookings?select=id&technician_id=eq.${technician.id}&status=in.(Assigned,In%20Progress)`)
  })));
}
async function createTechnician(payload){
  const technician=validateTechnician(payload);
  if(payload.availability!==undefined&&!technicianAvailability.includes(payload.availability))c.fail(400,'Invalid technician availability.');
  const total=await c.dbCount('service_technicians?select=id');
  if(total>=10)c.fail(409,'The technician roster is limited to 10 records.');
  const rows=await c.db('service_technicians','POST',{...technician,availability:payload.availability||'Available',is_active:true});
  if(!Array.isArray(rows)||rows.length!==1)c.fail(503,'The technician service did not confirm the saved record.');
  return c.reply(201,{ok:true});
}
async function updateTechnician(payload){
  if(!validId(payload.id))c.fail(400,'Invalid technician ID.');
  const patch={updated_at:new Date().toISOString()};
  if(payload.name!==undefined)patch.name=optionalText(payload.name,120);
  if(payload.mobile!==undefined){
    patch.mobile=optionalText(payload.mobile,20);
    if(!/^[+\d() .-]+$/.test(patch.mobile)||!/^\d{10,15}$/.test(patch.mobile.replace(/\D/g,'')))c.fail(400,'Invalid technician mobile number.');
  }
  if(payload.trade!==undefined)patch.trade=optionalText(payload.trade,100);
  if(payload.availability!==undefined){
    if(!technicianAvailability.includes(payload.availability))c.fail(400,'Invalid technician availability.');
    patch.availability=payload.availability;
  }
  if(payload.isActive!==undefined){
    if(typeof payload.isActive!=='boolean')c.fail(400,'Invalid technician status.');
    patch.is_active=payload.isActive;
  }
  const rows=await c.db(`service_technicians?id=eq.${payload.id}`,'PATCH',patch);
  if(!rows.length)c.fail(404,'Technician not found.');
  return c.reply(200,{ok:true});
}
async function updateBooking(payload){
  if(!validId(payload.id))c.fail(400,'Invalid booking ID.');
  const patch={updated_at:new Date().toISOString()};
  if(payload.status!==undefined){
    if(!bookingStatuses.includes(payload.status))c.fail(400,'Invalid booking status.');
    patch.status=payload.status;
  }
  if(payload.technicianId!==undefined){
    if(payload.technicianId!==null&&!validId(payload.technicianId))c.fail(400,'Invalid technician assignment.');
    if(payload.technicianId){
      const technician=await c.db(`service_technicians?id=eq.${payload.technicianId}&select=id,is_active,availability`);
      if(!technician.length||!technician[0].is_active||technician[0].availability!=='Available')c.fail(400,'Select an active, available technician.');
    }
    patch.technician_id=payload.technicianId;
  }
  if(payload.quotedCharge!==undefined)patch.quoted_charge=validateCharge(payload.quotedCharge);
  if(payload.finalCharge!==undefined)patch.final_charge=validateCharge(payload.finalCharge);
  if(payload.paymentStatus!==undefined){
    if(!paymentStatuses.includes(payload.paymentStatus))c.fail(400,'Invalid payment status.');
    patch.payment_status=payload.paymentStatus;
  }
  if(Object.keys(patch).length===1)c.fail(400,'No booking changes were supplied.');
  if(['Assigned','In Progress'].includes(payload.status)){
    let technicianId=patch.technician_id;
    if(technicianId===undefined){
      const current=await c.db(`service_bookings?id=eq.${payload.id}&select=technician_id`);
      if(!current.length)c.fail(404,'Booking not found.');
      technicianId=current[0].technician_id;
    }
    if(!technicianId)c.fail(400,'Assign an available technician before assigning or starting this booking.');
    const assigned=await c.db(`service_technicians?id=eq.${technicianId}&select=id,is_active,availability`);
    if(!assigned.length||!assigned[0].is_active||assigned[0].availability!=='Available')c.fail(400,'Select an active, available technician before assigning or starting this booking.');
  }
  const rows=await c.db(`service_bookings?id=eq.${payload.id}`,'PATCH',patch);
  if(!rows.length)c.fail(404,'Booking not found.');
  return c.reply(200,{ok:true});
}

exports.handler=c.safe(async event=>{
  await c.admin(event);
  if(event.httpMethod==='GET'){
    const query=event.queryStringParameters||{},view=query.view||'bookings';
    if(view==='technicians')return c.reply(200,{ok:true,technicians:await techniciansWithCounts()});
    if(view!=='bookings')c.fail(400,'Invalid service-booking view.');
    const page=Number(query.page||0);
    if(!Number.isInteger(page)||page<0||page>100000)c.fail(400,'Invalid page.');
    const filter=new URLSearchParams({select:'*',order:'created_at.desc',limit:'25',offset:String(page*25)});
    if(query.status){
      if(!bookingStatuses.includes(query.status))c.fail(400,'Invalid booking status.');
      filter.set('status','eq.'+query.status);
    }
    const [rows,technicians]=await Promise.all([
      c.db('service_bookings?'+filter),
      c.db('service_technicians?select=id,name,trade,is_active,availability&order=name.asc')
    ]);
    const byId=new Map(technicians.map(item=>[item.id,item]));
    const bookings=await Promise.all(rows.map(async booking=>({
      ...booking,
      technician:booking.technician_id?byId.get(booking.technician_id)||null:null,
      photoUrl:booking.photo_path?await signedPhoto(booking.photo_path):null
    })));
    return c.reply(200,{ok:true,rows:bookings,technicians,more:rows.length===25});
  }
  if(event.httpMethod!=='POST'&&event.httpMethod!=='PATCH')return c.reply(405,{ok:false,message:'Method not allowed.'});
  c.origin(event);
  const payload=c.body(event);
  if(event.httpMethod==='POST'){
    if(payload.action!=='create-technician')c.fail(400,'Invalid administrator action.');
    return createTechnician(payload);
  }
  if(payload.action==='update-technician')return updateTechnician(payload);
  if(payload.action==='update-booking')return updateBooking(payload);
  c.fail(400,'Invalid administrator action.');
});
