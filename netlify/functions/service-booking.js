'use strict';

const {randomUUID}=require('node:crypto');
const c=require('../../server/core.cjs');
const {validateBooking,maxPhotoBytes}=require('../../server/service-bookings.cjs');
const {formatBookingEmail,sendOfficeEmail,emailFailureCode}=require('../../server/email-notifications.cjs');
const bucket='hm-service-booking-photos';
const serviceRoleHeaders=()=>({apikey:c.env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+c.env('SUPABASE_SERVICE_ROLE_KEY')});
const storageUrl=path=>c.env('SUPABASE_URL').replace(/\/+$/,'')+'/storage/v1/'+path;

exports.handler=c.safe(async event=>{
  if(event.httpMethod!=='POST')return c.reply(405,{ok:false,message:'Method not allowed.'});
  c.origin(event);
  let booking;
  try{
    booking=validateBooking(c.body(event,3*1024*1024));
  }catch(error){
    if(error.code===400)console.warn(`[service-booking] Request rejected: ${error.message}`);
    throw error;
  }
  await c.rate(event,'service-booking',10);
  const id=randomUUID(),reference='HM-SVC-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+id.slice(0,6).toUpperCase();
  const createdAt=new Date().toISOString();
  let photoPath=null;
  if(booking.photo){
    if(booking.photo.buffer.length>maxPhotoBytes)c.fail(400,'The selected photo is larger than 2 MB.');
    photoPath=`${id}.${booking.photo.extension}`;
    await c.request(storageUrl(`object/${bucket}/${photoPath}`),{
      method:'POST',
      headers:{...serviceRoleHeaders(),'Content-Type':booking.photo.type,'x-upsert':'false'},
      body:booking.photo.buffer
    });
  }
  let rows;
  try{
    rows=await c.db('service_bookings','POST',{
      id,reference,customer_name:booking.name,mobile:booking.mobile,category:booking.category,
      description:booking.description,area:booking.area,address:booking.address,
      preferred_at:booking.preferredAt,status:'New',payment_status:'Pending',photo_path:photoPath,
      email_status:'pending'
    });
    if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==id)c.fail(503,'The booking service did not confirm a saved request. Please retry.');
  }catch(error){
    if(photoPath){
      try{
        await c.request(storageUrl(`object/${bucket}/${photoPath}`),{method:'DELETE',headers:serviceRoleHeaders()});
      }catch{
        console.error('A service-booking photo cleanup failed; review private storage for an orphaned upload.');
      }
    }
    throw error;
  }
  try{
    const emailId=await sendOfficeEmail({
      idempotencyKey:'hm-service-'+id,
      subject:'New HM ELECTRICAL service booking '+reference,
      text:formatBookingEmail(booking,reference,createdAt)
    });
    const updated=await c.db(`service_bookings?id=eq.${id}`,'PATCH',{
      email_status:'accepted',
      email_provider_id:emailId
    });
    if(!Array.isArray(updated)||updated.length!==1)throw new Error('EMAIL_STATUS_UPDATE_UNCONFIRMED');
  }catch(error){
    console.error(`[service-booking] Office email pending for ${reference}; booking remains saved. ${emailFailureCode(error)}`);
  }
  return c.reply(201,{ok:true,reference,message:`Booking request received. Reference: ${reference}. Our team will review it; your appointment is not confirmed until HM ELECTRICAL accepts it. No payment has been collected.`});
});
