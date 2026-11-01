'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {categories,bookingStatuses,paymentStatuses,validateBooking,validateTechnician,validateCharge,maxPhotoBytes}=require('../server/service-bookings.cjs');
const core=require('../server/core.cjs');
const bookingFunction=require('../netlify/functions/service-booking.js');
const adminServiceBookingsFunction=require('../netlify/functions/admin-service-bookings.js');
const enquiryFunction=require('../netlify/functions/enquiry.js');
const adminSessionFunction=require('../netlify/functions/admin-session.js');
const notifyFunction=require('../netlify/functions/notify.js');
const adminNotificationsFunction=require('../netlify/functions/admin-notifications.js');
const catalogue=require('../server/catalogue.json');
const {emailErrorCode,validateSender}=require('../server/email-notifications.cjs');

const fixedNow=Date.parse('2026-10-29T08:00:30.000Z');
const future=new Date(fixedNow+60*60*1000).toISOString();
const validBooking={
  consent:true,name:'Customer',mobile:'+91 80855 60156',category:categories[0],
  description:'Repair a switchboard',area:'Sion',address:'Mumbai address',preferredAt:future
};

test('exposes the requested booking categories and admin status values',()=>{
  assert.equal(categories.length,9);
  assert.deepEqual(bookingStatuses,['New','Assigned','In Progress','Completed','Cancelled']);
  assert.deepEqual(paymentStatuses,['Pending','Partially paid','Paid','Not applicable']);
});

test('validates RFQ company and required-date fields without breaking older clients',()=>{
  const product=catalogue[0];
  const base={
    requestId:'00000000-0000-4000-8000-000000000401',
    name:'Business contact',phone:'8085550156',email:'',location:'Mumbai',
    type:'Material order request',details:'Cable quotation',consent:true,
    items:[{id:product.id,qty:2}]
  };
  const current=core.validate({...base,companyName:'  Example Works  ',requiredDate:'2026-12-15'});
  assert.equal(current.company_name,'Example Works');
  assert.equal(current.required_date,'2026-12-15');
  assert.equal(current.rfq_fields_requested,true);
  assert.throws(()=>core.validate({...base,requiredDate:'2026-02-31'}),{code:400,message:'Required date must be a valid calendar date.'});
  assert.throws(()=>core.validate({...base,requiredDate:'2020-01-01'}),{code:400,message:'Required date cannot be in the past.'});
  const legacy=core.validate(base);
  assert.equal(legacy.company_name,'');
  assert.equal(legacy.required_date,null);
  assert.equal(legacy.rfq_fields_requested,false);
});

test('validates booking fields and normalizes whitespace',()=>{
  const result=validateBooking({...validBooking,name:' Customer '},fixedNow);
  assert.equal(result.name,'Customer');
  assert.equal(result.preferredAt,future);
  assert.equal(result.photo,null);
});

test('rejects invalid fields and reports actionable validation messages',()=>{
  for(const payload of [
    {...validBooking,consent:false},
    {...validBooking,mobile:'not a phone'},
    {...validBooking,category:'Invented service'},
    {...validBooking,description:'x'.repeat(2001)}
  ])assert.throws(()=>validateBooking(payload,fixedNow),{code:400});
  assert.throws(()=>validateBooking({...validBooking,consent:false},fixedNow),{message:/confirm that HM ELECTRICAL/});
  assert.throws(()=>validateBooking({...validBooking,mobile:'not a phone'},fixedNow),{message:/valid mobile number/});
  assert.ok(maxPhotoBytes<=2*1024*1024);
});

test('requires a date at least five minutes ahead and explains a stale choice',()=>{
  const sameMinute=new Date(fixedNow-fixedNow%60000).toISOString();
  assert.throws(()=>validateBooking({...validBooking,preferredAt:sameMinute},fixedNow),{code:400,message:/at least five minutes from now/});
  const safeMinimum=new Date(Math.ceil((fixedNow+5*60*1000)/60000)*60000).toISOString();
  assert.equal(validateBooking({...validBooking,preferredAt:safeMinimum},fixedNow).preferredAt,safeMinimum);
});

