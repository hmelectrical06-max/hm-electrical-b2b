'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const productRoute=require('../public/catalogue-search.js').productPath;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const hasNoindex=html=>[...html.matchAll(/<meta\s+name=["']robots["'][^>]*>/gi)].some(([tag])=>/\bnoindex\b/i.test(tag));
const publicEntryPages=new Set(['index.html','catalogue.html']);
const legacyDescriptions={
 'catalogue.html':'Browse HM ELECTRICAL product specifications by category, product code, size and unit. Add materials to an enquiry and request a confirmed quotation.',
 'tools.html':'Browse the HM ELECTRICAL tools catalogue and ask our Mumbai team to confirm exact makes, specifications, availability and quotation details.'
};
const jsonLd=value=>JSON.stringify(value).replace(/</g,'\\u003c');
module.exports=function generate(output){
 const production=process.env.HM_SITE_MODE==='production';
 const domain='https://hmelectricalb2b.com';
 if(production&&process.env.CONTEXT&&process.env.CONTEXT!=='production')throw Error('Public SEO is forbidden in preview/branch contexts.');
 if(production&&process.env.HM_LAUNCH_APPROVED!=='true')throw Error('Public SEO requires HM_LAUNCH_APPROVED=true after testing.');
 const robots=production?'index,follow':'noindex,nofollow';
 const box={window:{}};vm.runInNewContext(fs.readFileSync('public/data.js','utf8'),box);const products=box.window.HM_DATA.materials;
 const urls=[];
 for(const entry of fs.readdirSync(output,{withFileTypes:true})){
  if(!entry.isFile()||!entry.name.endsWith('.html'))continue;
  const file=path.join(output,entry.name),route=entry.name==='index.html'?'/':'/'+entry.name;
  const sourceHtml=fs.readFileSync(file,'utf8');
  const privatePage=!publicEntryPages.has(entry.name)&&hasNoindex(sourceHtml);
  const pageRobots=privatePage?'noindex,nofollow':robots;
  let html=sourceHtml.replace(/<meta\s+name="robots"[^>]*>/gi,'').replace(/<link[^>]*rel="canonical"[^>]*>/gi,'').replace(/https:\/\/(?:www\.)?hmelectricals\.com/g,domain);
  html=html.replace(/<head>/i,'<head>'+`<meta name="robots" content="${pageRobots}"><link rel="canonical" href="${domain}${route}">`);
  // Legacy pages omit an explicit head tag; insert metadata after their html opener.
  if(!html.includes('rel="canonical"'))html=html.replace(/<html[^>]*>/i,m=>m+`<meta name="robots" content="${pageRobots}"><link rel="canonical" href="${domain}${route}">`);
  if(!/name="viewport"/.test(html))html=html.replace(/<meta charset="utf-8">/i,'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
  if(production)html=html.replace(/<div class="private-banner">[\s\S]*?<\/div>/,'');
  if(legacyDescriptions[entry.name]&&!/<meta\s+name=["']description["']/i.test(html)){
   const description=`<meta name="description" content="${escape(legacyDescriptions[entry.name])}">`;
   html=html.replace(/<\/head>/i,description+'</head>');
   if(!/<meta\s+name=["']description["']/i.test(html))html=html.replace(/<html[^>]*>/i,match=>match+description);
  }
  if(entry.name==='index.html'){
   const title='HM ELECTRICAL B2B | Materials & Technicians Mumbai, Thane';
   const description='HM ELECTRICAL supplies electrical materials, cables, MCBs, switches, fire fighting and plumbing materials. Request technicians and labour for Mumbai and Thane sites.';
   html=html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${title}</title>`).replace(/<meta name="description"[^>]*>/i,`<meta name="description" content="${description}">`);
   const company=require('../public/company.json');
   const entity={'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':domain+'/#business',name:'HM ELECTRICAL',alternateName:['HM ELECTRICAL B2B','H M ELECTRICAL'],url:domain+'/',telephone:company.phone,email:company.email,address:{'@type':'PostalAddress',streetAddress:'Ground Floor, A-85, Naik Nagar, Lal Bahadur Shastri Marg, Sion West',addressLocality:'Mumbai',addressRegion:'Maharashtra',postalCode:'400022',addressCountry:'IN'},areaServed:['Mumbai','Thane']},{'@type':'WebSite','@id':domain+'/#website',url:domain+'/',name:'HM ELECTRICAL B2B',publisher:{'@id':domain+'/#business'}}]};
   html=html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'');
   html=html.replace('</head>',`<meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${domain}/"><meta property="og:type" content="website"><meta property="og:image" content="${domain}/photos/company-profile-2026-cover.jpg"><script type="application/ld+json">${jsonLd(entity)}</script></head>`);
  }
  fs.writeFileSync(file,html);
  if(!privatePage)urls.push(route);
 }
 require('./product-illustrations.cjs').generate(output,products);
 const groups=new Map();for(const p of products){if(!groups.has(p.category))groups.set(p.category,[]);groups.get(p.category).push(p);}
 const page=(title,description,route,body,schema)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | HM ELECTRICAL</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${domain}${route}"><link rel="stylesheet" href="/seo.css"><script defer src="/runtime-content.js"></script>${schema?`<script type="application/ld+json">${jsonLd(schema)}</script>`:''}</head><body><header><a href="/">HM ELECTRICAL</a><nav><a href="/materials/">Materials</a><a href="/#enquiry">Request quotation</a></nav></header><main>${body}</main><footer>HM ELECTRICAL · Mumbai · <a href="/asset-policy.html">Image & MRP policy</a> · <a href="/privacy.html">Privacy</a></footer></body></html>`;
 const breadcrumb=(items)=>({'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':items.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.name,item:domain+item.route}))});
 const write=(route,html)=>{const dest=path.join(output,route,'index.html');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);urls.push(route);};
 write('/materials/',page('Electrical & Site Materials in Mumbai','Browse electrical, plumbing, fire fighting, hardware and tools specifications. Request a project quotation.','/materials/','<h1>Material catalogue</h1><p>Browse by category, or use the <a href="/#store">fast catalogue search</a>.</p><div class="grid">'+[...groups].map(([name,items])=>`<a class="card" href="/materials/${slug(name)}/"><h2>${escape(name)}</h2><p>${items.length} specifications</p></a>`).join('')+'</div>',breadcrumb([{name:'Home',route:'/'},{name:'Materials',route:'/materials/'}])));
 for(const [category,items]of groups){const route=`/materials/${slug(category)}/`;write(route,page(category+' Supplier Mumbai',`Explore ${category.toLowerCase()} specifications supplied on enquiry by HM ELECTRICAL, Mumbai.`,route,`<p><a href="/materials/">All categories</a></p><h1>${escape(category)}</h1><p>Compare specifications below. Availability, make, tax and delivery are confirmed by quotation.</p><div class="grid">`+items.map(p=>`<a class="card" href="/products/${slug(p.id+' '+p.name+' '+p.size)}/"><h2>${escape(p.name)}</h2><p>${escape(p.size)} · ${escape(p.unit)}</p><small>${escape(p.id)}</small></a>`).join('')+'</div>',breadcrumb([{name:'Home',route:'/'},{name:'Materials',route:'/materials/'},{name:category,route}])));}
 for(const p of products){
  const route=productRoute(p);
  const categoryRoute=`/materials/${slug(p.category)}/`;
  const description=`${p.name}, ${p.size}, unit ${p.unit}. Request make, availability and a quotation from HM ELECTRICAL, Mumbai.`;
  const hsn=p.hsn||p.hsnCode||p.HSN;
  const specification=p.specification||p.specifications||p.size;
  const details=[
   ['Product code',p.id],
   ...(p.sourceCode?[['Source catalogue code',p.sourceCode]]:[]),
   ['Category',p.category],
   ...(p.group?[['Product group',p.group]]:[]),
   ['Specification',specification],
   ['Unit',p.unit],
   ['Brand / make',p.brand&&p.brand!=='As per enquiry'?p.brand:'As per enquiry; exact brand and model require confirmation.'],
   ...(hsn?[['HSN code',hsn]]:[])
  ];
  const related=(groups.get(p.category)||[]).filter(item=>item.id!==p.id).slice(0,4);
  const crumbs=breadcrumb([{name:'Home',route:'/'},{name:'Materials',route:'/materials/'},{name:p.category,route:categoryRoute},{name:`${p.name} ${p.size}`,route}]);
  const additionalProperty=details.filter(([name])=>name!=='Product code').map(([name,value])=>({'@type':'PropertyValue',name,value}));
  const schema={'@context':'https://schema.org','@graph':[
   {'@type':'Product','@id':domain+route+'#product',url:domain+route,name:`${p.name} ${p.size}`,description,sku:p.id,category:p.category,image:domain+'/photos/products/'+p.id+'.svg',...(additionalProperty.length?{additionalProperty}: {})},
   {'@type':'BreadcrumbList',itemListElement:crumbs.itemListElement}
  ]};
  const descriptionDetails=p.description||p.longDescription||'';
  write(route,page(`${p.name} ${p.size} Supplier Mumbai`,description,route,
   `<p><a href="${categoryRoute}">${escape(p.category)}</a></p><h1>${escape(p.name)} — ${escape(p.size)}</h1><div data-live-product="${escape(p.id)}"><figure class="product-figure"><img src="/photos/products/${escape(p.id)}.svg" width="640" height="480" alt="${escape(p.name+' '+p.size)} representative illustration"><figcaption>Representative illustration. Confirm the exact make and model before ordering.</figcaption></figure></div><dl>${details.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>${descriptionDetails?`<p>${escape(descriptionDetails)}</p>`:'<p>No additional technical description is recorded in the source catalogue; confirm the exact specification with the quotation.</p>'}${hsn?'': '<p>HSN code is not recorded in the source catalogue; confirm the applicable code for the exact item.</p>'}<p class="product-photo-note">Product-specific photograph is not available in the verified catalogue; request an exact make/model image if needed.</p><p><strong>MRP on request</strong></p><p>Manufacturer MRP is published only after the exact brand/model, official source and verification date have been recorded. Selling price, GST, stock and delivery are confirmed in your quotation.</p><a class="button" href="/?product=${encodeURIComponent(p.id)}#enquiry">Enquire about this specification</a><p><a href="https://wa.me/918085560156?text=${encodeURIComponent('Please quote '+p.id+' | '+p.name+' | '+p.size+' | '+p.unit)}">Enquire on WhatsApp</a></p><p>Supply enquiries from contractors, procurement teams and project owners in Mumbai and Thane are welcome. This specification is a catalogue reference; it is not a confirmed stock listing.</p>${related.length?'<section aria-labelledby="related-products"><h2 id="related-products">Related specifications</h2><ul>'+related.map(item=>`<li><a href="${productRoute(item)}">${escape(item.name)} — ${escape(item.size)} (${escape(item.id)})</a></li>`).join('')+'</ul></section>':''}`,schema));
 }
 const tradeDescriptions={Electrician:'Electrical installation, wiring, cable laying and maintenance support.',Plumber:'Water supply, drainage, fixture installation and maintenance support.','Fire Fitter':'Fire-fighting pipework, sprinkler and hydrant installation support.',Welder:'Fabrication, welding and site pipe preparation.',Helper:'Material handling, site support and assistance to trade teams.','Civil Labour':'Civil site work and labour support for agreed project scopes.',Supervisor:'Trade supervision, site coordination and execution support.'};
 const serviceRoot='/hire-technicians-labour/';
 const serviceIntro='<p>HM ELECTRICAL accepts technician and labour enquiries for project sites in Mumbai and Thane. Our office reviews the trade, team size, site location, required date and duration before confirming availability and a proposal.</p><p>Rates, work scope, deployment arrangements and statutory responsibilities are agreed before an engagement. This is an enquiry service; no worker assignment or online payment is confirmed on this page.</p>';
 write(serviceRoot,page('Hire Technicians & Labour in Mumbai and Thane','Request electricians, plumbers, fire fitters, welders, helpers, civil labour and supervisors from HM ELECTRICAL. Availability and scope confirmed by quotation.',serviceRoot,'<h1>Hire technicians & labour in Mumbai and Thane</h1>'+serviceIntro+'<div class="grid">'+Object.entries(tradeDescriptions).map(([trade,description])=>`<a class="card" href="${serviceRoot}${slug(trade)}/"><h2>${trade}</h2><p>${description}</p></a>`).join('')+'</div><p><a class="button" href="/#hire">Request manpower</a></p><p><a href="tel:+918085560156">Call our office: +91 80855 60156</a></p>',breadcrumb([{name:'Home',route:'/'},{name:'Hire technicians & labour',route:serviceRoot}])));
 for(const [trade,description]of Object.entries(tradeDescriptions)){
  const route=serviceRoot+slug(trade)+'/';
  const schema={'@context':'https://schema.org','@graph':[{'@type':'Service',name:trade+' manpower enquiries',serviceType:trade+' / site manpower',description,provider:{'@id':domain+'/#business'},areaServed:[{'@type':'City',name:'Mumbai'},{'@type':'City',name:'Thane'}],url:domain+route},{'@type':'BreadcrumbList',itemListElement:breadcrumb([{name:'Home',route:'/'},{name:'Hire technicians & labour',route:serviceRoot},{name:trade,route}]).itemListElement}]};
  write(route,page(trade+' for Hire in Mumbai and Thane',description+' Request manpower availability and a proposal from HM ELECTRICAL for Mumbai and Thane sites.',route,`<p><a href="${serviceRoot}">All technician & labour categories</a></p><h1>${trade} for your Mumbai or Thane site</h1><p>${description}</p>${serviceIntro}<h2>Share your manpower requirement</h2><ul><li>Number of people and trade skills required</li><li>Site location, access and work scope</li><li>Required date, duration and shift requirements</li><li>Contact name, phone and email for the proposal</li></ul><p><a class="button" href="/#hire">Request ${trade.toLowerCase()} manpower</a></p><p><a href="tel:+918085560156">Call +91 80855 60156</a> · <a href="/materials/">Browse project materials</a></p>`,schema));
 }
 // Crawlable paths remain available without JavaScript.
 for(const name of ['index.html','catalogue.html']){const file=path.join(output,name);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('</footer>','<a href="/materials/">Browse categories and product specifications</a><a href="/hire-technicians-labour/">Hire technicians & labour in Mumbai and Thane</a></footer>'));}
 fs.writeFileSync(path.join(output,'robots.txt'),production?`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /.netlify/\nSitemap: ${domain}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
 fs.writeFileSync(path.join(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>`<url><loc>${domain}${escape(u)}</loc></url>`).join('')+'</urlset>');
 const headers=fs.readFileSync(path.join(output,'_headers'),'utf8');fs.writeFileSync(path.join(output,'_headers'),headers+'\n/admin/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n'+(production?'':'/*\n  X-Robots-Tag: noindex, nofollow\n'));
 console.log(`SEO: ${products.length} product pages, ${groups.size} categories; ${production?'public launch mode':'private staging mode'}.`);
};
