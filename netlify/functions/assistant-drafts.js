'use strict';
const c=require('../../server/core.cjs'),a=require('../../server/enquiry-assistant.cjs'),{createHash}=require('node:crypto');
// Netlify scheduled invocation only. No outgoing messages and no paid model calls.
exports.handler=async()=>{
 const rows=await c.db('rpc/hm_ai_pending','POST',{});let prepared=0;
 for(const row of rows){
  const hash=createHash('sha256').update('hm-standard-draft:'+row.lead_key).digest('hex');
  const id=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-8'+hash.slice(17,20)+'-'+hash.slice(20,32);
  const lead={...row,details:[row.details,...(row.items||[]).map(i=>`${i.name} ${i.size||''} × ${i.qty} ${i.unit||''}`)].filter(Boolean).join('\n')};
  const saved=await c.db('hm_ai_drafts?on_conflict=id','POST',{id,lead_key:row.lead_key,reply:a.template(lead),engine:'scheduled-standard',status:'draft',staff_note:'Prepared automatically from the enquiry. Review the original requirement and verified customer contact before sending.',created_by:null},{Prefer:'resolution=ignore-duplicates,return=representation'});
  prepared+=saved.length;
 }
 return {statusCode:200,body:JSON.stringify({prepared,customerMessagesSent:0,paidAiCalls:0})};
};
