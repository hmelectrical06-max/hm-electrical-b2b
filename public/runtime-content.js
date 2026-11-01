'use strict';
(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const originalPaths=new Map((window.HM_DATA?.materials||[]).map(p=>[p.id,window.HM_CATALOGUE_SEARCH.productPath(p)]));
 let busy=false,latest=null;
 async function refresh(){if(busy||document.hidden)return;busy=true;try{
  const response=await fetch('/.netlify/functions/public-content',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Content unavailable');const content=await response.json();if(content.ok!==true)throw Error('Content unavailable');latest=content;window.HM_LIVE_CONTENT=content;
  if(window.HM_DATA&&Array.isArray(content.products)){
   const byId=new Map(content.products.map(p=>[p.id,p]));
   for(const p of window.HM_DATA.materials){const fresh=byId.get(p.id);if(fresh)Object.assign(p,fresh,{_seoPath:originalPaths.get(p.id)});}
   const services=new Map((content.services||[]).map(p=>[p.id,p]));for(const p of window.HM_DATA.services){const fresh=services.get(p.id);if(fresh)Object.assign(p,fresh);}
   if(typeof render==='function')render();if(typeof serviceRender==='function')serviceRender();if(typeof cascade==='function')cascade();
  }
  const productId=document.querySelector('[data-live-product]')?.dataset.liveProduct;
  const product=(content.products||[]).find(p=>p.id===productId);
  if(product){const mount=document.querySelector('[data-live-product]'),photo=product.verifiedProductPhoto||'/photos/products/'+product.id+'.svg';
   mount.innerHTML=`<figure style="max-width:440px;margin:24px 0"><img style="width:100%;height:auto" src="${esc(photo)}" alt="${esc(product.name+' '+product.size+(product.verifiedProductPhoto?' product photo':' representative illustration'))}"><figcaption>${product.verifiedProductPhoto?'Product photo supplied and verified by HM ELECTRICAL.':'Representative illustration. Confirm the exact make and model with our office.'}</figcaption></figure><p><strong>Availability:</strong> ${esc(product.availability==='discontinued'?'Contact us for an alternative':'Confirm availability with our office')}</p>`;
   const heading=document.querySelector('main h1');heading.textContent=product.name+' — '+product.size;
   const description=product.name+', '+product.size+', unit '+product.unit+'. Request make, availability and a quotation from HM ELECTRICAL for Mumbai and Thane.';
   document.title=product.name+' '+product.size+' Supplier Mumbai & Thane | HM ELECTRICAL';
   const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=description;
   document.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{try{const schema=JSON.parse(script.textContent);for(const entity of schema['@graph']||[schema])if(entity['@type']==='Product'){entity.name=product.name+' '+product.size;entity.description=description;entity.category=product.category;entity.image=new URL(photo,location.origin).href;const values={'Category':product.category,'Product group':product.group,'Specification':product.specifications||product.size,'Unit':product.unit,'Brand / make':product.brand||'As per enquiry'};for(const property of entity.additionalProperty||[])if(values[property.name])property.value=values[property.name];}script.textContent=JSON.stringify(schema).replace(/</g,'\\u003c');}catch{}});
   const fields={'Category':product.category,'Product group':product.group,'Specification':product.specifications||product.size,'Unit':product.unit,'Brand / make':product.brand||'As per enquiry'};
   document.querySelectorAll('main dt').forEach(dt=>{if(fields[dt.textContent])dt.nextElementSibling.textContent=fields[dt.textContent];});
   const note=document.querySelector('.product-photo-note');if(note)note.textContent=product.verifiedProductPhoto?'Photo is representative of the verified material; confirm the final order specification.':'Exact product photograph can be requested; the illustration is a material reference.';
   if(product.description){const p=document.createElement('p');p.textContent=product.description;mount.append(p);}
  }
  const rows=document.querySelectorAll('table tbody tr');if(rows.length&&content.products){const data=new Map([...content.products,...(content.services||[])].map(p=>[p.id,p]));for(const row of rows){const cells=row.cells,p=data.get(cells[0]?.textContent);if(p&&cells.length>=7){cells[2].textContent=p.category;cells[3].textContent=p.name;cells[4].textContent=p.size||p.scope||'';cells[5].textContent=p.unit;}}}
  document.dispatchEvent(new CustomEvent('hm:content',{detail:content}));
 }catch{document.dispatchEvent(new CustomEvent('hm:content-unavailable'));}finally{busy=false;}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('focus',refresh);setInterval(refresh,30000);refresh();window.HM_REFRESH_CONTENT=refresh;
})();
