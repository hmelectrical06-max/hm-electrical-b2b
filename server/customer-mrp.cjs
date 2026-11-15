'use strict';
const c=require('./core.cjs');
let cache,expires=0;
const normal=s=>String(s||'').toLowerCase().replace(/ashirwad/g,'ashirvad').replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9.]+/g,' ').trim();
const STOP=new Set('required needed supply quote quotation price prices rate rates mrp cost discount final kya hai ka ki ke mujhe chahiye batao please tell me what is the a an for of in do you have need want kitna material metre metres meter meters pcs nos mm cm inch inches mtr x'.split(' '));
function sizes(s){
 const value=String(s).toLowerCase().replace(/[×]/g,'x').replace(/½/g,'1/2').replace(/¾/g,'3/4').replace(/¼/g,'1/4');
 const metric=value.match(/((?:\d+(?:\.\d+)?\s*x\s*)*\d+(?:\.\d+)?)\s*(mm|cm)\b/);
 if(metric)return metric[1].split(/\s*x\s*/).map(n=>Number(n)*(metric[2]==='cm'?10:1));
 const inch=value.match(/((?:\d+(?:\.\d+)?(?:\/\d+)?\s*x\s*)*\d+(?:\.\d+)?(?:\/\d+)?)\s*(?:inch(?:es)?\b|")/);
 if(inch){const nominal={0.5:15,0.75:20,1:25,1.25:32,1.5:40,2:50,2.5:65,3:80,4:100,5:125,6:150,8:200};return inch[1].split(/\s*x\s*/).map(n=>{const [a,b]=n.split('/').map(Number),v=b?a/b:a;return nominal[v]||v*25.4;});}
 return [];
}
function select(query,rows){
 const q=normal(query),terms=[...new Set(q.split(/\s+/).filter(w=>!STOP.has(w)))],brands=['ashirvad','supreme','ajay','braco','havells','polycab','anchor','legrand','schneider','finolex','lauritz'];
 const brand=brands.find(b=>q.split(' ').includes(b)),sku=terms.find(t=>/^700\d{5}$/.test(t));
 const words=terms.filter(w=>!brands.includes(w)&&!/^\d+(?:\.\d+)?$/.test(w));
 if(!sku&&!words.length)return [];
 const dimensions=sizes(query);
 return rows.filter(r=>r.review_status==='Verified reference'&&Number(r.printed_mrp)>0&&r.material&&(!brand||normal(r.brand)===brand)).filter(r=>{
  if(sku)return r.manufacturer_sku===sku;
  const text=normal(r.material.name+' '+r.material.specification);
  if(!words.every(w=>text.split(' ').includes(w)))return false;
  for(const grade of q.matchAll(/\b(sdr|sch|class)\s*(\d+(?:\.\d+)?)/g))if(!new RegExp('\\b'+grade[1]+'\\s*'+grade[2].replace('.','\\.')+'\\b').test(text))return false;
  if(dimensions.length){const nums=sizes(r.material.specification);if(dimensions.length!==nums.length||dimensions.some((n,i)=>n!==nums[i]))return false;}
  const length=String(query).toLowerCase().match(/\b(\d+(?:\.\d+)?)\s*(?:mtr|m)\b/);if(length&&([3,5,6].includes(Number(length[1]))||/length|long/i.test(query))&&!new RegExp('\\b'+length[1].replace('.','\\.')+'\\s*(?:mtr|m)\\b').test(text))return false;
  return true;
 }).sort((a,b)=>String(b.effective_date).localeCompare(String(a.effective_date))).filter((r,i,list)=>list.findIndex(x=>x.brand===r.brand&&x.material.name===r.material.name&&x.material.specification===r.material.specification&&x.material.unit===r.material.unit)===i).map(r=>({name:r.material.name,size:r.material.specification,unit:r.material.unit,brand:r.brand,mrp:Number(r.printed_mrp),effectiveDate:r.effective_date||null,sku:/^700\d{5}$/.test(r.manufacturer_sku||'')?r.manufacturer_sku:null})).filter((r,i,list)=>list.findIndex(x=>x.brand===r.brand)===i).slice(0,3);
}
async function references(query){
 if(!cache||Date.now()>expires){let rows=[];for(let offset=0;offset<5000;offset+=500){const page=await c.db('hm_supplier_price_rows?select=brand,printed_mrp,review_status,manufacturer_sku,effective_date,material:hm_material_master!inner(name,specification,unit)&review_status=eq.Verified%20reference&order=id&limit=500&offset='+offset);rows.push(...page);if(page.length<500)break;}cache=rows;expires=Date.now()+120000;}
 return select(query,cache);
}
function text(rows,{max=650}={}){
 if(!rows.length)return 'Please share the exact brand, material name, size and grade/model. I can share an available verified printed MRP reference; where no matching MRP is available our office will confirm it. Final selling rates and all service charges are confirmed by HM ELECTRICAL after review.';
 const line=r=>`${r.brand}: ${r.name.slice(0,75)} | ${r.size.slice(0,50)} — Rs ${r.mrp.toFixed(2)}/${r.unit}`;
 const suffix='\nMRP reference only. Our team will confirm the final selling rate and stock.';
 let shown=rows.slice(0,3),answer='HM ELECTRICAL — available make/size MRP references:\n'+shown.map(line).join('\n')+suffix;
 while(answer.length>max&&shown.length>1){shown.pop();answer='HM ELECTRICAL — available make/size MRP references:\n'+shown.map(line).join('\n')+suffix;}
 return answer;
}
module.exports={normal,select,references,text};
