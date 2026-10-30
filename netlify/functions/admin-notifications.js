'use strict';

const c=require('../../server/core.cjs');

function enquiryNotification(row){
  const products=Array.isArray(row.items)?row.items.map(item=>`${item.id} ${item.name} ${item.size||''} · ${item.qty} ${item.unit}`).join('; '):'No catalogue items';
  return {
    id:'enquiry:'+row.id,
    kind:'enquiry',
    reference:row.id,
    created_at:row.created_at,
    title:`New material enquiry · ${row.name}`,
    body:[row.phone,row.location,products,row.details].filter(Boolean).join(' · ').slice(0,800)
  };
}

function bookingNotification(row){
  return {
    id:'booking:'+row.id,
    kind:'booking',
    reference:row.reference,
    created_at:row.created_at,
    title:`New service booking · ${row.customer_name}`,
    body:[row.mobile,row.category,row.area,row.preferred_at,row.address,row.description].filter(Boolean).join(' · ').slice(0,800)
  };
}

async function loadSource(path,label){
  try{return {rows:await c.db(path),warning:null};}
  catch(error){
    if(error.message==='A required service endpoint was not found. Check the Supabase URL and apply database/setup.sql.'){
      return {rows:[],warning:`${label} notifications are unavailable because their Supabase endpoint is missing.`};
    }
    throw error;
  }
}

exports.handler=c.safe(async event=>{
  if(event.httpMethod!=='GET')return c.reply(405,{ok:false,message:'Method not allowed.'});
  await c.admin(event);
  const [enquiries,bookings]=await Promise.all([
    loadSource('enquiries?select=id,name,phone,location,created_at,type,details,items&order=created_at.desc&limit=100','Material enquiry'),
    loadSource('service_bookings?select=id,reference,customer_name,mobile,category,description,area,address,preferred_at,created_at&order=created_at.desc&limit=100','Service booking')
  ]);
  const notifications=[...enquiries.rows.map(enquiryNotification),...bookings.rows.map(bookingNotification)]
    .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const warnings=[enquiries.warning,bookings.warning].filter(Boolean);
  return c.reply(200,{ok:true,observedAt:new Date().toISOString(),notifications,warnings});
});
