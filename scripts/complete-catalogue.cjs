'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rows(items){return items.filter(p=>p.hidden!==true).map(p=>`<tr><td>${escape(p.id)}</td><td>${escape(p.sourceCode||p.id)}</td><td>${escape(p.category)}</td><td><a href="/?product=${encodeURIComponent(p.id)}#enquiry">${escape(p.name)}</a></td><td>${escape(p.size||p.scope||'')}</td><td>${escape(p.unit)}</td><td>MRP on request</td></tr>`).join('');}
module.exports={rows,escape};
