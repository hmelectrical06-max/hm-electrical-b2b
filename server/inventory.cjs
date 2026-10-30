'use strict';

const catalogue=require('./catalogue.json')
  .filter(product=>!String(product.sourceCode||'').startsWith('WORK-'));

const movementTypes=[
  'opening_stock','goods_receipt','customer_dispatch','installation_issue',
  'customer_return','supplier_return','damage','adjustment'
];

function validateMovement(payload,products=catalogue){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Invalid inventory movement.');
  const productId=typeof payload.product_id==='string'?payload.product_id.trim():'';
  const product=products.find(item=>item.id===productId);
  if(!product)throw new Error('Select a product from the existing material catalogue.');
  const movementType=payload.movement_type;
  if(!movementTypes.includes(movementType))throw new Error('Select a supported stock movement type.');
  const quantity=payload.quantity;
  if(typeof quantity!=='number'||!Number.isFinite(quantity)||quantity===0||Math.abs(quantity)>1000000000){
    throw new Error('Enter a non-zero quantity within the supported limit.');
  }
  if(movementType!=='adjustment'&&quantity<0)throw new Error('Quantity must be positive for this movement type.');
  if(Math.abs(quantity)*1000%1!==0)throw new Error('Quantity supports at most three decimal places.');
  const referenceType=typeof payload.reference_type==='string'?payload.reference_type.trim():'';
  const referenceId=typeof payload.reference_id==='string'?payload.reference_id.trim():'';
  const idempotencyKey=typeof payload.idempotency_key==='string'?payload.idempotency_key.trim():'';
  const note=typeof payload.note==='string'?payload.note.trim():'';
  if(!/^[a-zA-Z0-9_-]{1,40}$/.test(referenceType)||!referenceId||referenceId.length>120
    ||/[\u0000-\u001f]/.test(referenceId))throw new Error('Enter a valid reference type and reference number.');
  if(!/^[a-zA-Z0-9_-]{1,160}$/.test(idempotencyKey))throw new Error('The movement request ID is invalid. Please try again.');
  if(note.length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note))throw new Error('Notes must be 500 characters or fewer.');
  return {
    product,movement:{
      p_product_id:productId,p_movement_type:movementType,p_quantity:quantity,
      p_reference_type:referenceType,p_reference_id:referenceId,
      p_idempotency_key:idempotencyKey,p_note:note||null
    }
  };
}

module.exports={catalogue,movementTypes,validateMovement};
