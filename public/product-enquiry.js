'use strict';
{
 const selected=new URLSearchParams(location.search).get('product');
 if(selected&&D.materials.some(p=>p.id===selected)){
  if(!state.basket.some(p=>p.id===selected))state.basket.push({id:selected,qty:1});
  basketRender();
  // Content/photo loading can move the original hash position. Keep the
  // selected-product link on its enquiry form, until the visitor interacts.
  let interacted=false;
  for(const event of ['pointerdown','keydown','wheel','touchstart'])window.addEventListener(event,()=>{interacted=true;},{once:true,passive:true});
  const align=()=>{if(!interacted&&location.hash==='#enquiry')document.getElementById('enquiry')?.scrollIntoView({block:'start'});};
  window.addEventListener('load',align,{once:true});document.addEventListener('hm:content',align,{once:true});
 }
}
