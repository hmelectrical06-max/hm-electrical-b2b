'use strict';
(() => {
 const $ = id => document.getElementById(id);
 const categories = [
  ['Wires and Cables','Wires & Cables','wires-and-cables'],
  ['Plumbing and PHE','Pipes & Plumbing','plumbing-and-phe'],
  ['Electrical Protection','MCB & Protection','electrical-protection'],
  ['Switches and Sockets','Switches & Sockets','switches-and-sockets'],
  ['Lighting','Lighting','lighting'],
  ['Tools and Machinery','Power Tools','tools-and-machinery'],
  ['Fasteners and Hardware','Hardware & Fasteners','fasteners-and-hardware'],
  ['Conduit and Accessories','Conduit & Fittings','conduit-and-accessories']
 ];
 function selectCategory(category) {
  $('clear')?.click();
  const button = [...document.querySelectorAll('#categories button')].find(b => b.textContent.trim() === category || b.dataset.category === category);
  if (button) button.click();
  else {
   const input = $('search');
   input.value = category;
   input.dispatchEvent(new Event('input', {bubbles:true}));
  }
  $('store').scrollIntoView({behavior:'smooth'});
 }
 const grid = $('storefrontCategories');
 // Header search always searches the complete catalogue, including after browsing a category.
 document.querySelector('.header-search')?.addEventListener('submit', () => $('clear')?.click(), true);
 if (grid) {
  for (const [category,label,asset] of categories) {
   const button = document.createElement('button');
   button.type = 'button'; button.className = 'storefront-category';
   button.dataset.storefrontCategory = category;
   button.innerHTML = `<img src="/photos/illustrations/${asset}.svg" alt="" width="220" height="160" loading="lazy"><span>${label}</span><small>Explore range <span aria-hidden="true">→</span></small>`;
   button.addEventListener('click', () => selectCategory(category));
   grid.append(button);
  }
 }
 function arrange() {
  const hero = document.querySelector('.hero-copy');
  if (hero) {
   hero.querySelector('h1').innerHTML = 'Your materials.<br><em>Your site team.</em>';
   hero.querySelector('.intro').textContent = 'Electrical, plumbing, hardware and power tools for your next job. Explore our catalogue or tell us what your project needs.';
   hero.querySelector('.actions').innerHTML = '<a class="btn" href="#store">Browse materials →</a><a class="outline-btn" href="' + ($('hire') ? '#hire' : '/hire-technicians-labour/') + '">Hire technicians →</a>';
  }
  const store = $('store'), categoriesSection = $('shopCategories'), hire = $('hire');
  if (store && categoriesSection && store.previousElementSibling !== categoriesSection) categoriesSection.after(store);
  if (store && hire && hire.previousElementSibling !== store) store.after(hire);
  const count = window.HM_DATA?.materials?.length;
  if (count) $('storefrontCount').textContent = new Intl.NumberFormat('en-IN').format(count) + ' catalogue specifications';
  const products = window.HM_LIVE_CONTENT?.products || [];
  const references = [
   ['Wires and Cables', /cable|wire/i], ['Plumbing and PHE', /pipe/i],
   ['Electrical Protection', /MCB/i], ['Fasteners and Hardware', /rod|bolt|fastener/i]
  ];
  for (const [category, match] of references) {
   const product = products.find(p => p.category === category && match.test(p.name) && p.verifiedProductPhoto && !p.hidden);
   if (!product) continue;
   const card = document.querySelector('[data-storefront-category="' + category + '"] img');
   if (card) {card.src = product.verifiedProductPhoto;card.alt = product.name + ' category reference photo';}
   const asset = categories.find(c => c[0] === category)?.[2];
   const heroImage = asset && document.querySelector('.storefront-visual img[src$="/' + asset + '.svg"]');
   if (heroImage) {heroImage.src = product.verifiedProductPhoto;heroImage.alt = product.name + ' reference photo';}
  }
 }
 // Content refresh can mount the existing manpower section after the initial render.
 document.addEventListener('hm:content', arrange);
 const stylesheet = document.querySelector('link[href^="/storefront.css"]');
 if (stylesheet) document.head.append(stylesheet);
 arrange();
})();
