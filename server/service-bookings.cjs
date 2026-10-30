'use strict';

const categories=[
  'Electrical repairs',
  'Fan installation',
  'Lighting',
  'MCB/DB repair',
  'Wiring',
  'Plumbing repairs',
  'Tap leakage',
  'Pipe fitting',
  'Shop/office maintenance'
];
const bookingStatuses=['New','Assigned','In Progress','Completed','Cancelled'];
const paymentStatuses=['Pending','Partially paid','Paid','Not applicable'];
const technicianAvailability=['Available','Busy','Unavailable'];
const maxPhotoBytes=2*1024*1024;
const photoTypes={
  'image/jpeg':{extension:'jpg',matches:bytes=>bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff},
  'image/png':{extension:'png',matches:bytes=>bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))},
  'image/webp':{extension:'webp',matches:bytes=>bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'}
};

function invalid(message='Please check the booking details and try again.'){
  throw Object.assign(new Error(message),{code:400});
}
function text(value,max,message){
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||!value.trim())invalid(message);
  return value.trim();
}
function validatePhoto(photo){
  if(photo===undefined||photo===null)return null;
  if(!photo||typeof photo!=='object'||typeof photo.type!=='string'||typeof photo.data!=='string')invalid('Choose a valid JPEG, PNG or WebP work photo.');
  const type=photoTypes[photo.type];
  if(!type)invalid('Work photos must be JPEG, PNG or WebP.');
  if(photo.data.length>Math.ceil(maxPhotoBytes/3)*4)invalid('Work photos must be no larger than 2 MB.');
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photo.data))invalid('The selected photo could not be read. Please choose it again.');
  const buffer=Buffer.from(photo.data,'base64');
  if(!buffer.length||buffer.toString('base64')!==photo.data||!type.matches(buffer))invalid('The selected file does not match its photo type. Please choose a JPEG, PNG or WebP image.');
  if(buffer.length>maxPhotoBytes)invalid('Work photos must be no larger than 2 MB.');
  return {buffer,type:photo.type,extension:type.extension};
}
function validateBooking(payload,now=Date.now()){
  if(!payload||typeof payload!=='object')invalid('Please complete the service booking form.');
  if(payload.consent!==true)invalid('Please confirm that HM ELECTRICAL may use these details to respond to your request.');
  const name=text(payload.name,120,'Enter your name (up to 120 characters).');
  const mobile=text(payload.mobile,20,'Enter a valid mobile number with 10 to 15 digits.');
  const category=text(payload.category,60,'Choose a service category from the list.');
  const description=text(payload.description,2000,'Describe the work required (up to 2,000 characters).');
  const area=text(payload.area,100,'Enter your Mumbai area (up to 100 characters).');
  const address=text(payload.address,300,'Enter the service address (up to 300 characters).');
  if(!/^[+\d() .-]+$/.test(mobile)||!/^\d{10,15}$/.test(mobile.replace(/\D/g,'')))invalid('Enter a valid mobile number with 10 to 15 digits.');
  if(!categories.includes(category))invalid('Choose a service category from the list.');
  const preferredAt=text(payload.preferredAt,30,'Choose a preferred date and time.');
  const timestamp=Date.parse(preferredAt);
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(preferredAt)||!Number.isFinite(timestamp)||new Date(timestamp).toISOString()!==preferredAt||timestamp<now+4*60*1000)invalid('Choose a preferred date and time at least five minutes from now, then submit again.');
  return {name,mobile,category,description,area,address,preferredAt,photo:validatePhoto(payload.photo)};
}
function validateTechnician(payload){
  if(!payload||typeof payload!=='object')invalid('Please check the technician details and try again.');
  const name=text(payload.name,120,'Enter a technician name (up to 120 characters).');
  const mobile=text(payload.mobile,20,'Enter a valid technician mobile number.');
  const trade=text(payload.trade,100,'Enter the technician trade (up to 100 characters).');
  if(!/^[+\d() .-]+$/.test(mobile)||!/^\d{10,15}$/.test(mobile.replace(/\D/g,'')))invalid('Enter a valid technician mobile number.');
  return {name,mobile,trade};
}
function validateCharge(value){
  if(value===null||value==='')return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>10000000)invalid('Enter a charge between ₹0 and ₹10,000,000.');
  return Math.round(value*100)/100;
}

module.exports={categories,bookingStatuses,paymentStatuses,technicianAvailability,maxPhotoBytes,validateBooking,validateTechnician,validateCharge};
