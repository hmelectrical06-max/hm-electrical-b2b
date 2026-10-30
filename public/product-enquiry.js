'use strict';
{
 const selected=new URLSearchParams(location.search).get('product');
 if(selected&&D.materials.some(p=>p.id===selected)){
  if(!state.basket.some(p=>p.id===selected))state.basket.push({id:selected,qty:1});
  basketRender();
 }
}
