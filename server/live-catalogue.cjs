'use strict';
const c=require('./core.cjs');
// Page explicitly: PostgREST caps a single response at 1,000 rows.
async function all(path){const rows=[];for(let offset=0;offset<20000;offset+=500){const page=await c.db(path+'&limit=500&offset='+offset);rows.push(...page);if(page.length<500)return rows;}c.fail(503,'Catalogue is too large to load safely.');}
async function products(){return (await all('hm_catalogue_products?select=product_id,data&order=product_id')).map(r=>({...r.data,id:r.product_id}));}
async function product(id){if(typeof id!=='string'||!/^(MAT-\d{4}|ADD-[0-9a-f-]{36})$/.test(id))c.fail(400,'Choose a valid material.');const rows=await c.db('hm_catalogue_products?product_id=eq.'+encodeURIComponent(id)+'&select=product_id,data');if(rows.length!==1)c.fail(404,'Material not found.');return {...rows[0].data,id:rows[0].product_id};}
module.exports={all,products,product};
