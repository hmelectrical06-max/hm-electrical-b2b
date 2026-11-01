'use strict';

const c=require('./core.cjs');

function emailErrorCode(status){
  if(status===401)return 'RESEND_CREDENTIAL_REJECTED';
  if(status===403)return 'RESEND_SENDER_OR_ACCOUNT_FORBIDDEN';
  if(status===422)return 'RESEND_SENDER_OR_REQUEST_REJECTED';
  if(status===429)return 'RESEND_RATE_LIMITED';
  if(status>=500)return 'RESEND_TEMPORARILY_UNAVAILABLE';
  return `RESEND_HTTP_${status}`;
}

function validateSender(value){
  if(typeof value!=='string')throw new Error('EMAIL_FROM_INVALID');
  const sender=value.match(/^(?:[^<>]*<)?\s*([^\s<>@]+)@([^\s<>@]+)\s*>?$/);
  if(!sender||!sender[2].includes('.'))throw new Error('EMAIL_FROM_INVALID');
  return value;
}

function emailFailureCode(error){
  if(typeof error?.message==='string'&&/^[A-Z][A-Z0-9_]*$/.test(error.message))return error.message;
  if(error?.message==='Service configuration is incomplete.')return 'EMAIL_CONFIGURATION_MISSING';
  if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'RESEND_TIMEOUT';
  return 'RESEND_NETWORK_OR_DELIVERY_ERROR';
}

function formatDateTime(value){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return String(value||'Not supplied');
  return new Intl.DateTimeFormat('en-IN',{
    dateStyle:'medium',
    timeStyle:'short',
    timeZone:'Asia/Kolkata'
  }).format(date)+' IST';
}

function formatEnquiryEmail(enquiry){
  const items=Array.isArray(enquiry.items)?enquiry.items:[];
  return [
    `Reference: ${enquiry.id}`,
    `Customer: ${enquiry.name}`,
    `Company: ${enquiry.company_name||'Not supplied'}`,
    `Mobile: ${enquiry.phone}`,
    `Email: ${enquiry.email||'Not supplied'}`,
    `Delivery/location: ${enquiry.location}`,
    `Required date: ${enquiry.required_date||'Not supplied'}`,
    `Submitted: ${formatDateTime(enquiry.created_at)}`,
    `Request type: ${enquiry.type}`,
    '',
    'Materials:',
    items.length?items.map(item=>`${item.id} | ${item.name} ${item.size||''} | ${item.qty} ${item.unit}`).join('\n'):'No catalogue items supplied',
    '',
    `Additional requirements: ${enquiry.details||'None supplied'}`
  ].join('\n');
}

function formatBookingEmail(booking,reference,createdAt){
  return [
    `Reference: ${reference}`,
    `Customer: ${booking.name}`,
    `Mobile: ${booking.mobile}`,
    `Service category: ${booking.category}`,
    `Work description: ${booking.description}`,
    `Mumbai area: ${booking.area}`,
    `Service address: ${booking.address}`,
    `Preferred date/time: ${formatDateTime(booking.preferredAt)}`,
    `Request received: ${formatDateTime(createdAt)}`,
    `Work photo attached: ${booking.photo?'Yes':'No'}`,
    '',
    'This is a request only; the appointment is not confirmed until accepted by HM ELECTRICAL.'
  ].join('\n');
}

async function sendOfficeEmail({idempotencyKey,subject,text}){
  const sender=validateSender(c.env('EMAIL_FROM'));
  const apiKey=c.env('HM_EMAIL_PROVIDER_TOKEN');
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      Authorization:'Bearer '+apiKey,
      'Content-Type':'application/json',
      'Idempotency-Key':idempotencyKey
    },
    body:JSON.stringify({from:sender,to:[c.company.email],subject,text}),
    signal:AbortSignal.timeout(5000)
  });
  if(!response.ok)throw new Error(emailErrorCode(response.status));
  const result=await response.json();
  if(typeof result.id!=='string'||!result.id)throw new Error('RESEND_INVALID_RESPONSE');
  return result.id;
}

module.exports={formatDateTime,formatEnquiryEmail,formatBookingEmail,sendOfficeEmail,emailErrorCode,validateSender,emailFailureCode};
