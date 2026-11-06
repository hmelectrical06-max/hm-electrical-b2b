'use strict';
window.HM_DOWNLOADS=(()=>{
 const active=[];
 function clear(){for(const item of active)URL.revokeObjectURL(item.url);active.length=0;document.getElementById('adminReadyDownloads')?.remove();}
 function save(blob,filename){
  if(!blob||!blob.size)throw Error('The file is empty. Please retry.');
  const name=String(filename||'HM-ELECTRICAL-file').replace(/[\u0000-\u001f\u007f\\/]/g,'_');
  let panel=document.getElementById('adminReadyDownloads');
  if(!panel){panel=document.createElement('section');panel.id='adminReadyDownloads';panel.className='panel';panel.setAttribute('aria-label','Files ready to save');const title=document.createElement('h2');title.textContent='Files ready';const note=document.createElement('p');note.textContent='If the browser did not start saving, click Save file below. On a phone, check Downloads in your browser menu.';panel.append(title,note);document.getElementById('workspace').prepend(panel);}
  const url=URL.createObjectURL(blob),row=document.createElement('p'),link=document.createElement('a');link.href=url;link.download=name;link.textContent='Save file — '+name;row.append(link);panel.append(row);active.push({url,row});
  while(active.length>5){const old=active.shift();old.row.remove();URL.revokeObjectURL(old.url);}
  // Keep a visible, user-clickable link. Some browsers block a save after an
  // asynchronous fetch; revoking after one second also made retries impossible.
  link.click();return link;
 }
 async function response(r,fallback){const name=r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||fallback;return save(await r.blob(),name);}
 window.addEventListener('pagehide',clear);
 return {save,response,clear};
})();
