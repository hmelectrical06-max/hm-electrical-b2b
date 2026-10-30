'use strict';
(()=>{
  const form=document.getElementById('serviceBookingForm');
  if(!form)return;
  const status=document.getElementById('serviceBookingStatus');
  const submit=form.querySelector('button[type="submit"]');
  const photo=document.getElementById('servicePhoto');
  const maxPhotoBytes=2*1024*1024;
  const allowedTypes=['image/jpeg','image/png','image/webp'];
  function setMinimumPreferredTime(){
    const minTimestamp=Math.ceil((Date.now()+5*60*1000)/60000)*60000;
    document.getElementById('preferredAt').min=new Date(minTimestamp-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  setMinimumPreferredTime();
  form.addEventListener('input',()=>{
    if(status.classList.contains('booking-success')){
      status.textContent='';
      status.classList.remove('booking-success');
    }
  });

  function base64(buffer){
    const bytes=new Uint8Array(buffer);
    let binary='';
    for(let offset=0;offset<bytes.length;offset+=0x8000){
      binary+=String.fromCharCode(...bytes.subarray(offset,Math.min(offset+0x8000,bytes.length)));
    }
    return btoa(binary);
  }
  photo.addEventListener('change',()=>{
    const file=photo.files?.[0];
    if(!file)return;
    if(!allowedTypes.includes(file.type)||file.size>maxPhotoBytes||file.size===0){
      photo.value='';
      status.textContent='Choose a JPEG, PNG or WebP photo no larger than 2 MB.';
      return;
    }
    status.textContent=`Photo ready: ${file.name} (${(file.size/1024).toFixed(0)} KB).`;
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    setMinimumPreferredTime();
    const preferredAt=new Date(document.getElementById('preferredAt').value);
    if(!Number.isFinite(preferredAt.getTime())||preferredAt.getTime()<Date.now()+5*60*1000){
      status.textContent='Choose a preferred date and time at least five minutes from now.';
      return;
    }
    if(!form.reportValidity())return;
    const file=photo.files?.[0];
    if(file&&(!allowedTypes.includes(file.type)||file.size>maxPhotoBytes||file.size===0)){
      status.textContent='Choose a JPEG, PNG or WebP photo no larger than 2 MB.';
      return;
    }
    submit.disabled=true;
    status.classList.remove('booking-success');
    status.textContent='Saving your service request…';
    try{
      const payload={
        name:document.getElementById('serviceName').value.trim(),
        mobile:document.getElementById('serviceMobile').value.trim(),
        category:document.getElementById('serviceCategory').value,
        description:document.getElementById('serviceDescription').value.trim(),
        area:document.getElementById('serviceArea').value.trim(),
        address:document.getElementById('serviceAddress').value.trim(),
        preferredAt:preferredAt.toISOString(),
        consent:document.getElementById('serviceConsent').checked
      };
      if(file)payload.photo={type:file.type,data:base64(await file.arrayBuffer())};
      const response=await fetch('/.netlify/functions/service-booking',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        signal:AbortSignal.timeout(35000)
      });
      let result=null;
      try{result=await response.json();}catch{}
      if(!response.ok||result?.ok!==true||typeof result.reference!=='string')throw new Error(typeof result?.message==='string'?result.message:'The booking could not be saved. Please try again.');
      form.reset();
      setMinimumPreferredTime();
      status.textContent=`${result.message} Keep reference ${result.reference} for follow-up.`;
      status.classList.add('booking-success');
    }catch(error){
      status.classList.remove('booking-success');
      status.textContent=error?.name==='TimeoutError'?'The service timed out before confirming your booking. Please retry.':error?.message||'The booking service could not be reached. Please retry.';
    }finally{
      submit.disabled=false;
    }
  });
})();
