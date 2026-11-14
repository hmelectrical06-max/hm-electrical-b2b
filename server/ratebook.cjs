'use strict';
const c=require('./core.cjs');
const uuid=v=>{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))c.fail(400,'Invalid record reference.');return v;};
function text(v,max=250,required=false){if(typeof v!=='string'||v.length>max||/[\x00-\x1f]/.test(v)||required&&!v.trim())c.fail(400,'Check the text fields.');return v.trim();}
function number(v,max,positive=false){if(v===''||v===null||v===undefined||typeof v==='boolean'||typeof v==='string'&&!v.trim())c.fail(400,'Enter a valid amount.');const n=Number(v),rounded=Math.round((n+Number.EPSILON)*100)/100;if(!Number.isFinite(n)||n<0||n>max||positive&&rounded===0)c.fail(400,'Enter a valid amount.');return rounded;}
// Work in paisa; supplier discount is on this row's MRP, never another make's MRP.
function net(mrp,discount){const m=number(mrp,99999999999,true),d=number(discount,100);return Math.round(Math.round(m*100)*(10000-Math.round(d*100))/10000)/100;}
function sellingFloor(landed,margin=18){const cost=number(landed,99999999999,true),pct=number(margin,99.99);if(pct<18)c.fail(400,'Minimum margin is 18%.');return Math.ceil(Math.round(cost*100)*10000/(10000-Math.round(pct*100)))/100;}
// Owner-selected markup on buying/landed cost; no default or minimum profit percentage.
function sellingRate(landed,markup){const cost=number(landed,99999999999,true),pct=number(markup,1000);return Math.ceil(Math.round(cost*100)*(10000+Math.round(pct*100))/10000)/100;}
function decorate(row,rules){const rule=rules.find(x=>x.id===row.discount_rule_id);const valid=rule&&rule.supplier_id===row.supplier_id&&rule.brand===row.brand,value=valid?net(row.printed_mrp,rule.discount_percent):null,plan=row.source_details?.pricing_plan;
 const current=plan&&[row.updated_at,rule?.updated_at,row.material?.updated_at].every(t=>!t||Date.parse(plan.confirmed_at)>=Date.parse(t));
 return {...row,discount_percent:valid?Number(rule.discount_percent):null,discounted_mrp:value,indicative_selling_floor:null,saved_selling_plan:current?plan:null,discount_scope:valid?rule.scope:'Confirm supplier discount',quote_ready:row.review_status==='Verified reference'&&!!valid};}
function search(v){const s=text(v||'',100);return s.replace(/[^\p{L}\p{N} .x/+-]/gu,' ').trim();}
module.exports={uuid,text,number,net,sellingFloor,sellingRate,decorate,search};
