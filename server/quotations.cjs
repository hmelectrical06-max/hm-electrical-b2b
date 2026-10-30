'use strict';

const {createHash}=require('node:crypto');
const allProducts=require('./catalogue.json');
const products=allProducts.filter(product=>!String(product.sourceCode||'').startsWith('WORK-'));
const productsById=new Map(products.map(product=>[product.id,product]));
const taxModes=['none','intra_state','inter_state'];
const textFields={
  customer_name:120,company_name:160,mobile:20,email:254,customer_gstin:15,
  billing_address:800,shipping_address:800,place_of_supply:100,payment_terms:500,
  delivery_terms:500,warranty_terms:500,notes:2000
};
const amountLimit=999999999999;

function round2(value){return Math.round((value+Number.EPSILON)*100)/100;}
function cleanText(value,max,label,required=false){
  if(typeof value!=='string')throw new Error(`${label} must be text.`);
  const cleaned=value.trim();
  if((required&&!cleaned)||cleaned.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(cleaned)){
    throw new Error(`${label} is required and must be ${max} characters or fewer.`);
  }
  return cleaned||null;
}
function numeric(value,label,{min=0,max=amountLimit,required=true}={}){
  if(value===null||value===undefined||value===''){
    if(!required)return null;
    throw new Error(`${label} is required.`);
  }
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max){
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}
function validDate(value,label){
  if(value===null||value===undefined||value==='')return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)){
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  const time=Date.parse(`${value}T00:00:00.000Z`);
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value){
    throw new Error(`${label} must be a valid calendar date.`);
  }
  return value;
}
function verifiedSource(value,label){
  if(typeof value!=='string'||!value.trim())return null;
  let url;
  try{url=new URL(value.trim());}catch{}
  if(!url||url.protocol!=='https:')throw new Error(`${label} must be a valid HTTPS URL.`);
  return url.toString();
}
function calculateTotals(items,taxMode,freight,otherCharges){
  let subtotal=0,discountTotal=0,taxableTotal=0,cgstAmount=0,sgstAmount=0,igstAmount=0;
  for(const item of items){
    const gross=round2(item.quantity*item.unit_rate);
    if(gross>amountLimit)throw new Error('Quotation line amount exceeds the supported limit.');
    if(item.discount_amount>gross)throw new Error('A line discount cannot exceed its item amount.');
    const taxable=round2(gross-item.discount_amount);
    const tax=round2(taxable*(item.tax_rate||0)/100);
    item.taxable_amount=taxable;
    item.tax_amount=tax;
    subtotal=round2(subtotal+gross);
    discountTotal=round2(discountTotal+item.discount_amount);
    taxableTotal=round2(taxableTotal+taxable);
    if(taxMode==='intra_state'){
      const cgst=round2(tax/2);
      cgstAmount=round2(cgstAmount+cgst);
      sgstAmount=round2(sgstAmount+tax-cgst);
    }else if(taxMode==='inter_state')igstAmount=round2(igstAmount+tax);
  }
  const grandTotal=round2(taxableTotal+cgstAmount+sgstAmount+igstAmount+freight+otherCharges);
  if(grandTotal>amountLimit)throw new Error('Quotation total exceeds the supported limit.');
  return {subtotal,discount_total:discountTotal,taxable_total:taxableTotal,cgst_amount:cgstAmount,sgst_amount:sgstAmount,igst_amount:igstAmount,freight,other_charges:otherCharges,grand_total:grandTotal};
}
function validateQuotation(payload,taxMetadata=new Map()){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Invalid quotation details.');
  const quote={};
  for(const [field,max] of Object.entries(textFields)){
    quote[field]=cleanText(payload[field]??'',max,field.replaceAll('_',' '),field==='customer_name');
  }
  if(quote.mobile&&!/^[+\d() .-]+$/.test(quote.mobile)||quote.mobile&&!/^\d{10,15}$/.test(quote.mobile.replace(/\D/g,''))){
    throw new Error('Enter a valid customer mobile number.');
  }
  if(quote.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.email))throw new Error('Enter a valid customer email address.');
  if(quote.customer_gstin&&!/^[0-9A-Z]{15}$/.test(quote.customer_gstin.toUpperCase())){
    throw new Error('Customer GSTIN must contain 15 letters or numbers.');
  }
  quote.customer_gstin=quote.customer_gstin?.toUpperCase()||null;
  const taxMode=payload.tax_mode;
  if(!taxModes.includes(taxMode))throw new Error('Select a GST calculation mode.');
  if(taxMode!=='none'&&!quote.place_of_supply)throw new Error('Place of supply is required when GST is applied.');
  quote.tax_mode=taxMode;
  quote.source_enquiry_id=payload.source_enquiry_id===null||payload.source_enquiry_id===''||payload.source_enquiry_id===undefined?null:String(payload.source_enquiry_id);
  if(quote.source_enquiry_id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(quote.source_enquiry_id)){
    throw new Error('Source enquiry reference is invalid.');
  }
  quote.valid_until=validDate(payload.valid_until,'Quotation validity date');
  const freight=numeric(payload.freight??0,'Freight',{max:amountLimit});
  const otherCharges=numeric(payload.other_charges??0,'Other charges',{max:amountLimit});
  if(!Array.isArray(payload.items)||payload.items.length<1||payload.items.length>100){
    throw new Error('Add between 1 and 100 quotation lines.');
  }
  quote.items=payload.items.map((row,index)=>{
    if(!row||typeof row!=='object'||Array.isArray(row))throw new Error(`Quotation line ${index+1} is invalid.`);
    const itemType=row.item_type;
    if(!['product','service'].includes(itemType))throw new Error(`Quotation line ${index+1} must be a product or custom service.`);
    let product=null,productId=null,productCode='-',description,unit,hsnSac=null,taxRate=null,taxSourceUrl=null,taxVerifiedAt=null;
    if(itemType==='product'){
      productId=typeof row.product_id==='string'?row.product_id.trim():'';
      product=productsById.get(productId);
      if(!product)throw new Error(`Quotation line ${index+1} does not match an existing material catalogue product.`);
      productCode=product.sourceCode||product.id;
      description=`${product.name} · ${product.size}`;
      unit=product.unit;
      if(taxMode!=='none'){
        const verified=taxMetadata.get(productId);
        if(!verified||verified.gst_rate===null||!verified.tax_source_url||!verified.tax_verified_at){
          throw new Error(`Quotation line ${index+1} has no verified GST rate and source. Keep tax mode as No GST or verify catalogue tax metadata first.`);
        }
        taxRate=numeric(Number(verified.gst_rate),`Verified GST rate for ${productCode}`,{max:100});
        taxSourceUrl=verified.tax_source_url;
        taxVerifiedAt=verified.tax_verified_at;
        hsnSac=verified.hsn||null;
      }
    }else{
      description=cleanText(row.description,300,`Quotation line ${index+1} description`,true);
      unit=cleanText(row.unit,40,`Quotation line ${index+1} unit`,true);
      if(taxMode!=='none'){
        taxRate=numeric(row.tax_rate,`Quotation line ${index+1} GST rate`,{max:100});
        taxSourceUrl=verifiedSource(row.tax_source_url,`Quotation line ${index+1} tax source`);
        taxVerifiedAt=validDate(row.tax_verified_at,`Quotation line ${index+1} tax verification date`);
        if(!taxSourceUrl||!taxVerifiedAt)throw new Error(`Quotation line ${index+1} needs a verified tax source URL and date.`);
      }
    }
    const quantity=numeric(row.quantity,`Quotation line ${index+1} quantity`,{min:0.001,max:1000000});
    if(Math.round(quantity*1000)/1000!==quantity)throw new Error(`Quotation line ${index+1} quantity supports at most three decimal places.`);
    const unitRate=round2(numeric(row.unit_rate,`Quotation line ${index+1} unit rate`));
    const discountAmount=round2(numeric(row.discount_amount??0,`Quotation line ${index+1} discount`));
    const rawTaxable=round2(quantity*unitRate)-discountAmount;
    if(discountAmount>round2(quantity*unitRate))throw new Error(`Quotation line ${index+1} discount cannot exceed its amount.`);
    return {
      line_no:index+1,item_type:itemType,product_id:productId,product_code:productCode,description,unit,
      quantity,unit_rate:unitRate,discount_amount:discountAmount,tax_rate:taxRate,
      hsn_sac:hsnSac,tax_source_url:taxSourceUrl,tax_verified_at:taxVerifiedAt,
      taxable_amount:round2(rawTaxable),tax_amount:0
    };
  });
  quote.items.forEach(item=>{
    const line=round2(item.taxable_amount*(item.tax_rate||0)/100);
    item.tax_amount=line;
  });
  Object.assign(quote,calculateTotals(quote.items,taxMode,freight,otherCharges));
  return quote;
}
function fingerprint(data){return createHash('sha256').update(JSON.stringify(data)).digest('hex');}

module.exports={products,taxModes,round2,calculateTotals,validateQuotation,fingerprint};
