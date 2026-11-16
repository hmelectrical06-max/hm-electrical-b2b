'use strict';
const live=require('./live-catalogue.cjs');
const clean=(s,max=160)=>String(s??'').replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,max);
const number=v=>v!==null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const placeholder=s=>!s||/^(?:as per|brand open|any make|to confirm|on request|unknown|not specified)/i.test(s);
const forbidden=p=>p.hidden===true||/\bcivil\b|shuttering|pile head|reinforcement fixing/i.test(p.name||'');
const META='product_id,brand,manufacturer_sku,specifications,mrp,mrp_source_url,mrp_verified_at,retail_price,wholesale_price,minimum_wholesale_quantity,public_price_mode,gst_rate,tax_source_url,tax_verified_at,availability';
let cache,expires=0,pending;
function publicView(p,m={}){
 const brand=clean(m.brand||p.brand,80),verifiedMrp=number(m.mrp)>0&&m.mrp_source_url&&m.mrp_verified_at;
 const out={id:clean(p.id,80),name:clean(p.name,140),size:clean(m.specifications||p.size,180),unit:clean(p.unit,30),brand:placeholder(brand)?null:brand,sku:clean(m.manufacturer_sku,100)||null,category:clean(p.category,100),group:clean(p.group,100),sourceCode:clean(p.sourceCode,80),requestedCode:clean(p.requestedCode,80),mrp:verifiedMrp?number(m.mrp):null,sellingPrice:null,minimumQuantity:null,gstRate:null,discountPercent:null,availability:['listed','on_request','out_of_stock','discontinued'].includes(m.availability)?m.availability:'on_request'};
 // A stored buying price or internal markup plan is never a customer selling price.
 if(m.public_price_mode==='retail'&&number(m.retail_price)>0)out.sellingPrice=number(m.retail_price);
 if(m.public_price_mode==='wholesale'&&number(m.wholesale_price)>0){out.sellingPrice=number(m.wholesale_price);out.minimumQuantity=number(m.minimum_wholesale_quantity);}
 if(m.tax_source_url&&m.tax_verified_at&&number(m.gst_rate)!==null&&number(m.gst_rate)<=100)out.gstRate=number(m.gst_rate);
 if(out.mrp>0&&out.sellingPrice!==null&&out.sellingPrice<out.mrp)out.discountPercent=Math.round((out.mrp-out.sellingPrice)/out.mrp*10000)/100;
 return out;
}
async function products(){
 if(cache&&Date.now()<expires)return cache;
 if(!pending)pending=(async()=>{const [rows,meta]=await Promise.all([live.products(),live.all('catalogue_product_metadata?select='+META+'&order=product_id')]);const overlay=new Map(meta.map(r=>[r.product_id,r]));const result=rows.filter(p=>!forbidden(p)).map(p=>publicView(p,overlay.get(p.id)));cache=result;expires=Date.now()+120000;return result;})().finally(()=>{pending=null;});
 return pending;
}
function normal(s){return clean(s,3000).toLowerCase().replace(/½/g,'1/2').replace(/¾/g,'3/4').replace(/¼/g,'1/4').replace(/(\d(?:\/\d)?)"/g,'$1 inch').replace(/[×*]/g,'x').replace(/\b(\d+)\s*c(?:ores?)?\s*[x×*]?\s*(?=\d)/g,'$1 core ').replace(/ashirwad/g,'ashirvad').replace(/standerd|standred/g,'standard').replace(/boasch|boash/g,'bosch').replace(/(?:sq\.?\s*mm|sqmm|mm2|mm²)/g,'sqmm').replace(/\b(?:tar|taar)\b/g,'wire').replace(/\bpaip\b/g,'pipe').replace(/\b(?:grender|grainder)\b/g,'grinder').replace(/\bchapsaw\b/g,'chop saw').replace(/\b(?:raducer|reducer)\b/g,'reducer').replace(/\b(?:fashtner|fastner)\b/g,'fastener').replace(/\b(?:wisher|wosher)\b/g,'washer').replace(/\b(?:safty|septi)\b/g,'safety').replace(/\b(?:bulb|lamp)\b/g,'light').replace(/\b(?:labor|mistri)\b/g,'labour').replace(/\bbreaker\b/g,'mcb').replace(/\b(?:coupling)\b/g,'coupler').replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9./-]+/g,' ').replace(/\s+/g,' ').trim();}
const STOP=new Set('hi hello please need needed required requirement requirements want looking supply quote quotation price prices rate rates mrp cost discount final tell me what is are a an the for of in do you have your our my list listed printed catalogue catalog latest best wholesale retail bulk contractor project available availability stock not currently out unavailable ready can arrange delivery dispatch mumbai mumbra thane kausa borivali sion worli bhiwandi panvel material materials item items product products buy order send show give us mujhe chahiye hai ka ki ke batao kitna pcs pieces piece nos no metres metre meters meter mtr rolls roll coils coil box boxes kg litre litres qty quantity mm cm inch inches sqmm amp amps inch size x'.split(' '));
const singular=t=>t.endsWith('ies')?t.slice(0,-3)+'y':t.endsWith('s')&&!t.endsWith('ss')?t.slice(0,-1):t;
function words(s){return normal(s).split(' ').filter(t=>!STOP.has(t)).map(singular).filter(t=>t&&!STOP.has(t)&&!/^\d+(?:\.\d+)?(?:\/\d+)?$/.test(t));}
function specs(query){
 const q=normal(query),raw=String(query).toLowerCase().replace(/[×*]/g,'x');
 const dim=raw.match(/\b((?:\d+(?:\.\d+)?\s*x\s*)+\d+(?:\.\d+)?)\s*(mm|cm)?\b/);
 const nominal={0.5:15,0.75:20,1:25,1.25:32,1.5:40,2:50,2.5:65,3:80,4:100,5:125,6:150,8:200};
 const measures=[...q.matchAll(/\b(\d+(?:\.\d+)?(?:\/\d+)?)\s*(mm|cm|sqmm|a|amp|amps|w|watt|inch|inches)\b/g)];
 const value=t=>{const [a,b]=t.split('/').map(Number);return b?a/b:a;};
 const sizes=dim?dim[1].split(/\s*x\s*/).map(n=>Number(n)*(dim[2]==='cm'?10:1)):measures.map(m=>value(m[1])*(m[2]==='cm'?10:1));
 if(!dim)measures.forEach((m,i)=>{if(/^inch/.test(m[2]))sizes[i]=nominal[value(m[1])]||value(m[1])*25.4;});
 const bolt=raw.match(/\bm\s*(\d+)\b/),grade=[...q.matchAll(/\b(sdr|sch|class)\s+(\d+(?:\.\d+)?)/g)].map(m=>[m[1],m[2]]);
 const unit=dim?'linear':measures.some(m=>m[2]==='sqmm')?'area':measures.some(m=>/^(a|amp|amps)$/.test(m[2]))?'current':measures.some(m=>/^(w|watt)$/.test(m[2]))?'power':sizes.length?'linear':null;
 return {size:sizes.length>0||!!bolt,qty:/\b\d+(?:\.\d+)?\s*(?:pcs|pieces?|nos?|metres?|meters?|mtr|rolls?|coils?|boxes?|kg|litres?)\b/.test(raw),sizes,unit,cores:q.match(/\b(\d+)\s*cores?\b/)?.[1]||null,bolt:bolt?Number(bolt[1]):null,grade};
}
function search(query,items){
 const q=normal(query),terms=words(query),requested=specs(query);
 if(!terms.length&&!/\b(?:mat|csv|add|ss|fp|pl|elec)-\d/i.test(q))return [];
 const codes=items.filter(p=>!forbidden(p)&&[p.id,p.sku,p.sourceCode,p.requestedCode].filter(Boolean).some(code=>q.split(' ').includes(normal(code))));
 if(codes.length)return codes;
 const commonBrands=['polycab','finolex','havells','anchor','braco','ashirvad','supreme','ajay','legrand','schneider','bosch','dewalt','ador','makita','esab','berger','fischer','hilti','lauritz'];
 const brand=commonBrands.find(b=>q.split(' ').includes(b)&&!(b==='anchor'&&/fastener|bolt/.test(q)));
 const ignoredSpec=new Set(['sdr','sch','class','m']);
 const nameTerms=terms.filter(t=>!ignoredSpec.has(t)&&!(brand&&t===brand));
 return items.filter(p=>!forbidden(p)).map(p=>{
  const name=normal(p.name),spec=normal(p.size),all=normal([p.name,p.size,p.brand,p.category,p.group].join(' ')),tokens=new Set(all.split(' ').map(singular));
  if(brand&&(!p.brand||!normal(p.brand).split(' ').includes(brand)))return null;
  if(!nameTerms.every(t=>tokens.has(t)))return null;
  if(requested.bolt&&!new RegExp('\\bm\\s*'+requested.bolt+'\\b').test(all))return null;
  const stored=specs(p.size),actual=stored.size?stored:specs(p.name);
  if(requested.unit&&actual.unit&&requested.unit!==actual.unit)return null;
  if(requested.cores&&requested.cores!==actual.cores)return null;
  if(requested.sizes.length&&(requested.sizes.length!==actual.sizes.length||requested.sizes.some((v,i)=>v!==actual.sizes[i])))return null;
  if(requested.grade.some(([key,n])=>!new RegExp('\\b'+key+'\\s*'+n.replace('.','\\.')+'\\b').test(all)))return null;
  const length=q.match(/\b([356])\s*(?:m|mtr)\b/);if(length&&!new RegExp('\\b'+length[1]+'\\s*(?:m|mtr)\\b').test(all))return null;
  if(/\b(?:wire|cable)\b/.test(q)&&!/rope|brush|clip|binding|stripper|cutter|puller|marker|tie|lug|terminal|connector/i.test(q)){if(!/\b(?:wire|cable)\b/.test(name)||/rope|brush|clip|binding|stripper|cutter|puller|marker|tie|lug|terminal|connector/.test(name))return null;}
  if(/anchor\s+fastener/.test(q)&&!/nut|washer/.test(q)&&/nut|washer/.test(name))return null;
  const score=nameTerms.reduce((v,t)=>v+(name.split(' ').map(singular).includes(t)?4:1),0)+(p.mrp?2:0)+(p.sellingPrice?2:0)-name.length/1000;
  return {p,score};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id)).map(r=>r.p);
}
function referenceView(r){return {id:r.sku||'',name:clean(r.name,140),size:clean(r.size,180),unit:clean(r.unit,30),brand:placeholder(r.brand)?null:clean(r.brand,80),sku:r.sku||null,mrp:r.mrp,sellingPrice:null,gstRate:null,minimumQuantity:null,reference:true};}
function related(query,items,{alternatives=false}={}){
 let queries=[];
 if(alternatives)queries=[normal(query).replace(/\b(?:ashirvad|supreme|ajay|polycab|havells|finolex|braco|bosch|dewalt|ador|legrand|schneider|anchor|lauritz)\b/g,'')];
 else if(/welding.*machine/i.test(query))queries=['welding rod','safety goggles'];
 else if(/wire|cable/i.test(query))queries=['conduit','cable lug'];
 else if(/cpvc.*pipe/i.test(query))queries=['CPVC elbow','CPVC tee'];
 else if(/pipe/i.test(query))queries=['elbow','coupler'];
 else if(/fastener|bolt/i.test(query)){const bolt=specs(query).bolt;queries=['washer'+(bolt?' M'+bolt:''),'nut'+(bolt?' M'+bolt:'')];}
 else if(/mcb|mccb/i.test(query))queries=['distribution board','DIN rail'];
 const result=[];for(const q of queries){const p=search(q,items).find(p=>!result.some(r=>r.id===p.id));if(p)result.push({id:p.id,name:p.name,size:p.size,brand:p.brand,kind:alternatives?'alternative':'accessory'});}return result.slice(0,2);
}
module.exports={products,publicView,search,normal,specs,referenceView,related};
