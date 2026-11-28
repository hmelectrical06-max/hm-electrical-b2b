'use strict';
(()=>{
 const table=document.querySelector('[data-complete-catalogue]');if(!table)return;
 const body=table.tBodies[0],summary=document.getElementById('catalogueSummary'),search=document.getElementById('completeCatalogueSearch'),status=document.getElementById('catalogueStatus');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function filter(){const query=search.value.trim().toLowerCase(),terms=query.split(/\s+/).filter(Boolean);let shown=0;for(const row of body.rows){const text=row.textContent.toLowerCase();row.hidden=!terms.every(term=>text.includes(term));if(!row.hidden)shown++;}status.textContent=shown.toLocaleString('en-IN')+' matching specifications';}
 search.addEventListener('input',filter);
 document.addEventListener('hm:content',event=>{
  const content=event.detail;if(!Array.isArray(content.products))return;
  const products=content.products.filter(p=>p.hidden!==true),services=Array.isArray(content.services)?content.services:[];
  summary.textContent=products.length.toLocaleString('en-IN')+' materials + '+services.length.toLocaleString('en-IN')+' services. Only verified manufacturer MRP is displayed; otherwise MRP is on request.';
  body.innerHTML=[...products,...services].map(p=>{
   const verified=Number(p.mrp)>0&&p.mrpSourceUrl&&p.mrpVerifiedAt;
   const price=verified?'₹'+Number(p.mrp).toLocaleString('en-IN',{maximumFractionDigits:2}):'MRP on request';
   return `<tr><td>${esc(p.id)}</td><td>${esc(p.sourceCode||p.id)}</td><td>${esc(p.category)}</td><td><a href="/?product=${encodeURIComponent(p.id)}#enquiry">${esc(p.name)}</a></td><td>${esc(p.size||p.scope||'')}</td><td>${esc(p.unit)}</td><td>${esc(price)}</td></tr>`;
  }).join('');filter();
 });
 filter();
})();
