'use strict';
const {productPath}=require('../public/catalogue-search.js');
const baseline=new Map(require('./catalogue.json').map(p=>[p.id,productPath(p)]));
const domain='https://hmelectricalb2b.com';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuidId=/^ADD-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function route(p){const value=baseline.get(p.id)||productPath(p);if(!/^\/products\/[a-z0-9-]+\/$/.test(value))throw Error('Invalid public material path');return value;}
function visible(row){return row?.data&&row.data.hidden!==true;}
function view(row,meta={}){
 const p={id:row.product_id};
 for(const key of ['name','size','unit','category','group','description','_seoPath'])p[key]=String(row.data[key]||'');
 if(!p._seoPath)delete p._seoPath;
 p.brand=String(meta.brand||'As per enquiry');p.specifications=String(meta.specifications||p.size);p.hsn=String(meta.hsn||row.data.hsn||'Confirm with our office');
 p.photo=meta.photo_rights_verified===true&&/^https:\/\//.test(meta.product_photo_url||'')&&/^https:\/\//.test(meta.photo_rights_source_url||'')?meta.product_photo_url:null;
 return p;
}
function page(p){
 const canonical=domain+route(p),name=p.name+' — '+p.size,description=p.name+', '+p.size+'. Request specifications, availability and a quotation from HM ELECTRICAL in Mumbai and Thane.';
 const fields=[['Product code',p.id],['Category',p.category],['Product group',p.group],['Specification',p.specifications],['Unit',p.unit],['Brand / make',p.brand],['HSN reference',p.hsn]];
 const fallback='/photos/catalogue-placeholder.svg',image=p.photo||fallback;
 const schema={'@context':'https://schema.org','@graph':[{'@type':'WebPage',url:canonical,name,description,about:{'@type':'Thing',name,identifier:p.id}},{'@type':'BreadcrumbList',itemListElement:[{name:'Home',item:domain+'/'},{name:'Materials',item:domain+'/materials/'},{name, item:canonical}].map((x,i)=>({'@type':'ListItem',position:i+1,...x}))}]};
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(p.name+' '+p.size)} Supplier Mumbai &amp; Thane | HM ELECTRICAL</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${escape(canonical)}"><link rel="stylesheet" href="/seo.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script><script defer src="/catalogue-search.js"></script><script defer src="/runtime-content.js"></script></head><body><header><a href="/">HM ELECTRICAL</a><nav><a href="/materials/">Material supply</a> · <a href="/hire-technicians-labour/">Hire technicians / labour</a></nav></header><main><h1>${escape(name)}</h1><div data-live-product="${escape(p.id)}" data-fallback-photo="${fallback}"><figure class="product-figure"><img src="${escape(image)}" width="640" height="480" alt="${escape(name)} ${p.photo?'product reference image':'representative illustration'}"><figcaption>${p.photo?'Reference image; confirm exact make, model and specification.':'Representative illustration; request an exact make/model photo.'}</figcaption></figure></div><dl>${fields.map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl><p>${escape(p.description)}</p><p class="product-photo-note"><a href="/asset-policy.html#photo-sources">Image sources and permissions</a></p><p><strong>MRP on request</strong></p><p>Confirm brand, specification, HSN/GST, price, availability and delivery in your quotation. This listing is not confirmation of stock or an accepted order.</p><p><a class="button" href="/?product=${encodeURIComponent(p.id)}#enquiry">Enquire about this specification</a></p><p><a href="https://wa.me/918085560156?text=${encodeURIComponent('Please quote '+p.id+' | '+p.name+' | '+p.size)}">Enquire on WhatsApp</a></p></main><footer><a href="/">HM ELECTRICAL B2B</a> · Mumbai and Thane</footer></body></html>`;
}
function sitemap(rows){return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+rows.filter(visible).map(r=>`<url><loc>${escape(domain+route({...r.data,id:r.product_id}))}</loc></url>`).join('')+'</urlset>';}
module.exports={domain,escape,uuidId,route,visible,view,page,sitemap};
