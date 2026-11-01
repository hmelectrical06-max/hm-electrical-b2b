const c=require('../../server/core.cjs');
const {formatEnquiryEmail,formatBookingEmail,sendOfficeEmail,emailFailureCode}=require('../../server/email-notifications.cjs');
// Scheduled invocation only; Netlify does not expose scheduled functions as web endpoints.
exports.handler=async()=>{
  c.env('HM_EMAIL_PROVIDER_TOKEN');
  c.env('EMAIL_FROM');
  let enquiriesAccepted=0,bookingsAccepted=0;
  try{
    const rows=await c.db('rpc/hm_claim_notifications','POST',{});
    await Promise.all(rows.map(async row=>{
      try{
        const emailId=await sendOfficeEmail({
          idempotencyKey:'hm-'+row.id,
          subject:'New HM ELECTRICAL enquiry '+row.id,
          text:formatEnquiryEmail(row)
        });
        await c.db('enquiries?id=eq.'+row.id,'PATCH',{email_status:'accepted',email_provider_id:emailId});
        enquiriesAccepted++;
      }catch(error){
        console.error(`[notify] Enquiry email pending for ${row.id}. ${emailFailureCode(error)}`);
      }
    }));
  }catch(error){
    console.error(`[notify] Enquiry retry queue unavailable. ${emailFailureCode(error)}`);
  }
  try{
    const bookings=await c.db('service_bookings?select=id,reference,customer_name,mobile,category,description,area,address,preferred_at,created_at&email_status=eq.pending&order=created_at.asc&limit=25');
    await Promise.all(bookings.map(async booking=>{
      try{
        const emailId=await sendOfficeEmail({
          idempotencyKey:'hm-service-'+booking.id,
          subject:'New HM ELECTRICAL service booking '+booking.reference,
          text:formatBookingEmail({
            name:booking.customer_name,mobile:booking.mobile,category:booking.category,
            description:booking.description,area:booking.area,address:booking.address,
            preferredAt:booking.preferred_at,photo:null
          },booking.reference,booking.created_at)
        });
        const updated=await c.db(`service_bookings?id=eq.${booking.id}`,'PATCH',{
          email_status:'accepted',
          email_provider_id:emailId
        });
        if(!Array.isArray(updated)||updated.length!==1)throw new Error('EMAIL_STATUS_UPDATE_UNCONFIRMED');
        bookingsAccepted++;
      }catch(error){
        console.error(`[notify] Booking email pending for ${booking.reference}. ${emailFailureCode(error)}`);
      }
    }));
  }catch(error){
    console.error(`[notify] Booking retry queue unavailable. ${emailFailureCode(error)}`);
  }
  return {statusCode:200,body:JSON.stringify({enquiriesAccepted,bookingsAccepted})};
};
