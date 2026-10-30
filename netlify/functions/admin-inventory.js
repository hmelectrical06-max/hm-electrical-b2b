'use strict';

const c=require('../../server/core.cjs');
const {catalogue,validateMovement}=require('../../server/inventory.cjs');
const unavailableMessage='Inventory is not set up yet. Review and apply supabase/migrations/20261029_000002_inventory_ledger.sql to the intended Supabase project.';

async function inventoryDb(path,method='GET',data){
  try{return await c.db(path,method,data);}
  catch(error){
    if(error.message==='A required service endpoint was not found. Check the Supabase URL and apply database/setup.sql.')c.fail(503,unavailableMessage);
    throw error;
  }
}

async function loadBalances(){
  const balances=await inventoryDb('inventory_balances?select=product_id,on_hand,reserved,updated_at&limit=1000');
  return new Map(balances.map(row=>[row.product_id,row]));
}

exports.handler=c.safe(async event=>{
  const user=await c.admin(event);
  if(event.httpMethod==='GET'){
    const query=event.queryStringParameters||{};
    if(query.view==='summary'){
      const [initialized,available]=await Promise.all([
        c.dbCount('inventory_balances?select=product_id'),
        c.dbCount('inventory_balances?select=product_id&on_hand=gt.0')
      ]);
      return c.reply(200,{ok:true,initialized_products:initialized,products_with_stock:available});
    }
    if(query.view==='movements'){
      const requestedPage=Number(query.page||0);
      if(!Number.isInteger(requestedPage)||requestedPage<0||requestedPage>10000)c.fail(400,'Invalid inventory history page.');
      const movements=await inventoryDb(`inventory_movements?select=*&order=created_at.desc&limit=50&offset=${requestedPage*50}`);
      return c.reply(200,{ok:true,rows:movements,page:requestedPage});
    }
    const balances=await loadBalances();
    const rows=catalogue.map(product=>({
      id:product.id,sourceCode:product.sourceCode,name:product.name,size:product.size,
      unit:product.unit,category:product.category,
      ...(balances.get(product.id)||{on_hand:null,reserved:null,updated_at:null})
    }));
    return c.reply(200,{ok:true,total:rows.length,rows});
  }
  if(event.httpMethod!=='POST')return c.reply(405,{ok:false,message:'Method not allowed.'});
  c.origin(event);
  const payload=c.body(event,12000);
  let validated;
  try{validated=validateMovement(payload);}
  catch(error){c.fail(400,error.message);}
  const result=await inventoryDb('rpc/hm_inventory_movement','POST',{
    ...validated.movement,p_actor_id:user.id
  });
  if(!result||typeof result!=='object')c.fail(503,'The database did not confirm the inventory movement.');
  return c.reply(200,{ok:true,product_id:validated.product.id,movement_id:result.movement_id});
});
