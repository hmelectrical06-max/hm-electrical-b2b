"use strict";
const email=document.createElement('a');email.id='sendEmail';email.className='btn';email.textContent='Open email draft ↗';email.href='mailto:hmelectrical06@gmail.com';document.getElementById('sendWhatsApp').after(email);
const originalUpdateMessage=updateMessage;updateMessage=function(){originalUpdateMessage();email.href='mailto:hmelectrical06@gmail.com?subject='+encodeURIComponent('B2B enquiry | HM ELECTRICAL')+'&body='+encodeURIComponent(message);};
render();