test('accepts JPEG, PNG and WebP only with matching signatures',()=>{
  const validPhotos=[
    ['image/jpeg',Buffer.from([0xff,0xd8,0xff,0x00])],
    ['image/png',Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00])],
    ['image/webp',Buffer.from('RIFF0000WEBP','ascii')]
  ];
  for(const [type,bytes] of validPhotos){
    const result=validateBooking({...validBooking,photo:{type,data:bytes.toString('base64')}},fixedNow);
    assert.equal(result.photo.type,type);
  }
  const jpeg=validPhotos[0][1];
  assert.throws(()=>validateBooking({...validBooking,photo:{type:'image/png',data:jpeg.toString('base64')}},fixedNow),{code:400,message:/does not match its photo type/});
});

test('rejects photos exceeding the 2 MB limit with a readable message',()=>{
  const maximum=Buffer.alloc(maxPhotoBytes);
  maximum.set([0xff,0xd8,0xff]);
  assert.equal(validateBooking({...validBooking,photo:{type:'image/jpeg',data:maximum.toString('base64')}},fixedNow).photo.buffer.length,maxPhotoBytes);
  const oversized=Buffer.alloc(maxPhotoBytes+1);
  oversized.set([0xff,0xd8,0xff]);
  assert.throws(()=>validateBooking({...validBooking,photo:{type:'image/jpeg',data:oversized.toString('base64')}},fixedNow),{code:400,message:/no larger than 2 MB/});
});

