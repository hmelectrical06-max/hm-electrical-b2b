'use strict';

const csvColumns=[
  'product_id','brand','manufacturer','manufacturer_sku','manufacturer_source_url','specifications',
  'hsn','gst_rate','tax_source_url','tax_verified_at','product_photo_url','photo_rights_source_url',
  'photo_rights_verified','mrp','mrp_source_url','mrp_verified_at','purchase_price','retail_price',
  'wholesale_price','minimum_wholesale_quantity','availability','public_price_mode'
];
const textLimits={
  brand:120,manufacturer:160,manufacturer_sku:120,specifications:2000,hsn:16
};
const sourceUrls=['manufacturer_source_url','tax_source_url','product_photo_url','photo_rights_source_url','mrp_source_url'];
const verificationDates=['tax_verified_at','mrp_verified_at'];
const prices=['mrp','purchase_price','retail_price','wholesale_price','minimum_wholesale_quantity'];
const availabilityValues=['listed','on_request','discontinued'];
const priceModes=['request','mrp','retail','wholesale'];

function parseCsv(input){
  if(typeof input!=='string'||input.length>3*1024*1024)throw new Error('CSV file is missing or exceeds 3 MB.');
  input=input.replace(/^\uFEFF/,'');
  const rows=[];
  let row=[],field='',quoted=false;
  for(let i=0;i<input.length;i++){
    const char=input[i];
    if(quoted){
      if(char==='"'&&input[i+1]==='"'){field+='"';i++;}
      else if(char==='"')quoted=false;
      else field+=char;
    }else if(char==='"'){
      if(field)throw new Error('CSV has an unexpected quote.');
      quoted=true;
    }else if(char===','){
      row.push(field);field='';
    }else if(char==='\n'||char==='\r'){
      if(char==='\r'&&input[i+1]==='\n')i++;
      row.push(field);field='';
      if(row.some(value=>value.trim()))rows.push(row);
      row=[];
    }else field+=char;
  }
  if(quoted)throw new Error('CSV has an unclosed quoted field.');
  row.push(field);
  if(row.some(value=>value.trim()))rows.push(row);
  if(!rows.length)throw new Error('CSV contains no product rows.');
  const headers=rows.shift().map(value=>value.trim().replace(/^\uFEFF/,'').toLowerCase());
  if(headers.length!==csvColumns.length||headers.some((value,index)=>value!==csvColumns[index])){
    throw new Error(`CSV headers must match this order: ${csvColumns.join(',')}`);
  }
  return rows.map((values,index)=>{
    if(values.length!==headers.length)throw new Error(`CSV row ${index+2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header,column)=>[header,values[column].trim()]));
  });
}

function validateRows(rows,products){
  if(!Array.isArray(rows)||rows.length===0)throw new Error('Add at least one product row.');
  if(rows.length>1000)throw new Error('Import at most 1,000 catalogue rows at a time.');
  const productsById=new Map(products.map(product=>[product.id,product]));
  const seen=new Set(),valid=[],invalid=[];
  for(let index=0;index<rows.length;index++){
    const row=rows[index],line=index+2;
    if(!row||typeof row!=='object'||Array.isArray(row)){
      invalid.push({line,message:'Invalid row.'});
      continue;
    }
    const productId=typeof row.product_id==='string'?row.product_id.trim():'';
    if(!productsById.has(productId)){
      invalid.push({line,message:'Product ID does not match an existing material catalogue item.'});
      continue;
    }
    if(seen.has(productId)){
      invalid.push({line,message:'Duplicate product ID in this CSV.'});
      continue;
    }
    seen.add(productId);
    const changes={product_id:productId};
    let error='';
    for(const [field,max] of Object.entries(textLimits)){
      const value=row[field];
      if(value===undefined||value===null||String(value).trim()==='')continue;
      if(typeof value!=='string'||value.trim().length>max||/[\u0000-\u001f]/.test(value)){
        error=`${field} must be a plain value up to ${max} characters.`;
        break;
      }
      changes[field]=value.trim();
    }
    if(error){invalid.push({line,message:error});continue;}
    for(const field of sourceUrls){
      const value=row[field];
      if(value===undefined||value===null||String(value).trim()==='')continue;
      let parsed;
      try{parsed=new URL(String(value).trim());}catch{}
      if(!parsed||parsed.protocol!=='https:'){error=`${field} must be a valid HTTPS URL.`;break;}
      changes[field]=parsed.toString();
    }
    if(error){invalid.push({line,message:error});continue;}
    for(const field of verificationDates){
      const value=row[field];
      if(value===undefined||value===null||String(value).trim()==='')continue;
      const date=String(value).trim();
      const timestamp=/^\d{4}-\d{2}-\d{2}$/.test(date)?Date.parse(date+'T00:00:00.000Z'):NaN;
      if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==date){
        error=`${field} must use YYYY-MM-DD.`;
        break;
      }
      changes[field]=date;
    }
    if(error){invalid.push({line,message:error});continue;}
    for(const field of prices){
      const value=row[field];
      if(value===undefined||value===null||String(value).trim()==='')continue;
      const parsed=typeof value==='number'?value:Number(value);
      if(!Number.isFinite(parsed)||parsed<0||(field==='minimum_wholesale_quantity'&&parsed>1e12)){
        error=`${field} must be a non-negative number.`;
        break;
      }
      changes[field]=parsed;
    }
    if(error){invalid.push({line,message:error});continue;}
    if(row.gst_rate!==undefined&&row.gst_rate!==null&&String(row.gst_rate).trim()!==''){
      const rate=Number(row.gst_rate);
      if(!Number.isFinite(rate)||rate<0||rate>100){invalid.push({line,message:'gst_rate must be between 0 and 100.'});continue;}
      changes.gst_rate=rate;
    }
    if((changes.hsn!==undefined||changes.gst_rate!==undefined)&&(!changes.tax_source_url||!changes.tax_verified_at)){
      invalid.push({line,message:'HSN/GST data requires its verified source URL and verification date.'});
      continue;
    }
    if(row.product_photo_url!==undefined&&row.product_photo_url!==null&&String(row.product_photo_url).trim()!==''){
      if(!changes.product_photo_url){invalid.push({line,message:'product_photo_url must be a valid HTTPS URL.'});continue;}
    }
    if(row.photo_rights_verified!==undefined&&row.photo_rights_verified!==null&&String(row.photo_rights_verified).trim()!==''){
      const value=String(row.photo_rights_verified).trim().toLowerCase();
      if(!['true','false'].includes(value)){invalid.push({line,message:'photo_rights_verified must be true or false.'});continue;}
      changes.photo_rights_verified=value==='true';
    }
    if(changes.photo_rights_verified===true&&(!changes.product_photo_url||!changes.photo_rights_source_url)){
      invalid.push({line,message:'Photo and rights-source URLs are required when photo rights are marked verified.'});
      continue;
    }
    if(row.mrp!==undefined&&row.mrp!==null&&String(row.mrp).trim()!==''&&(!changes.mrp_source_url||!changes.mrp_verified_at)){
      invalid.push({line,message:'An MRP requires its official HTTPS source URL and verification date.'});
      continue;
    }
    if((changes.brand!==undefined||changes.manufacturer!==undefined||changes.manufacturer_sku!==undefined)&&!changes.manufacturer_source_url){
      invalid.push({line,message:'Brand, manufacturer and SKU data require an official HTTPS source URL.'});
      continue;
    }
    if(changes.hsn!==undefined&&!/^(?:\d{4}|\d{6}|\d{8})$/.test(changes.hsn)){
      invalid.push({line,message:'HSN must contain 4, 6 or 8 digits.'});
      continue;
    }
    if(row.availability!==undefined&&row.availability!==null&&String(row.availability).trim()!==''){
      const value=String(row.availability).trim().toLowerCase();
      if(!availabilityValues.includes(value)){invalid.push({line,message:`availability must be one of ${availabilityValues.join(', ')}.`});continue;}
      changes.availability=value;
    }
    if(row.public_price_mode!==undefined&&row.public_price_mode!==null&&String(row.public_price_mode).trim()!==''){
      const value=String(row.public_price_mode).trim().toLowerCase();
      if(!priceModes.includes(value)){invalid.push({line,message:`public_price_mode must be one of ${priceModes.join(', ')}.`});continue;}
      const present=value==='mrp'?changes.mrp!==undefined:value==='retail'?changes.retail_price!==undefined:value==='wholesale'?changes.wholesale_price!==undefined:true;
      if(!present){invalid.push({line,message:`Add a ${value} value before publishing that price mode.`});continue;}
      if(value==='wholesale'&&(!changes.minimum_wholesale_quantity||changes.minimum_wholesale_quantity<=0)){
        invalid.push({line,message:'Add a positive minimum wholesale quantity before publishing wholesale pricing.'});
        continue;
      }
      changes.public_price_mode=value;
    }
    valid.push({line,product:productsById.get(productId),changes});
  }
  return {valid,invalid};
}

function csvEscape(value){
  const text=String(value??'');
  return '"'+(/^[\s]*[=+\-@]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';
}

function exportCsv(products){
  const lines=[csvColumns.map(csvEscape).join(',')];
  for(const product of products){
    const row={...product.metadata,product_id:product.id};
    lines.push(csvColumns.map(column=>csvEscape(row[column])).join(','));
  }
  return '\ufeff'+lines.join('\r\n');
}

module.exports={csvColumns,parseCsv,validateRows,exportCsv};
