'use strict';
{
 const register=window.HM_PROJECTS; let status='All';
 const featured=['site-04.jpeg','site-08.jpeg','site-19.jpeg','site-23.jpeg','site-12.jpeg','site-26.jpeg'];
 function setupHeader(){
  const header=document.querySelector('body > header'),nav=header?.querySelector('nav[aria-label="Main navigation"]');
  if(!header||!nav)return;
  if(!document.querySelector('link[data-hm-upgrade-styles]')){
   const stylesheet=document.createElement('link');
   stylesheet.rel='stylesheet';stylesheet.href='b2b-upgrade.css';stylesheet.dataset.hmUpgradeStyles='true';
   document.head.append(stylesheet);
  }
  nav.id='hm-main-navigation';
  const menu=document.createElement('button');
  menu.type='button';menu.className='mobile-nav-toggle';menu.setAttribute('aria-controls',nav.id);menu.setAttribute('aria-expanded','false');menu.textContent='Menu';
  const search=document.createElement('form');
  search.className='header-search';search.setAttribute('role','search');
  search.innerHTML='<label class="sr-only" for="headerProductSearch">Search the product catalogue</label><input id="headerProductSearch" type="search" placeholder="Search products, codes or sizes" autocomplete="off"><button type="submit" aria-label="Search catalogue">Search</button>';
  header.insertBefore(search,nav);header.insertBefore(menu,nav);
  const closeMenu=()=>{nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');};
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  nav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  document.addEventListener('click',event=>{if(!header.contains(event.target))closeMenu();});
  search.addEventListener('submit',event=>{
   event.preventDefault();
   const input=$('search'),query=$('headerProductSearch').value.trim();
   if(!input)return;
   input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));
   $('store')?.scrollIntoView({behavior:'smooth'});closeMenu();
  });
 }
 function addSupplierSection(){
  const anchor=$('solutions');
  if(!anchor||$('supplier-introduction'))return;
  const section=document.createElement('section');
  section.id='supplier-introduction';section.className='supplier-introduction';
  section.innerHTML='<div><p class="eyebrow">A CONTROLLED SUPPLIER PROCESS</p><h2>Built around clear specifications.</h2><p>We review material requirements and preferred makes directly with each business. Supplier information is not published as a verified directory, and supplier accounts are not offered through this website.</p></div><a class="btn" href="#enquiry" data-enquiry-type="Material order request" data-supplier-interest>Discuss supplier interest ↗</a>';
  anchor.after(section);
  section.querySelector('[data-supplier-interest]').addEventListener('click',()=>{
   const details=$('details'),type=$('enquiryType');
   if(details)details.value='Supplier interest: please contact me to discuss a supplier review.';
   if(type)type.value='Material order request';
  });
 }
 function addContractingLanes(){
  const anchor=$('services');
  if(!anchor||$('contracting-lanes'))return;
  const lanes=[
   ['Electrical HT / LT','Electrical','Cable laying, termination and electrical work scopes from the existing catalogue.'],
   ['Fire Fighting','Fire Fighting','Fire-fighting work items available for project enquiry.'],
   ['Plumbing / PHE','Plumbing / PHE','Plumbing and public health engineering work items available for enquiry.'],
   ['HVAC','HVAC','Share the drawings, site and scope for an individual review.'],
   ['Civil labour services','Civil','Discuss labour-only scope, location and programme for review.']
  ];
  const section=document.createElement('section');
  section.id='contracting-lanes';section.className='contracting-lanes';
  section.innerHTML='<div class="section-head"><div><p class="eyebrow">PROJECT CONTRACTING</p><h2>Trade scopes, reviewed individually.</h2></div><p>Scope, availability, rates and programme are confirmed in a project-specific quotation.</p></div><div class="contracting-lane-grid">'+lanes.map(([title,query,description])=>`<button class="contracting-lane" type="button" data-service-query="${e(query)}"><span>${e(title)}</span><p>${e(description)}</p><strong>Discuss this scope <span aria-hidden="true">↗</span></strong></button>`).join('')+'</div>';
  section.querySelectorAll('[data-service-query]').forEach(button=>button.addEventListener('click',()=>{
   const query=button.dataset.serviceQuery,search=$('serviceSearch');
   if(search){search.value=query;search.dispatchEvent(new Event('input',{bubbles:true}));}
   $('services')?.scrollIntoView({behavior:'smooth'});
   if(!D.services.some(item=>(item.category+' '+item.section+' '+item.name).toLowerCase().includes(query.toLowerCase()))){
    const details=$('details'),type=$('enquiryType');
    if(details)details.value=`Please discuss ${button.querySelector('span').textContent} scope, location and required programme.`;
    if(type)type.value='Site contracting';
    $('enquiry')?.scrollIntoView({behavior:'smooth'});
   }
  }));
  anchor.before(section);
 }
 register.gallery.sort((a,b)=>{const rank=x=>{const n=featured.indexOf(x.src.split('/').pop());return n<0?100:n;};return rank(a)-rank(b);});
 function projects(){const q=$('projectSearch').value;const list=register.projects.filter(p=>(status==='All'||p.status===status)&&matches(p.name+' '+p.client,q));$('projectCount').textContent=`${list.length} project records`; $('projectList').innerHTML=list.map(p=>`<article class="register-row"><div><span class="status-pill ${p.status==='Running'?'running':''}">${e(p.status)}</span><h3>${e(p.name)}</h3></div><p>${e(p.client||'Client not listed')}</p></article>`).join('')||'<p>No matching projects.</p>';}
 document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{status=b.dataset.status;document.querySelectorAll('[data-status]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));projects();});
 $('projectSearch').addEventListener('input',projects);projects();
 $('siteGallery').innerHTML=register.gallery.map((p,i)=>`<button class="site-shot" type="button" data-shot="${i}"><img src="${e(p.src)}" alt="${e(p.caption)}" loading="lazy"><span>${e(p.caption)} <b aria-hidden="true">↗</b></span></button>`).join('');
 $('siteGallery').onclick=ev=>{const b=ev.target.closest('[data-shot]');if(!b)return;const p=register.gallery[Number(b.dataset.shot)];$('largePhoto').src=p.src;$('largePhoto').alt=p.caption;$('photoCaption').textContent=p.caption;$('lightbox').showModal();};
 $('closeLightbox').onclick=()=>$('lightbox').close();
 $('lightbox').addEventListener('click',ev=>{if(ev.target===$('lightbox'))$('lightbox').close();});
 setupHeader();addSupplierSection();addContractingLanes();
}
