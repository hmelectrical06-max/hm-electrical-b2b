'use strict';

const details={
 Plumber:{
  title:'Plumbing repairs and installation enquiries',
  jobs:['Leaking taps, pipe joints and water-supply lines','Tap, washbasin, sink and toilet fixture installation or replacement','Water-supply and drainage pipework for homes, buildings and project sites','GI and PVC fitting requirements alongside the plumbing work'],
  questions:['What is leaking, blocked or being installed?','Which fittings, pipe sizes and preferred makes are involved?','Where is the site and when can it be inspected?','Can you share photographs or a work list with the office?'],
  faq:[['How much does plumbing work cost?','Charges depend on the fault, access, materials, quantity and work scope. Share the requirement first; the office confirms the amount after assessing the work.'],['Can I request only plumbing materials?','Yes. Use the material catalogue for GI or PVC fittings and send the size, quantity and preferred make. Material supply and labour can be quoted separately.'],['Can I request a plumber in Mumbra or Mumbai?','We accept enquiries for both areas. Share the exact site location, required date and scope; our office confirms coverage and availability before booking.']]
 },
 Electrician:{
  title:'Electrical repair and installation enquiries',
  jobs:['Switch, socket, light and fan installation or replacement','Wiring fault enquiries and circuit-protection requirements','Cable laying, termination and building electrical work','Material and labour requirements for maintenance or project work'],
  questions:['What equipment or circuit needs attention?','What quantity, specification and preferred make are required?','Where is the site and what access is available?','What is the required date and expected duration?'],
  faq:[['Are electrical materials included in the labour charge?','Material and labour requirements are reviewed separately. The quotation states the agreed scope, supplied items and exclusions.'],['Is there a fixed electrician rate?','The charge depends on the work and site conditions. Our office confirms a quotation after reviewing the requirement.']]
 }
};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tradeContent(trade){
 const d=details[trade];if(!d)return '';
 return `<section><h2>${esc(d.title)}</h2><ul>${d.jobs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h2>Details that help us prepare your quotation</h2><ul>${d.questions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>Call <a href="tel:+918085560156">+91 80855 60156</a> or <a href="https://wa.me/918085560156?text=${encodeURIComponent('I need '+trade.toLowerCase()+' work. Site location: . Work details: . Required date: .')}">share your ${trade.toLowerCase()} requirement on WhatsApp</a>. No rate, visit or worker assignment is confirmed until our office agrees the scope.</p><h2>Common questions</h2>${d.faq.map(([q,a])=>`<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</section>`;
}
function materialContent(){
 return '<section><h2>Electrical materials, plumbing fittings and fire-fighting supplies</h2><p>Contractors, procurement teams and customers can send one material list or enquire about a single item. Start with the product specification, preferred make, unit and quantity.</p><ul><li><a href="/materials/wires-and-cables/">Wires and cables</a> - conductor size, core count, type and required length.</li><li><a href="/materials/electrical-protection/">MCBs and circuit protection</a> - poles, current rating and preferred make.</li><li><a href="/materials/switches-and-sockets/">Switches and sockets</a> - module, rating, colour and series.</li><li><a href="/materials/plumbing-and-phe/">GI and PVC plumbing materials</a> - fitting type, pipe size, connection and quantity.</li><li><a href="/materials/fire-fighting/">Fire-fighting materials</a> - exact project specification and required make.</li></ul><h2>How to request material supply</h2><ol><li>Search the catalogue and add the required products and quantities to your enquiry.</li><li>Send your delivery location in Mumbai, Mumbra or Thane and the required date.</li><li>Our office checks the make, availability and supplier rate, then confirms selling price, GST, delivery and payment terms in a quotation.</li></ol><p>Catalogue entries are specification references, not a promise of ready stock. For an item not listed, send your BOQ or item description through the <a href="/#enquiry">material enquiry form</a>.</p><p>Need installation as well? Request an <a href="/hire-technicians-labour/electrician/">electrician</a>, <a href="/hire-technicians-labour/plumber/">plumber</a> or <a href="/hire-technicians-labour/">site labour team</a>. Work charges depend on the scope and site assessment.</p></section>';
}
module.exports={tradeContent,materialContent};
