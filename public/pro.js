'use strict';
const productPhoto = p=>p.verifiedProductPhoto?'Verified product photo; confirm final order specification':'Representative illustration; exact make/model to confirm';
function enhanceCatalogue(){document.querySelectorAll('#results .product-card').forEach(card=>{const id=card.querySelector('[data-add]')?.dataset.add,p=item(id);if(!p)return;card.querySelector('.photo-label')?.remove();const note=document.createElement('p');note.className='photo-label';note.textContent=productPhoto(p);card.querySelector('.code').after(note);card.querySelector('.market-ref')?.remove();});}
const proRender=render;render=function(){proRender();enhanceCatalogue();};
const lanes=[['Wires & cables','Wires and Cables','⌁'],['Switchgear','Electrical Protection','ϟ'],['Conduit & fittings','Conduit and Accessories','⌑'],['Cable trays','Cable Management','▤'],['Lighting','Lighting','◉'],['Site hardware','Fasteners and Hardware','⚙']];
$('quickCategories').innerHTML=lanes.map(([label,category,icon])=>`<button class="quick-category" data-quick="${e(category)}"><span class="quick-category-icon" aria-hidden="true">${icon}</span><strong>${label}</strong><small>${D.materials.filter(p=>p.category===category).length} catalogue specifications</small></button>`).join('');
$('quickCategories').addEventListener('click',ev=>{const button=ev.target.closest('[data-quick]');if(!button)return;state.category=button.dataset.quick;state.page=1;for(const id of ['search','group','product','size'])$(id).value='';categoryButtons();cascade();render();$('store').scrollIntoView();});
render();
