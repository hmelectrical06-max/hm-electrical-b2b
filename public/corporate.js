'use strict';
document.querySelectorAll('[data-enquiry-type]').forEach(link=>link.addEventListener('click',()=>{
 document.getElementById('enquiryType').value=link.dataset.enquiryType;
}));
document.getElementById('toggleGallery')?.addEventListener('click',function(){
 const open=document.getElementById('siteGallery').classList.toggle('expanded');
 this.setAttribute('aria-expanded',String(open));this.textContent=open?'Show selected photographs −':'View all site photographs +';
});
