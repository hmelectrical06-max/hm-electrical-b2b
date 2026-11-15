'use strict';
const c=require('../../server/core.cjs'),a=require('../../server/enquiry-assistant.cjs');
exports.handler=c.safe(async e=>{
 if(e.httpMethod!=='POST')return c.reply(405,{ok:false});c.origin(e);await c.rate(e,'public-assistant',30);
 const p=c.body(e,3000);if(typeof p.question!=='string'||!p.question.trim()||p.question.length>350)c.fail(400,'Enter a material or service requirement, up to 350 characters.');
 // Only public catalogue identity fields are used. No price/cost metadata or supplier records.
 const products=await require('../../server/live-catalogue.cjs').products();
 return c.reply(200,{ok:true,mode:'catalogue-guidance',...a.publicAnswer(p.question,products)});
});
