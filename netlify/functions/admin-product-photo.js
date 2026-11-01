'use strict';
const c=require('../../server/core.cjs'),{randomUUID}=require('crypto');
const ids=new Set(require('../../server/catalogue.json').map(p=>p.id));
exports.handler=c.safe(async e=>{
 const user=await c.admin(e);if(e.httpMethod!=='POST')return c.reply(405,{ok:false});
 c.origin(e);const p=c.body(e,4500000);
 if(!ids.has(p.productId)||p.correctProduct!==true||p.rightsConfirmed!==true)c.fail(400,'Choose the exact product and confirm photo ownership/permission and product match.');
 if(!['image/jpeg','image/png','image/webp'].includes(p.type)||typeof p.base64!=='string'||!/^[-A-Za-z0-9+/=]+$/.test(p.base64))c.fail(400,'Use a JPEG, PNG or WebP product image.');
 const input=Buffer.from(p.base64,'base64');if(!input.length||input.length>3*1024*1024)c.fail(400,'Image must be no larger than 3 MB.');
 let image;try{const sharp=require('sharp');const meta=await sharp(input,{limitInputPixels:16000000}).metadata();if(!['jpeg','png','webp'].includes(meta.format))c.fail(400,'Unsupported image format.');image=await sharp(input,{limitInputPixels:16000000}).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).jpeg({quality:86}).toBuffer();}catch{c.fail(400,'The image could not be safely decoded. Use a normal JPEG, PNG or WebP image below 16 megapixels.');}
 const file=p.productId+'/'+randomUUID()+'.jpg',base=c.env('SUPABASE_URL').replace(/\/$/,''),url=base+'/storage/v1/object/public/hm-product-photos/'+file;
 await c.request(base+'/storage/v1/object/hm-product-photos/'+file,{method:'POST',headers:c.serviceRoleHeaders({'Content-Type':'image/jpeg','x-upsert':'false'}),body:image});
 // An append-only new object avoids destroying any previous photo. Existing metadata is merged.
 const saved=await c.db('catalogue_product_metadata?on_conflict=product_id','POST',{product_id:p.productId,product_photo_url:url,photo_rights_source_url:url,photo_rights_verified:true,updated_by:user.id,updated_at:new Date().toISOString()},{Prefer:'resolution=merge-duplicates,return=representation'});
 if(saved.length!==1)c.fail(503,'The photo metadata save was not confirmed.');
 return c.reply(201,{ok:true,url,message:'Product photo saved. Public pages refresh automatically. Private image metadata was removed.'});
});