test('saves valid bookings, emails the office through a mock, and uploads optional photos',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RATE_LIMIT_SECRET','SITE_ORIGIN','HM_EMAIL_PROVIDER_TOKEN','EMAIL_FROM'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch;
  const requests=[];
  let failEmail=false;
  process.env.SUPABASE_URL='https://service-booking-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-not-a-real-key';
  process.env.RATE_LIMIT_SECRET='test-only-not-a-real-secret';
  process.env.SITE_ORIGIN='http://localhost:8888';
  process.env.HM_EMAIL_PROVIDER_TOKEN='test-only-resend-key';
  process.env.EMAIL_FROM='HM ELECTRICAL <notifications@example.com>';
  global.fetch=async(url,options={})=>{
    const target=String(url);
    requests.push({target,options});
    if(target.endsWith('/rpc/hm_rate'))return new Response('true',{status:200});
    if(target==='https://api.resend.com/emails')return failEmail?new Response('{}',{status:503}):new Response(JSON.stringify({id:'re_test_booking'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/storage/v1/object/hm-service-booking-photos/'))return new Response('{}',{status:200});
    if(target.includes('/rest/v1/service_bookings?id=eq.')&&options.method==='PATCH')return new Response(JSON.stringify([{id:target.split('eq.')[1]}]),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.endsWith('/rest/v1/service_bookings')){
      const body=JSON.parse(options.body);
      return new Response(JSON.stringify([{id:body.id}]),{status:201,headers:{'Content-Type':'application/json'}});
    }
    throw new Error('Unexpected mocked fetch target.');
  };
  try{
    const photos=[
      ['image/jpeg',Buffer.from([0xff,0xd8,0xff,0x01])],
      ['image/png',Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x01])],
      ['image/webp',Buffer.from('RIFF0000WEBP','ascii')]
    ];
    for(const [type,bytes] of [[null,null],...photos]){
      const payload={...validBooking,preferredAt:new Date(Date.now()+60*60*1000).toISOString()};
      if(type)payload.photo={type,data:bytes.toString('base64')};
      const response=await bookingFunction.handler({
        httpMethod:'POST',
        headers:{'content-type':'application/json',origin:'http://localhost:8888','x-nf-client-connection-ip':'127.0.0.1'},
        body:JSON.stringify(payload)
      });
      assert.equal(response.statusCode,201,response.body);
      assert.equal(JSON.parse(response.body).ok,true);
    }
    const uploads=requests.filter(item=>item.target.includes('/storage/v1/object/hm-service-booking-photos/'));
    const inserts=requests.filter(item=>item.target.endsWith('/rest/v1/service_bookings'));
    assert.equal(uploads.length,3);
    assert.equal(inserts.length,4);
    assert.ok(inserts.every(item=>JSON.parse(item.options.body).email_status==='pending'));
    const emailRequests=requests.filter(item=>item.target==='https://api.resend.com/emails');
    assert.equal(emailRequests.length,4);
    for(const request of emailRequests){
      const email=JSON.parse(request.options.body);
      assert.deepEqual(email.to,['hmelectrical06@gmail.com']);
      assert.match(email.text,/Customer: Customer/);
      assert.match(email.text,/Mobile: \+91 80855 60156/);
      assert.match(email.text,/Service address: Mumbai address/);
      assert.match(email.text,/Preferred date\/time:/);
      assert.match(email.text,/Reference: HM-SVC-/);
      assert.equal(request.options.headers.Authorization,'Bearer test-only-resend-key');
    }
    for(const [index,[type,bytes]] of photos.entries()){
      assert.equal(uploads[index].options.method,'POST');
      assert.equal(uploads[index].options.headers['Content-Type'],type);
      assert.deepEqual(Buffer.from(uploads[index].options.body),bytes);
      assert.ok(JSON.parse(inserts[index+1].options.body).photo_path.endsWith(index===0?'.jpg':index===1?'.png':'.webp'));
    }
    assert.equal(JSON.parse(inserts[0].options.body).photo_path,null);
    failEmail=true;
    const failedEmailResponse=await bookingFunction.handler({
      httpMethod:'POST',
      headers:{'content-type':'application/json',origin:'http://localhost:8888','x-nf-client-connection-ip':'127.0.0.1'},
      body:JSON.stringify({...validBooking,preferredAt:new Date(Date.now()+60*60*1000).toISOString()})
    });
    assert.equal(failedEmailResponse.statusCode,201,'Email failure must not undo the saved booking.');
    assert.equal(requests.filter(item=>item.target.endsWith('/rest/v1/service_bookings')).length,5);
    assert.equal(requests.filter(item=>item.target.includes('/rest/v1/service_bookings?id=eq.')&&item.options.method==='PATCH').length,4);
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('does not save after a photo upload failure and removes an uploaded photo when booking persistence fails',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RATE_LIMIT_SECRET','SITE_ORIGIN'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch,requests=[];
  let failUpload=true,failInsert=false;
  Object.assign(process.env,{
    SUPABASE_URL:'https://service-booking-cleanup-test.invalid',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-server-key',
    RATE_LIMIT_SECRET:'test-only-rate-secret',
    SITE_ORIGIN:'http://localhost:8888'
  });
  global.fetch=async(url,options={})=>{
    const target=String(url);
    requests.push({target,options});
    if(target.endsWith('/rpc/hm_rate'))return new Response('true',{status:200});
    if(target.includes('/storage/v1/object/hm-service-booking-photos/')){
      if(options.method==='POST'&&failUpload)return new Response('{}',{status:503});
      return new Response('{}',{status:200});
    }
    if(target.endsWith('/rest/v1/service_bookings')){
      return failInsert
        ?new Response('{}',{status:400})
        :new Response(JSON.stringify([{id:JSON.parse(options.body).id}]),{status:201,headers:{'Content-Type':'application/json'}});
    }
    throw new Error('Unexpected mocked fetch target.');
  };
  try{
    const payload={...validBooking,preferredAt:new Date(Date.now()+60*60*1000).toISOString(),photo:{
      type:'image/jpeg',
      data:Buffer.from([0xff,0xd8,0xff,0x01]).toString('base64')
    }};
    const event={
      httpMethod:'POST',
      headers:{'content-type':'application/json',origin:'http://localhost:8888','x-nf-client-connection-ip':'127.0.0.1'},
      body:JSON.stringify(payload)
    };
    const failedUpload=await bookingFunction.handler(event);
    assert.equal(failedUpload.statusCode,503);
    assert.equal(requests.filter(item=>item.target.endsWith('/rest/v1/service_bookings')).length,0);
    assert.equal(requests.filter(item=>item.target.includes('/storage/v1/object/hm-service-booking-photos/')).length,1);

    requests.length=0;
    failUpload=false;
    failInsert=true;
    const failedInsert=await bookingFunction.handler(event);
    assert.equal(failedInsert.statusCode,503);
    const storage=requests.filter(item=>item.target.includes('/storage/v1/object/hm-service-booking-photos/'));
    assert.deepEqual(storage.map(item=>item.options.method),['POST','DELETE']);
    assert.equal(requests.filter(item=>item.target.endsWith('/rest/v1/service_bookings')).length,1);
    assert.equal(storage[1].options.headers['Content-Type'],undefined);
    assert.equal(storage[1].options.headers.Authorization,undefined);
    assert.equal(storage[1].options.headers.apikey,'test-only-server-key');
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('saves material enquiries and sends Resend emails best-effort through mocks',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RATE_LIMIT_SECRET','SITE_ORIGIN','HM_EMAIL_PROVIDER_TOKEN','EMAIL_FROM'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch,requests=[];
  let failEmail=false,savedRequest=null;
  Object.assign(process.env,{
    SUPABASE_URL:'https://enquiry-test.invalid',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-not-a-real-key',
    RATE_LIMIT_SECRET:'test-only-not-a-real-secret',
    SITE_ORIGIN:'http://localhost:8888',
    HM_EMAIL_PROVIDER_TOKEN:'test-only-resend-key',
    EMAIL_FROM:'HM ELECTRICAL <notifications@example.com>'
  });
  const product=catalogue[0],payload={
    requestId:'00000000-0000-4000-8000-000000000001',
    name:'Enquiry Customer',companyName:'Example Works',phone:'+91 80855 60156',email:'customer@example.test',
    location:'Sion, Mumbai',requiredDate:'2026-12-15',details:'Please quote for the site.',type:'Material order request',
    consent:true,items:[{id:product.id,qty:4}]
  };
  global.fetch=async(url,options={})=>{
    const target=String(url);
    requests.push({target,options});
    if(target.includes('/rest/v1/enquiries?select=company_name,required_date&limit=0'))return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    if(target.endsWith('/rpc/hm_rate'))return new Response('true',{status:200});
    if(target.endsWith('/rpc/hm_save')){
      const input=JSON.parse(options.body);
      savedRequest=input.p_request;
      return new Response(JSON.stringify([{
        id:'00000000-0000-4000-8000-000000000101',
        fingerprint:input.p_fingerprint,
        company_name:input.p_request.company_name,
        required_date:input.p_request.required_date,
        email_status:'pending'
      }]),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(target==='https://api.resend.com/emails')return failEmail?new Response('{}',{status:503}):new Response(JSON.stringify({id:'re_test_enquiry'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/rest/v1/enquiries?id=eq.00000000-0000-4000-8000-000000000101')&&options.method==='PATCH')return new Response(JSON.stringify([{id:'00000000-0000-4000-8000-000000000101'}]),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/rest/v1/enquiries?id=eq.00000000-0000-4000-8000-000000000101'))return new Response(JSON.stringify([{
      id:'00000000-0000-4000-8000-000000000101',
      name:savedRequest.name,company_name:savedRequest.company_name,phone:savedRequest.phone,email:savedRequest.email,
      location:savedRequest.location,required_date:savedRequest.required_date,created_at:'2026-10-29T08:00:00.000Z',
      type:savedRequest.type,details:savedRequest.details,items:savedRequest.items
    }]),{status:200,headers:{'Content-Type':'application/json'}});
    throw new Error('Unexpected mocked fetch target.');
  };
  try{
    const requestEvent={
      httpMethod:'POST',
      headers:{'content-type':'application/json',origin:'http://localhost:8888','x-nf-client-connection-ip':'127.0.0.1'},
      body:JSON.stringify(payload)
    };
    const response=await enquiryFunction.handler(requestEvent);
    assert.equal(response.statusCode,200,response.body);
    assert.equal(JSON.parse(response.body).emailStatus,'accepted');
    const email=JSON.parse(requests.find(item=>item.target==='https://api.resend.com/emails').options.body);
    assert.deepEqual(email.to,['hmelectrical06@gmail.com']);
    assert.match(email.text,/Enquiry Customer/);
    assert.match(email.text,/Company: Example Works/);
    assert.match(email.text,/Required date: 2026-12-15/);
    assert.match(email.text,/Sion, Mumbai/);
    assert.match(email.text,new RegExp(product.id));
    assert.match(email.text,/4/);

    requests.length=0;
    failEmail=true;
    const failedResponse=await enquiryFunction.handler({
      ...requestEvent,
      body:JSON.stringify({...payload,requestId:'00000000-0000-4000-8000-000000000002'})
    });
    assert.equal(failedResponse.statusCode,200,'Email failure must not prevent a saved enquiry response.');
    assert.equal(JSON.parse(failedResponse.body).emailStatus,'pending');
    assert.ok(requests.some(item=>item.target.endsWith('/rpc/hm_save')));
    assert.equal(requests.filter(item=>item.target.startsWith('https://api.resend.com/')).length,1);
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('RFQ submission fails closed when the additive database migration is missing',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RATE_LIMIT_SECRET','SITE_ORIGIN'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch,requests=[];
  Object.assign(process.env,{
    SUPABASE_URL:'https://enquiry-schema-test.invalid',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-not-a-real-key',
    RATE_LIMIT_SECRET:'test-only-not-a-real-secret',
    SITE_ORIGIN:'http://localhost:8888'
  });
  global.fetch=async(url,options={})=>{
    requests.push({url:String(url),options});
    return new Response(JSON.stringify({message:'column enquiries.company_name does not exist'}),{
      status:400,headers:{'Content-Type':'application/json'}
    });
  };
  try{
    const response=await enquiryFunction.handler({
      httpMethod:'POST',
      headers:{'content-type':'application/json',origin:'http://localhost:8888'},
      body:JSON.stringify({
        requestId:'00000000-0000-4000-8000-000000000402',
        name:'Business contact',companyName:'Example Works',phone:'8085550156',
        email:'',location:'Mumbai',requiredDate:'2026-12-15',details:'Cable quotation',
        type:'Material order request',consent:true,items:[{id:catalogue[0].id,qty:2}]
      })
    });
    assert.equal(response.statusCode,503);
    assert.match(JSON.parse(response.body).message,/Apply the additive RFQ migration/);
    assert.equal(requests.length,1);
    assert.match(requests[0].url,/select=company_name,required_date/);
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('admin notifications are authenticated and preserve enquiry alerts if booking schema is missing',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_USER_IDS'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch;
  Object.assign(process.env,{
    SUPABASE_URL:'https://admin-notifications-test.invalid',
    SUPABASE_ANON_KEY:'test-only-anon-key',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',
    ADMIN_USER_IDS:'00000000-0000-4000-8000-000000000201'
  });
  global.fetch=async(url,options={})=>{
    const target=String(url);
    if(target.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000201'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/rest/v1/enquiries?'))return new Response(JSON.stringify([{
      id:'00000000-0000-4000-8000-000000000301',
      name:'Admin test customer',phone:'8085550156',location:'Sion',
      created_at:'2026-10-29T08:00:00.000Z',type:'Material order request',
      details:'Cable quote',items:[{id:'P-1',name:'Test cable',size:'2.5 sq mm',qty:4,unit:'m'}]
    }]),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/rest/v1/service_bookings?'))return new Response(JSON.stringify({message:'Table missing'}),{status:404,headers:{'Content-Type':'application/json'}});
    throw new Error('Unexpected mocked fetch target.');
  };
  try{
    const response=await adminNotificationsFunction.handler({
      httpMethod:'GET',
      headers:{cookie:'__Host-hm_admin=admin-session-token'}
    });
    assert.equal(response.statusCode,200,response.body);
    const result=JSON.parse(response.body);
    assert.equal(result.notifications.length,1);
    assert.equal(result.notifications[0].kind,'enquiry');
    assert.match(result.notifications[0].body,/8085550156/);
    assert.equal(result.warnings.length,1);
    assert.match(result.warnings[0],/Service booking notifications are unavailable/);
    const unauthorized=await adminNotificationsFunction.handler({httpMethod:'GET',headers:{}});
    assert.equal(unauthorized.statusCode,401);
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('classifies Resend failures safely and validates EMAIL_FROM syntax',()=>{
  assert.equal(emailErrorCode(401),'RESEND_CREDENTIAL_REJECTED');
  assert.equal(emailErrorCode(403),'RESEND_SENDER_OR_ACCOUNT_FORBIDDEN');
  assert.equal(emailErrorCode(422),'RESEND_SENDER_OR_REQUEST_REJECTED');
  assert.equal(emailErrorCode(429),'RESEND_RATE_LIMITED');
  assert.equal(emailErrorCode(503),'RESEND_TEMPORARILY_UNAVAILABLE');
  assert.equal(validateSender('HM ELECTRICAL <notify@example.com>'),'HM ELECTRICAL <notify@example.com>');
  assert.equal(validateSender('notify@example.com'),'notify@example.com');
  assert.throws(()=>validateSender('HM ELECTRICAL<notify@example.com'),{message:'EMAIL_FROM_INVALID'});
  assert.throws(()=>validateSender('notify@example.com>'),{message:'EMAIL_FROM_INVALID'});
  assert.throws(()=>validateSender('HM ELECTRICAL <notify@example.com>\r\nBcc: other@example.com'),{message:'EMAIL_FROM_INVALID'});
  assert.throws(()=>validateSender('not-an-email'),{message:'EMAIL_FROM_INVALID'});
});

test('normalizes invalid thrown status codes and validates every response status',async()=>{
  const invalidError=core.safe(async()=>{throw Object.assign(new Error('Private transport detail'),{code:'ENOTFOUND'});});
  const invalidResponse=await invalidError({});
  assert.equal(invalidResponse.statusCode,503);
  assert.equal(Number.isInteger(invalidResponse.statusCode),true);
  assert.doesNotMatch(invalidResponse.body,/Private transport detail|ENOTFOUND/);

  const validError=core.safe(async()=>{throw Object.assign(new Error('Please sign in.'),{code:401});});
  const validResponse=await validError({});
  assert.equal(validResponse.statusCode,401);
  assert.equal(Number.isInteger(validResponse.statusCode),true);

  for(const statusCode of [99,600,NaN,'503']){
    const response=core.reply(statusCode,{ok:true});
    assert.equal(response.statusCode,500);
    assert.equal(Number.isInteger(response.statusCode),true);
    assert.match(response.body,/Service unavailable/);
  }
  assert.equal(core.validStatusCode(100),true);
  assert.equal(core.validStatusCode(599),true);
  assert.equal(core.validStatusCode(99),false);
  assert.equal(core.validStatusCode(600),false);
});

test('admin session and notification handlers return valid status on network errors',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','ADMIN_USER_IDS'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch;
  Object.assign(process.env,{
    SUPABASE_URL:'https://admin-status-test.invalid',
    SUPABASE_ANON_KEY:'test-only-anon-key',
    ADMIN_USER_IDS:'00000000-0000-4000-8000-000000000501'
  });
  global.fetch=async()=>{throw Object.assign(new Error('Private network detail'),{code:'ENOTFOUND'});};
  const event={httpMethod:'GET',headers:{cookie:'__Host-hm_admin=session-token'}};
  try{
    for(const handler of [adminSessionFunction.handler,adminNotificationsFunction.handler]){
      const response=await handler(event);
      assert.equal(Number.isInteger(response.statusCode),true);
      assert.ok(response.statusCode>=100&&response.statusCode<=599);
      assert.equal(response.statusCode,503);
      assert.doesNotMatch(response.body,/Private network detail|ENOTFOUND/);
    }
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('scheduled notifier retries pending service-booking email through mocks',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','HM_EMAIL_PROVIDER_TOKEN','EMAIL_FROM'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch,requests=[];
  Object.assign(process.env,{
    SUPABASE_URL:'https://notify-test.invalid',
    SUPABASE_SERVICE_ROLE_KEY:'test-only-not-a-real-key',
    HM_EMAIL_PROVIDER_TOKEN:'test-only-resend-key',
    EMAIL_FROM:'HM ELECTRICAL <notifications@example.com>'
  });
  global.fetch=async(url,options={})=>{
    const target=String(url);
    requests.push({target,options});
    if(target.endsWith('/rest/v1/rpc/hm_claim_notifications'))return new Response('[]',{status:200});
    if(target.includes('/rest/v1/service_bookings?')&&target.includes('email_status=eq.pending'))return new Response(JSON.stringify([{
      id:'00000000-0000-4000-8000-000000000401',reference:'HM-SVC-20261029-TEST01',
      customer_name:'Retry Customer',mobile:'8085550156',category:'Lighting',
      description:'Install a light',area:'Sion',address:'Mumbai address',
      preferred_at:'2026-10-30T10:00:00.000Z',created_at:'2026-10-29T08:00:00.000Z'
    }]),{status:200,headers:{'Content-Type':'application/json'}});
    if(target==='https://api.resend.com/emails')return new Response(JSON.stringify({id:'re_retry_booking'}),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/rest/v1/service_bookings?id=eq.')&&options.method==='PATCH')return new Response(JSON.stringify([{id:'00000000-0000-4000-8000-000000000401'}]),{status:200,headers:{'Content-Type':'application/json'}});
    throw new Error('Unexpected mocked fetch target.');
  };
  try{
    const response=await notifyFunction.handler();
    assert.equal(response.statusCode,200);
    assert.deepEqual(JSON.parse(response.body),{enquiriesAccepted:0,bookingsAccepted:1});
    const emailRequest=requests.find(item=>item.target==='https://api.resend.com/emails');
    assert.equal(emailRequest.options.headers['Idempotency-Key'],'hm-service-00000000-0000-4000-8000-000000000401');
    const email=JSON.parse(emailRequest.options.body);
    assert.deepEqual(email.to,['hmelectrical06@gmail.com']);
    assert.match(email.text,/Retry Customer/);
    assert.ok(requests.some(item=>item.target.includes('/rest/v1/service_bookings?id=eq.')&&item.options.method==='PATCH'));
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('validates technician fields and non-negative charges',()=>{
  assert.deepEqual(validateTechnician({name:'Tech',mobile:'8085550156',trade:'Electrical'}),{name:'Tech',mobile:'8085550156',trade:'Electrical'});
  assert.equal(validateCharge(0),0);
  assert.equal(validateCharge(102.345),102.35);
  assert.equal(validateCharge(null),null);
  assert.throws(()=>validateCharge(-1),{code:400,message:/charge between/});
});

test('Add Technician uses Supabase secret keys as apikey only and preserves admin session auth',async()=>{
  const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_USER_IDS','SITE_ORIGIN'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch,requests=[];
  const adminId='00000000-0000-4000-8000-000000000501';
  const technicianId='00000000-0000-4000-8000-000000000502';
  Object.assign(process.env,{
    SUPABASE_URL:'https://technician-test.supabase.co',
    SUPABASE_ANON_KEY:'sb_publishable_test-key',
    SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test-key',
    ADMIN_USER_IDS:adminId,
    SITE_ORIGIN:'https://hmelectricalb2b.com'
  });
  global.fetch=async(url,options={})=>{
    const target=String(url);
    requests.push({target,options});
    if(target.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:adminId}),{status:200,headers:{'Content-Type':'application/json'}});
    if(target.includes('/rest/v1/service_technicians?select=id'))return new Response('',{status:206,headers:{'Content-Range':'0-0/0'}});
    if(target.endsWith('/rest/v1/service_technicians')&&options.method==='POST')return new Response(JSON.stringify([{id:technicianId}]),{status:201,headers:{'Content-Type':'application/json'}});
    throw new Error('Unexpected mocked fetch target.');
  };
  try{
    const response=await adminServiceBookingsFunction.handler({
      httpMethod:'POST',
      headers:{
        cookie:'__Host-hm_admin=admin-session-token',
        origin:'https://hmelectricalb2b.com',
        'content-type':'application/json'
      },
      body:JSON.stringify({action:'create-technician',name:'Test Technician',mobile:'8085550156',trade:'Electrical'})
    });
    assert.equal(response.statusCode,201);
    const authRequest=requests.find(item=>item.target.endsWith('/auth/v1/user'));
    assert.equal(authRequest.options.headers.apikey,'sb_publishable_test-key');
    assert.equal(authRequest.options.headers.Authorization,'Bearer admin-session-token');
    const databaseRequests=requests.filter(item=>item.target.includes('/rest/v1/service_technicians'));
    assert.equal(databaseRequests.length,2);
    for(const request of databaseRequests){
      assert.equal(request.options.headers.apikey,'sb_secret_test-key');
      assert.equal(request.options.headers.Authorization,undefined);
    }
  }finally{
    global.fetch=originalFetch;
    for(const key of keys){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
});

test('legacy Supabase service-role JWT remains in both server headers',()=>{
  const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY='header.payload.signature';
  try{
    assert.deepEqual(core.serviceRoleHeaders(),{
      apikey:'header.payload.signature',
      Authorization:'Bearer header.payload.signature'
    });
  }finally{
    if(previous===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;
  }
});
