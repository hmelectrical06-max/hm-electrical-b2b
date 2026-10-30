const c=require('../../server/core.cjs');
const {formatEnquiryEmail,sendOfficeEmail,emailFailureCode}=require('../../server/email-notifications.cjs');
exports.handler=c.safe(async e=>{
  if(e.httpMethod!=='POST')return c.reply(405,{ok:false});
  c.origin(e);
  const p=c.validate(c.body(e));
  if(p.rfq_fields_requested){
    try{
      await c.db('enquiries?select=company_name,required_date&limit=0');
    }catch(error){
      if(error.code===503&&error.message.includes('returned HTTP 400'))c.fail(503,'RFQ company and required-date fields are not enabled in the database. Apply the additive RFQ migration before accepting these requests.');
      throw error;
    }
  }
  await c.rate(e,'enquiry',20);
  const rows=await c.db('rpc/hm_save','POST',{p_request:p,p_fingerprint:c.fingerprint(p)});
  const row=rows?.[0];
  if(!row||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id||''))c.fail(503,'The database did not confirm a stored enquiry. Retry the same request.');
  if(row.fingerprint!==c.fingerprint(p))c.fail(409,'This request ID was used for different details. Review the enquiry again.');
  if(!['pending','accepted'].includes(row.email_status))c.fail(503,'The database returned an incomplete enquiry confirmation.');

  let emailStatus=row.email_status;
  if(emailStatus==='pending'){
    try{
      const saved=await c.db(`enquiries?id=eq.${row.id}&select=id,name,company_name,phone,email,location,required_date,created_at,type,details,items`);
      if(!Array.isArray(saved)||saved.length!==1)throw new Error('The saved enquiry could not be loaded for notification.');
      const emailId=await sendOfficeEmail({
        idempotencyKey:'hm-'+row.id,
        subject:'New HM ELECTRICAL enquiry '+row.id,
        text:formatEnquiryEmail(saved[0])
      });
      const updated=await c.db('enquiries?id=eq.'+row.id,'PATCH',{
        email_status:'accepted',
        email_provider_id:emailId
      });
      if(!Array.isArray(updated)||updated.length!==1)throw new Error('The saved email status was not confirmed.');
      emailStatus='accepted';
    }catch(error){
      console.error(`[enquiry] Office email pending for ${row.id}; the scheduled retry remains available. ${emailFailureCode(error)}`);
    }
  }
  return c.reply(200,{
    ok:true,
    reference:row.id,
    emailStatus,
    message:'Enquiry saved. Reference: '+row.id+'. Email notification '+(emailStatus==='accepted'?'accepted by provider.':'queued for our office.')
  });
});
