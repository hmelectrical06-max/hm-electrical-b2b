'use strict';
const $=id=>document.getElementById(id),endpoint='/.netlify/functions/',statuses=['New','Contacted','Quotation Sent','Confirmed','Closed'],perPage=50,photoPageSize=24,cataloguePageSize=25,inventoryPageSize=30;
const unreadKey='hm-admin-notification-unread',seenKey='hm-admin-notification-seen',cursorKey='hm-admin-notification-cursor';
let page=0,photoPage=0,cataloguePage=0,inventoryPage=0,inventoryHistoryPage=0,quotationPage=0,busy=false,products=[],catalogueRows=[],inventoryRows=[],inventoryHistory=[],quotationRows=[],quotationLines=[],quotationEnquiries=[],quotationProductOptions=new Map(),quotationProductById=new Map(),quotationTaxMetadata=new Map(),pendingCatalogueCsv='',inventoryBusy=false,inventoryRequestKey='',inventoryRequestFingerprint='',quotationBusy=false,quotationStatus='',photoAudit={},notificationTimer=null,notificationBusy=false,notificationEvents=[];
const illustrations={
 'Cable Management':'../photos/illustrations/cable-management.svg',
 'Cable Termination':'../photos/illustrations/cable-termination.svg',
 'Conduit and Accessories':'../photos/illustrations/conduit-and-accessories.svg',
 'Control and Automation':'../photos/illustrations/control-and-automation.svg',
 'Earthing and Lightning':'../photos/illustrations/earthing-and-lightning.svg',
 'Electrical Distribution':'../photos/illustrations/electrical-distribution.svg',
 'Electrical Protection':'../photos/illustrations/electrical-protection.svg',
 'Fasteners and Hardware':'../photos/illustrations/fasteners-and-hardware.svg',
 'Fire Fighting':'../photos/illustrations/fire-fighting.svg',
 'Lighting':'../photos/illustrations/lighting.svg',
 'Plumbing and PHE':'../photos/illustrations/plumbing-and-phe.svg',
 'Safety and Consumables':'../photos/illustrations/safety-and-consumables.svg',
 'Switches and Sockets':'../photos/illustrations/switches-and-sockets.svg',
 'Tools and Machinery':'../photos/illustrations/tools-and-machinery.svg',
 'Wires and Cables':'../photos/illustrations/wires-and-cables.svg'
};
function showLogin(){stopNotificationPolling();$('login').hidden=false;$('workspace').hidden=true;$('rows').replaceChildren();}
function endpointUnavailable(){if(location.protocol==='file:')return'Admin API unavailable: this page was opened as a local file. Start the project with Netlify Dev and open its local HTTP URL (for example, http://localhost:8888/admin/). Static previews do not run Netlify Functions.';return'Admin API unavailable: the Netlify Function could not be reached. Confirm Netlify Dev is running and open the admin page through that same local site origin; a static file server does not provide /.netlify/functions/.';}
async function api(name,options={}){let r;try{r=await fetch(endpoint+name,{credentials:'same-origin',cache:'no-store',...options});}catch{throw Error(endpointUnavailable());}if(r.status===401){showLogin();}if(!r.ok){let message='Request failed.';try{const type=r.headers.get('content-type')||'';if(type.includes('application/json')){const b=await r.json();message=b.message||message;}else if(r.status===404||r.status===403)message=endpointUnavailable();}catch{}throw Error(message);}return r;}
const json=(method,data)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function readStoredIds(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(item=>typeof item==='string'):[];}catch(error){console.warn('Admin notification state could not be read from browser storage.');return[];}}
function writeStoredValue(key,value){try{localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));}catch(error){console.warn('Admin notification state could not be saved in browser storage.');}}
function updateNotificationBadge(){const count=readStoredIds(unreadKey).length;$('notificationCount').textContent=count>99?'99+':String(count);$('notificationCount').setAttribute('aria-label',`${count} unread notifications`);$('notificationCount').hidden=count===0;}
function markNotificationRead(id){writeStoredValue(unreadKey,readStoredIds(unreadKey).filter(item=>item!==id));updateNotificationBadge();renderNotifications();}
function renderNotifications(){
  const list=$('notificationList'),unread=readStoredIds(unreadKey),byId=new Map(notificationEvents.map(item=>[item.id,item]));
  list.replaceChildren();
  const available=unread.map(id=>byId.get(id)).filter(Boolean);
  if(!available.length){
    const empty=document.createElement('li');empty.className='notification-empty';empty.textContent=unread.length?'Unread notifications are older than the latest activity window.':'No unread notifications.';list.append(empty);return;
  }
  for(const item of available){
    const li=document.createElement('li'),button=document.createElement('button'),title=document.createElement('strong'),body=document.createElement('span'),time=document.createElement('time');
    button.type='button';button.className='notification-item';title.textContent=item.title;body.textContent=item.body;time.dateTime=item.created_at;time.textContent=new Date(item.created_at).toLocaleString();
    button.append(title,body,time);button.onclick=()=>{markNotificationRead(item.id);setView(item.kind==='booking'?'serviceBookings':'enquiries');$('notificationsPanel').hidden=true;$('notificationBell').setAttribute('aria-expanded','false');};
    li.append(button);list.append(li);
  }
}
function showDesktopNotification(item){
  if(!('Notification'in window)||Notification.permission!=='granted')return;
  try{
    const notification=new Notification(item.title,{body:item.body.slice(0,220),tag:item.id});
    notification.onclick=()=>{window.focus();markNotificationRead(item.id);setView(item.kind==='booking'?'serviceBookings':'enquiries');notification.close();};
  }catch(error){$('notificationMessage').textContent='Desktop notification could not be displayed. Check browser notification settings.';}
}
async function pollNotifications(){
  if(notificationBusy||$('workspace').hidden)return;
  notificationBusy=true;
  try{
    const data=await(await api('admin-notifications')).json(),events=Array.isArray(data.notifications)?data.notifications:[];
    const cursor=localStorage.getItem(cursorKey),cursorTime=Date.parse(cursor||'');
    const seen=new Set(readStoredIds(seenKey));
    const added=cursor&&Number.isFinite(cursorTime)?events.filter(item=>!seen.has(item.id)&&Date.parse(item.created_at)>=cursorTime):[];
    const unread=new Set(readStoredIds(unreadKey));
    for(const item of added){unread.add(item.id);showDesktopNotification(item);}
    writeStoredValue(unreadKey,[...unread].slice(-100));
    writeStoredValue(seenKey,[...seen,...events.map(item=>item.id)].slice(-500));
    writeStoredValue(cursorKey,typeof data.observedAt==='string'?data.observedAt:new Date().toISOString());
    notificationEvents=events;
    const updated=added.length?`${added.length} new notification${added.length===1?'':'s'} received.`:'New enquiries and bookings refresh while you are signed in.';
    $('notificationMessage').textContent=[updated,...(Array.isArray(data.warnings)?data.warnings:[])].join(' ');
    updateNotificationBadge();renderNotifications();
  }catch(error){$('notificationMessage').textContent='Could not refresh notifications: '+error.message;}
  finally{notificationBusy=false;}
}
function startNotificationPolling(){stopNotificationPolling();updateNotificationBadge();pollNotifications();notificationTimer=setInterval(pollNotifications,30000);}
function stopNotificationPolling(){if(notificationTimer!==null){clearInterval(notificationTimer);notificationTimer=null;}}
async function enableDesktopNotifications(){
  const button=$('desktopNotifications');
  if(!('Notification'in window)){$('notificationMessage').textContent='This browser does not support desktop notifications.';return;}
  button.disabled=true;
  try{
    const permission=await Notification.requestPermission();
    button.textContent=permission==='granted'?'Desktop notifications enabled':'Enable desktop notifications';
    $('notificationMessage').textContent=permission==='granted'?'Desktop notifications are enabled for this browser.':permission==='denied'?'Notifications are blocked. Allow them in this site’s browser settings.':'Notification permission was not granted.';
  }catch(error){$('notificationMessage').textContent='Could not request notification permission. Check browser settings.';}
  finally{button.disabled=false;}
}
function params(){return new URLSearchParams({q:$('query').value,status:$('status').value,from:$('from').value,to:$('to').value,page:String(page)});}
function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td;}
function setView(name){for(const view of ['overview','enquiries','catalogue','quotations','inventory','serviceBookings','photos']){$(view+'View').hidden=view!==name;document.querySelector(`[data-view="${view}"]`).setAttribute('aria-current',view===name?'page':'false');}if(name==='enquiries')load();if(name==='catalogue')loadCatalogue();if(name==='quotations')loadQuotations();if(name==='inventory')loadInventory();if(name==='photos')renderPhotos();if(name==='serviceBookings')loadServiceBookings();}
async function loadOverview(){
  $('metricProducts').textContent=String(products.length);$('statusSummary').replaceChildren();
  const [enquiries,quotations,inventory]=await Promise.allSettled([
    api('admin-enquiries?overview=1').then(response=>response.json()),
    api('admin-quotations?view=summary').then(response=>response.json()),
    api('admin-inventory?view=summary').then(response=>response.json())
  ]);
  if(enquiries.status==='fulfilled'){
    const data=enquiries.value;$('metricProducts').textContent=String(data.products);$('metricEnquiries').textContent=String(data.enquiries);
    for(const status of statuses){const item=document.createElement('div'),label=document.createElement('span'),count=document.createElement('strong');item.className='status-metric';label.textContent=status;count.textContent=String(data.statuses[status]??0);item.append(label,count);$('statusSummary').append(item);}
  }else{
    $('metricEnquiries').textContent='Unavailable';
    const note=document.createElement('p');note.textContent=enquiries.reason.message;$('statusSummary').append(note);
  }
  $('metricQuotations').textContent=quotations.status==='fulfilled'?String(quotations.value.counts?.draft??0):'Setup required';
  $('metricInventory').textContent=inventory.status==='fulfilled'?String(inventory.value.products_with_stock??0):'Setup required';
}
async function load(){if(busy)return;busy=true;$('message').textContent='Loading enquiries…';try{const b=await(await api('admin-enquiries?'+params())).json();$('login').hidden=true;$('workspace').hidden=false;$('rows').replaceChildren();for(const r of b.rows){const tr=document.createElement('tr');cell(tr,new Date(r.created_at).toLocaleString()+'\n'+r.id);cell(tr,r.name+(r.company_name?'\nCompany: '+r.company_name:'')+'\n'+r.phone+'\n'+(r.email||'Email not supplied'));cell(tr,r.items.length?r.items.map(i=>`${i.id} | ${i.name} ${i.size}\n${i.qty} ${i.unit}`).join('\n\n'):'No catalogue items');cell(tr,r.location+(r.required_date?'\nRequired by: '+r.required_date:'')+'\n'+r.type+'\n'+r.details);const td=cell(tr,''),select=document.createElement('select');select.setAttribute('aria-label','Status for '+r.name);for(const status of statuses){const option=document.createElement('option');option.value=option.textContent=status;select.append(option);}select.value=r.status;select.onchange=async()=>{select.disabled=true;try{await api('admin-enquiries',json('PATCH',{id:r.id,status:select.value}));r.status=select.value;$('message').textContent='Status saved.';loadOverview();}catch(error){select.value=r.status;$('message').textContent=error.message;}finally{select.disabled=false;}};td.append(select);cell(tr,r.email_status==='accepted'?'Provider accepted':'Pending retry');$('rows').append(tr);}$('prev').disabled=page===0;$('next').disabled=!b.more;$('page').textContent='Page '+(page+1);$('message').textContent=b.rows.length?'Showing '+b.rows.length+' enquiries.':'No matching enquiries.';}catch(error){$('message').textContent=error.message;}finally{busy=false;}}
function catalogueSearchRows(){const query=$('catalogueQuery').value.trim().toLowerCase();if(!query)return catalogueRows;return catalogueRows.filter(row=>[row.id,row.sourceCode,row.name,row.size,row.unit,row.category,row.brand,row.metadata?.brand,row.metadata?.manufacturer,row.metadata?.manufacturer_sku,row.metadata?.hsn].join(' ').toLowerCase().includes(query));}
function catalogueValue(field,value){
  if(value===null||value===undefined||value==='')return'—';
  if(['mrp','purchase_price','retail_price','wholesale_price'].includes(field))return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value));
  if(field==='gst_rate')return`${value}%`;
  if(field==='minimum_wholesale_quantity')return new Intl.NumberFormat('en-IN',{maximumFractionDigits:3}).format(Number(value));
  return String(value);
}
function renderCatalogue(){
  const rows=catalogueSearchRows(),pages=Math.max(1,Math.ceil(rows.length/cataloguePageSize));
  cataloguePage=Math.min(cataloguePage,pages-1);
  const selected=rows.slice(cataloguePage*cataloguePageSize,(cataloguePage+1)*cataloguePageSize),body=$('catalogueRows');
  body.replaceChildren();
  for(const product of selected){
    const meta=product.metadata||{},tr=document.createElement('tr');
    const values=[
      ['product_id',`${product.id}\n${product.sourceCode||''}`],
      ['name',`${product.name} · ${product.size} ${product.unit}`],
      ['brand',meta.brand||product.brand],
      ['manufacturer_sku',meta.manufacturer_sku],
      ['hsn',meta.hsn],
      ['gst_rate',meta.gst_rate],
      ['mrp',meta.mrp],
      ['purchase_price',meta.purchase_price],
      ['retail_price',meta.retail_price],
      ['wholesale_price',meta.wholesale_price],
      ['minimum_wholesale_quantity',meta.minimum_wholesale_quantity],
      ['availability',meta.availability],
      ['public_price_mode',meta.public_price_mode]
    ];
    for(const [field,value] of values)cell(tr,catalogueValue(field,value));
    body.append(tr);
  }
  $('catalogueCount').textContent=`Showing ${selected.length} of ${rows.length} matching products · ${catalogueRows.length} total`;
  $('cataloguePage').textContent=`Page ${cataloguePage+1} / ${pages}`;
  $('cataloguePrev').disabled=cataloguePage===0;
  $('catalogueNext').disabled=cataloguePage>=pages-1;
}
async function loadCatalogue(){
  $('catalogueCount').textContent='Loading catalogue…';
  try{
    const result=await(await api('admin-catalogue')).json();
    const publicProducts=new Map(products.map(product=>[product.id,product]));
    catalogueRows=Array.isArray(result.products)?result.products.map(row=>({...publicProducts.get(row.id),...row})):[];
    cataloguePage=0;renderCatalogue();
  }catch(error){$('catalogueCount').textContent=error.message;$('catalogueRows').replaceChildren();}
}
function quotationMoney(value){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);}
function quoteProductLabel(product){return`${product.sourceCode||product.id} · ${product.name} · ${product.size} ${product.unit}`;}
function initQuotationProducts(){
  const list=$('quotationProductOptions'),fragment=document.createDocumentFragment();
  for(const product of products){
    const option=document.createElement('option'),label=quoteProductLabel(product);
    option.value=label;fragment.append(option);
    quotationProductOptions.set(label,product);
    quotationProductById.set(product.id,product);
  }
  list.replaceChildren(fragment);
}
async function loadQuotationOptions(){
  const results=await Promise.allSettled([
    api('admin-catalogue').then(response=>response.json()),
    api('admin-quotations?view=enquiries').then(response=>response.json())
  ]);
  if(results[0].status==='fulfilled'){
    quotationTaxMetadata=new Map((results[0].value.products||[])
      .filter(product=>product.metadata?.gst_rate!==null&&product.metadata?.gst_rate!==undefined)
      .map(product=>[product.id,product.metadata]));
  }else{
    quotationTaxMetadata=new Map();
    $('quotationMessage').textContent='Verified product tax data is unavailable. No GST rates will be guessed.';
  }
  if(results[1].status==='fulfilled'){
    quotationEnquiries=results[1].value.rows||[];
    const select=$('quotationEnquiry'),placeholder=select.options[0],fragment=document.createDocumentFragment();
    select.replaceChildren(placeholder);
    for(const enquiry of quotationEnquiries){
      const option=document.createElement('option');
      option.value=enquiry.id;
      option.textContent=`${enquiry.name} · ${enquiry.phone} · ${new Date(enquiry.created_at).toLocaleDateString('en-IN')}`;
      fragment.append(option);
    }
    select.append(fragment);
  }else{
    $('quotationMessage').textContent='Existing enquiries could not be loaded. You can still create a quotation manually.';
  }
}
function setQuoteField(id,value){$(id).value=value??'';}
function setQuotationMode(mode){
  $('quotationId').value=mode?.quotation_id||'';
  $('quotationRevisionMode').value=String(Boolean(mode?.allow_revision));
  quotationStatus=mode?.status||'draft';
  $('quotationFormTitle').textContent=mode?.quotation_number
    ?`${mode.quotation_number} · revision ${mode.allow_revision?'next':mode.revision}${mode.allow_revision||mode.status!=='draft'?' revision draft':' draft'}`
    :'New quotation draft';
  $('quotationRevisionNote').textContent=mode?.allow_revision
    ?'This quotation is being revised. Saving creates the next revision; the existing saved snapshot remains unchanged.'
    :mode?.status&&mode.status!=='draft'
    ?`This quote is ${mode.status}. Saving creates revision ${Number(mode.revision)+1}; the previous revision remains in history.`
    :'Saving records a new immutable quotation revision. Rates are entered manually; GST requires verified tax sources.';
  $('saveQuotation').textContent=mode?.allow_revision||mode?.status&&mode.status!=='draft'?'Save new revision':'Save draft';
  $('quotationEnquiry').value=mode?.source_enquiry_id||'';
}
function renderQuotationLines(){
  const body=$('quotationLines'),fragment=document.createDocumentFragment();
  quotationLines.forEach((line,index)=>{
    const tr=document.createElement('tr');
    const productCell=document.createElement('td');
    if(line.item_type==='product'){
      const input=document.createElement('input');
      input.type='search';input.setAttribute('list','quotationProductOptions');input.value=line.product_id?quoteProductLabel(quotationProductById.get(line.product_id)||{id:line.product_id,name:'',size:'',unit:''}):'';
      input.placeholder='Search exact catalogue product';input.setAttribute('aria-label',`Catalogue product line ${index+1}`);
      input.addEventListener('input',()=>{
        const product=quotationProductOptions.get(input.value);
        line.product_id=product?.id||'';
        line.description=product?`${product.name} · ${product.size}`:'';
        line.unit=product?.unit||'';
        line.product_code=product?.sourceCode||product?.id||'';
        updateQuotationTotals();
      });
      productCell.append(input);
      const description=document.createElement('small');description.className='muted';
      description.textContent=line.product_id?`${line.product_code} · ${line.description}`:'Select one exact material catalogue product.';
      productCell.append(description);
    }else{
      const description=document.createElement('input');description.type='text';description.maxLength=300;description.placeholder='Custom work / service description';description.value=line.description||'';
      description.addEventListener('input',()=>{line.description=description.value;updateQuotationTotals();});
      const unit=document.createElement('input');unit.type='text';unit.maxLength=40;unit.placeholder='Unit (job, hour, etc.)';unit.value=line.unit||'';
      unit.addEventListener('input',()=>{line.unit=unit.value;});
      productCell.append(description,unit);
    }
    const quantity=document.createElement('input');quantity.type='number';quantity.min='0.001';quantity.max='1000000';quantity.step='0.001';quantity.value=line.quantity??1;quantity.setAttribute('aria-label',`Quantity line ${index+1}`);
    quantity.addEventListener('input',()=>{line.quantity=quantity.value===''?'':Number(quantity.value);updateQuotationTotals();});
    const unitCell=document.createElement('td');unitCell.textContent=line.item_type==='product'?(line.unit||'—'):'Custom';
    const rate=document.createElement('input');rate.type='number';rate.min='0';rate.max='999999999999';rate.step='0.01';rate.value=line.unit_rate??'';rate.setAttribute('aria-label',`Unit rate line ${index+1}`);
    rate.addEventListener('input',()=>{line.unit_rate=rate.value===''?'':Number(rate.value);updateQuotationTotals();});
    const discount=document.createElement('input');discount.type='number';discount.min='0';discount.max='999999999999';discount.step='0.01';discount.value=line.discount_amount??0;discount.setAttribute('aria-label',`Discount line ${index+1}`);
    discount.addEventListener('input',()=>{line.discount_amount=discount.value===''?'':Number(discount.value);updateQuotationTotals();});
    const taxCell=document.createElement('td'),taxMode=$('quotationTaxMode').value;
    if(taxMode==='none'){
      taxCell.textContent='Not applied';
    }else if(line.item_type==='product'){
      const metadata=quotationTaxMetadata.get(line.product_id);
      if(metadata?.gst_rate!==undefined&&metadata?.gst_rate!==null&&metadata.tax_source_url&&metadata.tax_verified_at){
        line.tax_rate=Number(metadata.gst_rate);line.tax_source_url=metadata.tax_source_url;line.tax_verified_at=metadata.tax_verified_at;
        taxCell.textContent=`${line.tax_rate}% verified · ${metadata.tax_verified_at}`;
      }else{
        line.tax_rate=null;
        taxCell.textContent='Verified product GST source required';
      }
    }else{
      const taxRate=document.createElement('input');taxRate.type='number';taxRate.min='0';taxRate.max='100';taxRate.step='0.01';taxRate.placeholder='GST %';taxRate.value=line.tax_rate??'';taxRate.setAttribute('aria-label',`Verified service GST rate line ${index+1}`);
      taxRate.addEventListener('input',()=>{line.tax_rate=taxRate.value===''?'':Number(taxRate.value);updateQuotationTotals();});
      const source=document.createElement('input');source.type='url';source.placeholder='Verified HTTPS tax source';source.value=line.tax_source_url||'';source.setAttribute('aria-label',`Service tax source URL line ${index+1}`);
      source.addEventListener('input',()=>{line.tax_source_url=source.value;});
      const verified=document.createElement('input');verified.type='date';verified.value=line.tax_verified_at||'';verified.setAttribute('aria-label',`Tax verification date line ${index+1}`);
      verified.addEventListener('input',()=>{line.tax_verified_at=verified.value;});
      taxCell.append(taxRate,source,verified);
    }
    const amount=document.createElement('td');amount.className='quotation-line-total';amount.textContent='—';
    const action=document.createElement('td'),remove=document.createElement('button');remove.type='button';remove.className='button-secondary';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove quotation line ${index+1}`);
    remove.addEventListener('click',()=>{quotationLines.splice(index,1);renderQuotationLines();updateQuotationTotals();});
    action.append(remove);
    for(const cell of [productCell,quantity,unitCell,rate,discount,taxCell,amount,action]){
      if(cell.tagName!=='TD'){const wrapper=document.createElement('td');wrapper.append(cell);tr.append(wrapper);}
      else tr.append(cell);
    }
    tr.dataset.lineIndex=String(index);fragment.append(tr);
  });
  body.replaceChildren(fragment);
  updateQuotationTotals();
}
function updateQuotationTotals(){
  const mode=$('quotationTaxMode').value,totals={subtotal:0,discount:0,taxable:0,cgst:0,sgst:0,igst:0,freight:Number($('quotationFreight').value)||0,other:Number($('quotationOtherCharges').value)||0};
  let complete=quotationLines.length>0;
  for(const [index,line] of quotationLines.entries()){
    const amountCell=$('quotationLines').querySelector(`[data-line-index="${index}"] .quotation-line-total`);
    if(amountCell)amountCell.textContent='—';
    if(line.quantity===''||line.unit_rate===''||line.item_type==='product'&&!line.product_id
      ||line.item_type==='service'&&(!line.description?.trim()||!line.unit?.trim())){complete=false;continue;}
    const quantity=Number(line.quantity),rate=Number(line.unit_rate),discount=Number(line.discount_amount)||0;
    if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(rate)||rate<0){complete=false;continue;}
    const gross=Math.round((quantity*rate+Number.EPSILON)*100)/100;
    if(discount>gross){complete=false;continue;}
    const taxable=Math.round((gross-discount+Number.EPSILON)*100)/100;
    let taxRate=0;
    if(mode!=='none'){
      if(line.item_type==='product'){
        const metadata=quotationTaxMetadata.get(line.product_id);
        if(!metadata||metadata.gst_rate===null||!metadata.tax_source_url||!metadata.tax_verified_at){complete=false;continue;}
        taxRate=Number(metadata.gst_rate);
      }else{
        if(line.tax_rate===''||!Number.isFinite(Number(line.tax_rate))||!line.tax_source_url||!line.tax_verified_at){complete=false;continue;}
        taxRate=Number(line.tax_rate);
      }
    }
    const tax=Math.round((taxable*taxRate/100+Number.EPSILON)*100)/100;
    if(amountCell)amountCell.textContent=quotationMoney(taxable+tax);
    totals.subtotal=Math.round((totals.subtotal+gross+Number.EPSILON)*100)/100;
    totals.discount=Math.round((totals.discount+discount+Number.EPSILON)*100)/100;
    totals.taxable=Math.round((totals.taxable+taxable+Number.EPSILON)*100)/100;
    if(mode==='intra_state'){const half=Math.round((tax/2+Number.EPSILON)*100)/100;totals.cgst+=half;totals.sgst+=tax-half;}
    if(mode==='inter_state')totals.igst+=tax;
  }
  const grand=Math.round((totals.taxable+totals.cgst+totals.sgst+totals.igst+totals.freight+totals.other+Number.EPSILON)*100)/100;
  const box=$('quotationTotals');box.replaceChildren();
  const rows=[
    ['Subtotal',totals.subtotal],['Discount',totals.discount],['Taxable value',totals.taxable],
    ...(mode==='intra_state'?[['CGST',totals.cgst],['SGST',totals.sgst]]:[]),
    ...(mode==='inter_state'?[['IGST',totals.igst]]:[]),
    ['Freight',totals.freight],['Other charges',totals.other],['Grand total',grand]
  ];
  for(const [label,value] of rows){
    const item=document.createElement('p'),strong=document.createElement('strong');
    item.textContent=label;strong.textContent=quotationMoney(value);item.append(strong);box.append(item);
  }
  if(!complete){const note=document.createElement('p');note.className='muted';note.textContent='Enter each quantity and rate; GST quotations also require verified tax sources. No total is final until the server validates the draft.';box.append(note);}
}
function quotationPayload(){
  const mode=$('quotationTaxMode').value;
  return {
    customer_name:$('quotationCustomerName').value,company_name:$('quotationCompanyName').value,
    mobile:$('quotationMobile').value,email:$('quotationEmail').value,
    customer_gstin:$('quotationCustomerGstin').value,
    billing_address:$('quotationBillingAddress').value,shipping_address:$('quotationShippingAddress').value,
    place_of_supply:$('quotationPlaceOfSupply').value,tax_mode:mode,
    valid_until:$('quotationValidUntil').value,payment_terms:$('quotationPaymentTerms').value,
    delivery_terms:$('quotationDeliveryTerms').value,warranty_terms:$('quotationWarrantyTerms').value,
    notes:$('quotationNotes').value,freight:Number($('quotationFreight').value||0),
    other_charges:Number($('quotationOtherCharges').value||0),
    source_enquiry_id:$('quotationSourceEnquiry').value||null,
    items:quotationLines.map(line=>({
      item_type:line.item_type,product_id:line.product_id,
      description:line.description,unit:line.unit,quantity:line.quantity===''?null:Number(line.quantity),
      unit_rate:line.unit_rate===''?null:Number(line.unit_rate),discount_amount:Number(line.discount_amount||0),
      tax_rate:mode==='none'||line.tax_rate===''?null:Number(line.tax_rate),
      tax_source_url:line.tax_source_url||null,tax_verified_at:line.tax_verified_at||null
    }))
  };
}
function resetQuotationForm(){
  $('quotationForm').reset();$('quotationId').value='';$('quotationSourceEnquiry').value='';
  $('quotationRevisionMode').value='false';$('quotationEnquiry').value='';
  $('quotationFreight').value='0';$('quotationOtherCharges').value='0';
  quotationStatus='draft';quotationLines=[newQuotationLine('product')];
  setQuotationMode(null);renderQuotationLines();$('quotationMessage').textContent='';
}
function newQuotationLine(itemType){
  return {item_type:itemType,product_id:'',description:'',unit:'',quantity:1,unit_rate:'',discount_amount:0,tax_rate:'',tax_source_url:'',tax_verified_at:''};
}
function fillQuotationFromEnquiry(enquiry){
  $('quotationSourceEnquiry').value=enquiry?.id||'';
  setQuoteField('quotationCustomerName',enquiry?.name||'');
  setQuoteField('quotationMobile',enquiry?.phone||'');
  setQuoteField('quotationEmail',enquiry?.email||'');
  setQuoteField('quotationBillingAddress',enquiry?.location||'');
  setQuoteField('quotationShippingAddress',enquiry?.location||'');
  $('quotationNotes').value=enquiry?`Source enquiry ${enquiry.id}${enquiry.details?': '+enquiry.details:''}`:'';
  quotationLines=(Array.isArray(enquiry?.items)?enquiry.items:[]).map(item=>({
    ...newQuotationLine('product'),product_id:item.id,
    quantity:Number(item.qty)||1
  }));
  if(!quotationLines.length)quotationLines=[newQuotationLine('product')];
  renderQuotationLines();
}
async function loadQuotation(id,allowRevision=false,revision=null){
  $('quotationMessage').textContent='Loading quotation…';
  try{
    const suffix=revision===null?'':'&revision='+encodeURIComponent(revision);
    const result=await(await api('admin-quotations?id='+encodeURIComponent(id)+suffix)).json(),quote=result.quotation;
    $('quotationForm').reset();
    for(const [field,input] of Object.entries({
      quotationCustomerName:'customer_name',quotationCompanyName:'company_name',quotationMobile:'mobile',
      quotationEmail:'email',quotationCustomerGstin:'customer_gstin',quotationBillingAddress:'billing_address',
      quotationShippingAddress:'shipping_address',quotationPlaceOfSupply:'place_of_supply',
      quotationValidUntil:'valid_until',quotationPaymentTerms:'payment_terms',
      quotationDeliveryTerms:'delivery_terms',quotationWarrantyTerms:'warranty_terms',quotationNotes:'notes',
      quotationFreight:'freight',quotationOtherCharges:'other_charges'
    }))$(field).value=quote[input]??'';
    $('quotationTaxMode').value=quote.tax_mode||'none';
    $('quotationId').value=quote.quotation_id;
    $('quotationSourceEnquiry').value=quote.source_enquiry_id||'';
    $('quotationRevisionMode').value=String(allowRevision);
    quotationStatus=quote.status;
    quotationLines=(quote.items||[]).map(item=>({
      item_type:item.item_type,product_id:item.product_id||'',description:item.item_type==='service'?item.description:'',
      unit:item.item_type==='service'?item.unit:'',quantity:Number(item.quantity),unit_rate:Number(item.unit_rate),
      discount_amount:Number(item.discount_amount),tax_rate:item.tax_rate===null?'':Number(item.tax_rate),
      tax_source_url:item.tax_source_url||'',tax_verified_at:item.tax_verified_at||''
    }));
    setQuotationMode({...quote,allow_revision:allowRevision});
    renderQuotationLines();
    const history=quote.versions||[];
    const historyBox=$('quotationHistory'),historyList=$('quotationHistoryRows');
    historyList.replaceChildren();
    for(const version of history){
      const item=document.createElement('li'),text=document.createElement('span'),actions=document.createElement('span'),pdf=document.createElement('button'),edit=document.createElement('button');
      text.textContent=`Revision ${version.revision} · ${new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(version.created_at))} IST`;
      pdf.type='button';pdf.className='button-secondary';pdf.textContent='PDF';pdf.onclick=()=>downloadQuotationPdf(quote.quotation_id,version.revision);
      edit.type='button';edit.className='button-secondary';edit.textContent=version.revision===quote.revision?'Current':'Load as new revision';
      edit.disabled=version.revision===quote.revision;edit.onclick=()=>loadQuotation(quote.quotation_id,true,version.revision);
      actions.append(pdf,edit);item.append(text,actions);historyList.append(item);
    }
    historyBox.hidden=!quote.quotation_id||history.length===0;
    $('quotationMessage').textContent=`Loaded ${quote.quotation_number}, revision ${quote.revision}. ${history.length} saved revision(s) in history.`;
    $('quotationForm').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){$('quotationMessage').textContent=error.message;}
}
async function loadQuotations(){
  if(quotationBusy)return;
  quotationBusy=true;$('quotationMessage').textContent='Loading quotations…';
  try{
    await loadQuotationOptions();
    const result=await(await api('admin-quotations?page='+quotationPage)).json();
    quotationRows=result.rows||[];$('quotationRows').replaceChildren();
    for(const quote of quotationRows){
      const tr=document.createElement('tr'),date=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(quote.created_at));
      cell(tr,`${quote.quotation_number} · Rev ${quote.revision}`);
      cell(tr,`${quote.customer_name}${quote.company_name?'\n'+quote.company_name:''}`);
      cell(tr,date+' IST');cell(tr,quote.status.toUpperCase());cell(tr,quotationMoney(quote.grand_total));
      const actions=cell(tr,''),download=document.createElement('button');download.type='button';download.className='button-secondary';download.textContent='PDF';download.onclick=()=>downloadQuotationPdf(quote.quotation_id);actions.append(download);
      const edit=document.createElement('button');edit.type='button';edit.className='button-secondary';edit.textContent=quote.status==='draft'?'Edit':'Revise';edit.onclick=()=>loadQuotation(quote.quotation_id,quote.status!=='draft');actions.append(edit);
      if(quote.status==='draft'){
        const sent=document.createElement('button');sent.type='button';sent.className='button-secondary';sent.textContent='Mark sent';sent.title='Records manual status only; does not send a customer message.';sent.onclick=()=>changeQuotationStatus(quote,'sent');actions.append(sent);
      }else if(quote.status==='sent'){
        for(const status of ['accepted','rejected']){
          const button=document.createElement('button');button.type='button';button.className='button-secondary';button.textContent=status[0].toUpperCase()+status.slice(1);button.onclick=()=>changeQuotationStatus(quote,status);actions.append(button);
        }
      }
    }
    $('quotationPage').textContent=`Page ${quotationPage+1}`;
    $('quotationPrev').disabled=quotationPage===0;
    $('quotationNext').disabled=quotationRows.length<30;
    if(!quotationRows.length)$('quotationMessage').textContent='No saved quotations yet. Create a draft above.';
    else if(!$('quotationMessage').textContent.startsWith('Verified product tax'))$('quotationMessage').textContent=`Showing ${quotationRows.length} saved quotation(s).`;
  }catch(error){
    $('quotationMessage').textContent=error.message;$('quotationRows').replaceChildren();
  }finally{quotationBusy=false;}
}
async function saveQuotation(event){
  event.preventDefault();
  const button=$('saveQuotation'),id=$('quotationId').value||null;
  button.disabled=true;$('quotationMessage').textContent='Validating and saving draft…';
  try{
    const result=await(await api('admin-quotations',json('POST',{
      action:'save',quotation_id:id,allow_revision:$('quotationRevisionMode').value==='true',
      quotation:quotationPayload()
    }))).json();
    const quote=result.quotation;
    $('quotationId').value=quote.quotation_id;
    $('quotationRevisionMode').value='false';quotationStatus='draft';
    setQuotationMode({...quote,allow_revision:false});
    $('quotationMessage').textContent=`Saved ${quote.quotation_number}, revision ${quote.revision}. No inventory was reserved or deducted.`;
    await loadQuotations();
  }catch(error){$('quotationMessage').textContent=error.message;}
  finally{button.disabled=false;}
}
async function changeQuotationStatus(quote,status){
  const action=status==='sent'?'Mark this quotation as sent? This will not contact the customer.':`Record quotation as ${status}?`;
  if(!window.confirm(action))return;
  try{
    await api('admin-quotations',json('POST',{action:'change-status',quotation_id:quote.quotation_id,status}));
    $('quotationMessage').textContent=`${quote.quotation_number} status updated to ${status}. No customer message was sent.`;
    await loadQuotations();
  }catch(error){$('quotationMessage').textContent=error.message;}
}
async function downloadQuotationPdf(id,revision=null){
  try{
    const query=new URLSearchParams({id});if(revision!==null)query.set('revision',String(revision));
    const response=await api('admin-quotation-pdf?'+query),blob=await response.blob();
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'hm-quotation.pdf';
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('quotationMessage').textContent='Quotation PDF downloaded. It is not a tax invoice; review before sharing.';
  }catch(error){$('quotationMessage').textContent=error.message;}
}
function applyEnquiryToQuotation(){
  const enquiry=quotationEnquiries.find(row=>row.id===$('quotationEnquiry').value);
  fillQuotationFromEnquiry(enquiry||null);
}
function inventoryQuantity(value){return new Intl.NumberFormat('en-IN',{maximumFractionDigits:3}).format(Number(value)||0);}
function inventorySearchRows(){const query=$('inventoryQuery').value.trim().toLowerCase();return query?inventoryRows.filter(row=>[row.id,row.sourceCode,row.name,row.size,row.category].join(' ').toLowerCase().includes(query)):inventoryRows;}
function renderInventory(){
  const rows=inventorySearchRows(),pages=Math.max(1,Math.ceil(rows.length/inventoryPageSize));
  inventoryPage=Math.min(inventoryPage,pages-1);
  const selected=rows.slice(inventoryPage*inventoryPageSize,(inventoryPage+1)*inventoryPageSize),body=$('inventoryRows');
  body.replaceChildren();
  for(const product of selected){
    const tr=document.createElement('tr'),initialized=product.on_hand!==null&&product.on_hand!==undefined;
    const available=initialized?Number(product.on_hand)-Number(product.reserved):null;
    cell(tr,`${product.id}\n${product.sourceCode||''}`);
    cell(tr,`${product.name} · ${product.size} ${product.unit}`);
    cell(tr,product.category);
    cell(tr,initialized?`${inventoryQuantity(product.on_hand)} ${product.unit}`:'Not recorded');
    cell(tr,initialized?`${inventoryQuantity(product.reserved)} ${product.unit}`:'—');
    cell(tr,initialized?`${inventoryQuantity(available)} ${product.unit}`:'—');
    cell(tr,product.updated_at?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(product.updated_at))+' IST':'No stock movements');
    body.append(tr);
  }
  $('inventoryCount').textContent=`Showing ${selected.length} of ${rows.length} matching products · ${inventoryRows.length} total`;
  $('inventoryPage').textContent=`Page ${inventoryPage+1} / ${pages}`;
  $('inventoryPrev').disabled=inventoryPage===0;
  $('inventoryNext').disabled=inventoryPage>=pages-1;
}
async function loadInventoryHistory(){
  $('inventoryHistoryMessage').textContent='Loading movement history…';
  try{
    const data=await(await api('admin-inventory?view=movements&page='+inventoryHistoryPage)).json();
    inventoryHistory=data.rows||[];$('inventoryHistoryRows').replaceChildren();
    for(const movement of inventoryHistory){
      const tr=document.createElement('tr'),product=inventoryRows.find(item=>item.id===movement.product_id);
      cell(tr,`${new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(movement.created_at))} IST\n${movement.product_id} · ${product?.name||'Catalogue product'}`);
      cell(tr,movement.movement_type.replaceAll('_',' '));
      const delta=Number(movement.on_hand_delta),unit=product?.unit||'';
      cell(tr,`${delta>0?'+':''}${inventoryQuantity(delta)} ${unit}`);
      cell(tr,`${movement.reference_type} · ${movement.reference_id}`);
      cell(tr,movement.note||'—');
    }
    $('inventoryHistoryPage').textContent=`Page ${inventoryHistoryPage+1}`;
    $('inventoryHistoryPrev').disabled=inventoryHistoryPage===0;
    $('inventoryHistoryNext').disabled=inventoryHistory.length<50;
    $('inventoryHistoryMessage').textContent=inventoryHistory.length?'Showing recent stock movements.':'No stock movements recorded.';
  }catch(error){$('inventoryHistoryMessage').textContent=error.message;$('inventoryHistoryRows').replaceChildren();}
}
async function loadInventory(){
  if(inventoryBusy)return;
  inventoryBusy=true;$('inventoryCount').textContent='Loading stock balances…';
  try{
    const data=await(await api('admin-inventory')).json();
    inventoryRows=Array.isArray(data.rows)?data.rows:[];
    inventoryPage=0;renderInventory();await loadInventoryHistory();
  }catch(error){$('inventoryCount').textContent=error.message;$('inventoryRows').replaceChildren();}
  finally{inventoryBusy=false;}
}
function initInventoryProducts(){
  const select=$('inventoryProduct'),fragment=document.createDocumentFragment();
  $('inventoryQuantity').min='0.001';
  for(const product of products){
    const option=document.createElement('option');
    option.value=product.id;option.textContent=`${product.id} · ${product.name} · ${product.size} ${product.unit}`;
    fragment.append(option);
  }
  select.append(fragment);
}
async function recordInventoryMovement(event){
  event.preventDefault();
  const button=$('saveInventoryMovement'),movement={
    product_id:$('inventoryProduct').value,
    movement_type:$('inventoryMovementType').value,
    quantity:Number($('inventoryQuantity').value),
    reference_type:$('inventoryReferenceType').value,
    reference_id:$('inventoryReferenceId').value.trim(),
    note:$('inventoryNote').value.trim()
  };
  const fingerprint=JSON.stringify(movement);
  try{
    if(!window.crypto?.randomUUID)throw Error('This browser cannot create a secure movement request ID. Use an up-to-date browser.');
    if(fingerprint!==inventoryRequestFingerprint){inventoryRequestFingerprint=fingerprint;inventoryRequestKey=window.crypto.randomUUID();}
    button.disabled=true;$('inventoryMessage').textContent='Recording stock movement…';
    const result=await(await api('admin-inventory',json('POST',{...movement,idempotency_key:inventoryRequestKey}))).json();
    $('inventoryMessage').textContent=`Stock movement recorded for ${result.product_id}.`;
    inventoryRequestKey='';inventoryRequestFingerprint='';$('inventoryMovementForm').reset();
    await loadInventory();
  }catch(error){$('inventoryMessage').textContent=error.message;}
  finally{button.disabled=false;}
}
async function exportCatalogueCsv(){
  const button=$('exportCatalogueCsv');button.disabled=true;
  try{
    const response=await api('admin-catalogue?format=csv'),blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='hm-catalogue-metadata.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('catalogueImportMessage').textContent='CSV export downloaded. Blank fields are intentionally unknown.';
  }catch(error){$('catalogueImportMessage').textContent=error.message;}
  finally{button.disabled=false;}
}
async function previewCatalogueImport(){
  const file=$('catalogueCsvFile').files?.[0],button=$('previewCatalogueCsv');
  if(!file){$('catalogueImportMessage').textContent='Choose a CSV file first.';return;}
  if(file.size>3*1024*1024){$('catalogueImportMessage').textContent='CSV exceeds the 3 MB limit.';return;}
  button.disabled=true;$('saveCatalogueCsv').disabled=true;$('catalogueImportErrors').replaceChildren();
  try{
    pendingCatalogueCsv=await file.text();
    const result=await(await api('admin-catalogue',json('POST',{action:'preview-import',csv:pendingCatalogueCsv}))).json();
    $('catalogueImportMessage').textContent=`Preview complete: ${result.valid} valid row(s), ${result.invalid.length} issue(s), out of ${result.total}. Nothing has been saved yet.`;
    for(const item of result.invalid.slice(0,30)){
      const li=document.createElement('li');li.textContent=`Row ${item.line}: ${item.message}`;$('catalogueImportErrors').append(li);
    }
    if(result.invalid.length>30){const li=document.createElement('li');li.textContent=`${result.invalid.length-30} additional validation issues not shown.`;$('catalogueImportErrors').append(li);}
    $('saveCatalogueCsv').disabled=result.valid===0||result.invalid.length>0;
  }catch(error){pendingCatalogueCsv='';$('catalogueImportMessage').textContent=error.message;}
  finally{button.disabled=false;}
}
async function saveCatalogueImport(){
  if(!pendingCatalogueCsv)return;
  const button=$('saveCatalogueCsv');button.disabled=true;
  try{
    const result=await(await api('admin-catalogue',json('POST',{action:'save-import',csv:pendingCatalogueCsv}))).json();
    $('catalogueImportMessage').textContent=`Saved metadata for ${result.saved} product(s). Existing product records and IDs were not changed.`;
    $('catalogueCsvFile').value='';pendingCatalogueCsv='';$('catalogueImportErrors').replaceChildren();await loadCatalogue();
  }catch(error){$('catalogueImportMessage').textContent=error.message;}
  finally{button.disabled=!pendingCatalogueCsv;}
}
function csvCell(value){const text=String(value??'');return '"'+(/^[\s]*[=+\-@]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';}
function downloadCsv(filename,rows){const content='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function downloadEnquiries(format){const button=$(format);button.disabled=true;try{const p=params();p.set('format',format);const r=await api('admin-enquiries?'+p),blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hm-enquiries.'+(format==='csv'?'csv':'xml');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('message').textContent='Export downloaded. Excel export uses Excel XML workbook format.';}catch(error){$('message').textContent=error.message;}finally{button.disabled=false;}}
let servicePage=0,serviceBusy=false,serviceTechnicians=[];
const serviceStatuses=['New','Assigned','In Progress','Completed','Cancelled'],paymentStatuses=['Pending','Partially paid','Paid','Not applicable'],technicianAvailability=['Available','Busy','Unavailable'];
function control(labelText,element){const label=document.createElement('label'),name=document.createElement('span');name.textContent=labelText;label.append(name,element);return label;}
function selectControl(values,value){const select=document.createElement('select');for(const item of values){const option=document.createElement('option');option.value=item;option.textContent=item;select.append(option);}select.value=value;return select;}
function serviceField(labelText,value){const element=document.createElement('p');element.className='service-booking-field';const label=document.createElement('strong');label.textContent=labelText+': ';element.append(label,document.createTextNode(value||'—'));return element;}
async function loadServiceBookings(){if(serviceBusy)return;serviceBusy=true;$('serviceBookingsMessage').textContent='Loading service bookings…';try{const query=new URLSearchParams({view:'bookings',page:String(servicePage)});if($('serviceBookingFilter').value)query.set('status',$('serviceBookingFilter').value);const data=await(await api('admin-service-bookings?'+query)).json();serviceTechnicians=data.technicians||[];$('serviceBookingList').replaceChildren();for(const booking of data.rows||[])$('serviceBookingList').append(serviceBookingCard(booking));$('serviceBookingPage').textContent='Page '+(servicePage+1);$('serviceBookingPrev').disabled=servicePage===0;$('serviceBookingNext').disabled=!data.more;$('serviceBookingsMessage').textContent=data.rows?.length?`Showing ${data.rows.length} service bookings.`:'No matching service bookings.';}catch(error){$('serviceBookingsMessage').textContent=error.message;}finally{serviceBusy=false;}}
function serviceBookingCard(booking){const card=document.createElement('article');card.className='service-booking-card';const heading=document.createElement('div');heading.className='service-booking-card-head';const title=document.createElement('h3');title.textContent=booking.reference+' · '+booking.status;const created=document.createElement('time');created.dateTime=booking.created_at;created.textContent=new Date(booking.created_at).toLocaleString();heading.append(title,created);card.append(heading);const details=document.createElement('div');details.className='service-booking-details';const preferred=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(booking.preferred_at))+' IST (requested)';for(const [label,value] of [['Customer',booking.customer_name],['Mobile',booking.mobile],['Service',booking.category],['Description',booking.description],['Area',booking.area],['Address',booking.address],['Preferred time',preferred],['Payment status',booking.payment_status]])details.append(serviceField(label,value));if(booking.photoUrl){const photo=document.createElement('a');photo.href=booking.photoUrl;photo.target='_blank';photo.rel='noopener noreferrer';photo.textContent='Open private work photo (expires in 5 minutes)';photo.className='service-photo-link';details.append(photo);}card.append(details);const editor=document.createElement('div');editor.className='service-booking-editor';const status=selectControl(serviceStatuses,booking.status);editor.append(control('Status',status));const assignments=[{id:'',name:'Unassigned',is_active:true},...serviceTechnicians.filter(person=>person.is_active&&person.availability==='Available')];if(booking.technician&&(!booking.technician.is_active||booking.technician.availability!=='Available'))assignments.push({...booking.technician,name:booking.technician.name+' (currently unavailable)'});const assign=document.createElement('select');for(const person of assignments){const option=document.createElement('option');option.value=person.id;option.textContent=person.name+(person.trade?' · '+person.trade:'');assign.append(option);}assign.value=booking.technician_id||'';assign.dataset.original=assign.value;editor.append(control('Assign technician',assign));const quoted=document.createElement('input');quoted.type='number';quoted.min='0';quoted.max='10000000';quoted.step='0.01';quoted.value=booking.quoted_charge??'';editor.append(control('Quoted charge (₹)',quoted));const final=document.createElement('input');final.type='number';final.min='0';final.max='10000000';final.step='0.01';final.value=booking.final_charge??'';editor.append(control('Final charge (₹)',final));const payment=selectControl(paymentStatuses,booking.payment_status);editor.append(control('Payment status',payment));const save=document.createElement('button');save.type='button';save.textContent='Save booking updates';save.onclick=async()=>{save.disabled=true;$('serviceBookingsMessage').textContent='Saving booking updates…';const payload={action:'update-booking',id:booking.id,status:status.value,quotedCharge:quoted.value===''?null:Number(quoted.value),finalCharge:final.value===''?null:Number(final.value),paymentStatus:payment.value};if(assign.value!==assign.dataset.original)payload.technicianId=assign.value||null;try{await api('admin-service-bookings',json('PATCH',payload));$('serviceBookingsMessage').textContent='Booking updates saved.';await loadServiceBookings();}catch(error){$('serviceBookingsMessage').textContent=error.message;}finally{save.disabled=false;}};editor.append(save);card.append(editor);return card;}
async function loadTechnicians(){if(serviceBusy)return;serviceBusy=true;$('techniciansMessage').textContent='Loading technician roster…';try{const data=await(await api('admin-service-bookings?view=technicians')).json();const list=data.technicians||[];$('technicianList').replaceChildren();for(const technician of list)$('technicianList').append(technicianCard(technician));$('techniciansMessage').textContent=`${list.length} of 10 technician records used. Assigned jobs count active Assigned and In Progress bookings.`;}catch(error){$('techniciansMessage').textContent=error.message;}finally{serviceBusy=false;}}
function technicianCard(technician){const card=document.createElement('article');card.className='technician-card';const title=document.createElement('h3');title.textContent=technician.name;const jobs=document.createElement('p');jobs.textContent=`${technician.assignedJobs} assigned / in-progress jobs · ${technician.trade}`;card.append(title,jobs);const editor=document.createElement('div');editor.className='technician-editor';const name=document.createElement('input');name.maxLength=120;name.value=technician.name;editor.append(control('Name',name));const mobile=document.createElement('input');mobile.type='tel';mobile.maxLength=20;mobile.value=technician.mobile;editor.append(control('Mobile',mobile));const trade=document.createElement('input');trade.maxLength=100;trade.value=technician.trade;editor.append(control('Trade',trade));const availability=selectControl(technicianAvailability,technician.availability);editor.append(control('Availability',availability));const active=document.createElement('input');active.type='checkbox';active.checked=technician.is_active;const activeLabel=control('Accept new assignments',active);activeLabel.classList.add('technician-active');editor.append(activeLabel);const save=document.createElement('button');save.type='button';save.textContent='Save technician';save.onclick=async()=>{save.disabled=true;$('techniciansMessage').textContent='Saving technician…';try{await api('admin-service-bookings',json('PATCH',{action:'update-technician',id:technician.id,name:name.value.trim(),mobile:mobile.value.trim(),trade:trade.value.trim(),availability:availability.value,isActive:active.checked}));$('techniciansMessage').textContent='Technician record saved.';await loadTechnicians();}catch(error){$('techniciansMessage').textContent=error.message;}finally{save.disabled=false;}};editor.append(save);card.append(editor);return card;}
document.querySelectorAll('[data-service-panel]').forEach(button=>button.addEventListener('click',()=>{for(const panel of ['bookings','technicians']){$(panel==='bookings'?'serviceBookingsPanel':'techniciansPanel').hidden=panel!==button.dataset.servicePanel;document.querySelector(`[data-service-panel="${panel}"]`).setAttribute('aria-current',panel===button.dataset.servicePanel?'page':'false');}if(button.dataset.servicePanel==='bookings')loadServiceBookings();else loadTechnicians();}));
$('serviceBookingFilter').addEventListener('change',()=>{servicePage=0;loadServiceBookings();});
function photoProducts(){const q=$('photoQuery').value.toLowerCase().trim(),category=$('photoCategory').value,broken=$('photoStatus').value==='broken';return products.filter(p=>{const source='../'+(p.referenceImage||p.referenceIllustration||p.image||'photos/catalogue-placeholder.svg'),display=illustrations[p.category]||'../photos/catalogue-placeholder.svg';return(!category||p.category===category)&&(!q||[p.id,p.name,p.category,p.brand,p.size].join(' ').toLowerCase().includes(q))&&(!broken||photoAudit[source]===false||photoAudit[display]===false);});}
function renderPhotos(){const list=photoProducts(),pages=Math.max(1,Math.ceil(list.length/photoPageSize));photoPage=Math.min(photoPage,pages-1);const pageRows=list.slice(photoPage*photoPageSize,(photoPage+1)*photoPageSize);$('photoList').replaceChildren();for(const product of pageRows){const card=document.createElement('article'),image=document.createElement('img'),info=document.createElement('div'),name=document.createElement('h3'),meta=document.createElement('p'),status=document.createElement('span');card.className='photo-row';image.src=illustrations[product.category]||'../photos/catalogue-placeholder.svg';image.alt=product.category+' illustration placeholder';image.loading='lazy';name.textContent=product.name;meta.textContent=`${product.id} · ${product.category} · ${product.size} · ${product.brand}`;status.className='photo-status';status.textContent='Product photo needed · placeholder in use';info.append(name,meta,status);card.append(image,info);$('photoList').append(card);}$('photoCount').textContent=`Showing ${pageRows.length} of ${list.length} matching products · product photos pending: ${products.length}`;$('photoPage').textContent=`Page ${photoPage+1} / ${pages}`;$('photoPrev').disabled=photoPage===0;$('photoNext').disabled=photoPage>=pages-1;}
function auditIllustrations(){const paths=[...Object.values(illustrations),...products.map(p=>'../'+(p.referenceImage||p.referenceIllustration||p.image||'photos/catalogue-placeholder.svg'))],urls=[...new Set(paths)];return Promise.all(urls.map(url=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve([url,true]);image.onerror=()=>resolve([url,false]);image.src=url;}))).then(results=>{photoAudit=Object.fromEntries(results);const ok=results.filter(([,loaded])=>loaded).length;$('photoAssets').textContent=`${ok} / ${results.length} available`;});}
function photoReport(){const rows=[['Product ID','Product name','Category','Brand','Size / specification','Catalogue image reference','Referenced asset status','Displayed image','Image classification','Product photo status','Placeholder path status'],...products.map(p=>{const source='../'+(p.referenceImage||p.referenceIllustration||p.image||'photos/catalogue-placeholder.svg'),image=illustrations[p.category]||'../photos/catalogue-placeholder.svg';return[p.id,p.name,p.category,p.brand,p.size,source,photoAudit[source]===false?'Referenced image missing':'Referenced image available',image,'Category illustration; not a product photo','Product photo needed',photoAudit[image]===false?'Placeholder asset missing':'Placeholder asset available'];})];downloadCsv('hm-product-photo-audit.csv',rows);}
function initPhotos(){products=Array.isArray(window.HM_DATA?.materials)?window.HM_DATA.materials:[];$('photoProducts').textContent=String(products.length);for(const category of [...new Set(products.map(p=>p.category))].sort()){const option=document.createElement('option');option.value=option.textContent=category;$('photoCategory').append(option);}initInventoryProducts();initQuotationProducts();quotationLines=[newQuotationLine('product')];renderQuotationLines();renderPhotos();auditIllustrations().then(renderPhotos);}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('login').onsubmit=async event=>{event.preventDefault();const button=$('login').querySelector('button');button.disabled=true;try{await api('admin-session',json('POST',{email:$('email').value,password:$('password').value}));$('password').value='';$('login').hidden=true;$('workspace').hidden=false;setView('overview');startNotificationPolling();await loadOverview();}catch(error){$('message').textContent=error.message;}finally{button.disabled=false;}};
$('logout').onclick=async()=>{try{await api('admin-session',{method:'DELETE'});showLogin();$('message').textContent='Signed out.';}catch(error){$('message').textContent=error.message;}};
$('filters').onsubmit=event=>{event.preventDefault();page=0;load();};$('refresh').onclick=load;$('prev').onclick=()=>{page--;load();};$('next').onclick=()=>{page++;load();};$('refreshOverview').onclick=loadOverview;
$('notificationBell').onclick=()=>{const panel=$('notificationsPanel'),open=panel.hidden;panel.hidden=!open;$('notificationBell').setAttribute('aria-expanded',String(open));if(open)renderNotifications();};
$('markNotificationsRead').onclick=()=>{writeStoredValue(unreadKey,[]);updateNotificationBadge();renderNotifications();};
$('desktopNotifications').onclick=enableDesktopNotifications;
$('refreshCatalogue').onclick=loadCatalogue;$('catalogueQuery').addEventListener('input',()=>{cataloguePage=0;renderCatalogue();});$('cataloguePrev').onclick=()=>{cataloguePage--;renderCatalogue();};$('catalogueNext').onclick=()=>{cataloguePage++;renderCatalogue();};
$('exportCatalogueCsv').onclick=exportCatalogueCsv;$('previewCatalogueCsv').onclick=previewCatalogueImport;$('saveCatalogueCsv').onclick=saveCatalogueImport;
$('catalogueCsvFile').addEventListener('change',()=>{pendingCatalogueCsv='';$('saveCatalogueCsv').disabled=true;$('catalogueImportErrors').replaceChildren();$('catalogueImportMessage').textContent='New CSV selected. Preview it before saving.';});
$('newQuotation').onclick=resetQuotationForm;$('refreshQuotations').onclick=()=>loadQuotations();$('quotationForm').addEventListener('submit',saveQuotation);$('cancelQuotation').onclick=resetQuotationForm;
$('quotationEnquiry').addEventListener('change',applyEnquiryToQuotation);
$('addQuotationProduct').onclick=()=>{quotationLines.push(newQuotationLine('product'));renderQuotationLines();};
$('addQuotationService').onclick=()=>{quotationLines.push(newQuotationLine('service'));renderQuotationLines();};
$('quotationTaxMode').addEventListener('change',renderQuotationLines);
for(const id of ['quotationFreight','quotationOtherCharges'])$(id).addEventListener('input',updateQuotationTotals);
$('quotationPrev').onclick=()=>{quotationPage=Math.max(0,quotationPage-1);loadQuotations();};
$('quotationNext').onclick=()=>{if(quotationRows.length===30){quotationPage++;loadQuotations();}};
$('refreshInventory').onclick=loadInventory;$('inventoryQuery').addEventListener('input',()=>{inventoryPage=0;renderInventory();});$('inventoryPrev').onclick=()=>{inventoryPage--;renderInventory();};$('inventoryNext').onclick=()=>{inventoryPage++;renderInventory();};
$('inventoryMovementType').addEventListener('change',()=>{$('inventoryQuantity').min=$('inventoryMovementType').value==='adjustment'?'-1000000000':'0.001';});
$('inventoryMovementForm').addEventListener('submit',recordInventoryMovement);
$('inventoryHistoryPrev').onclick=()=>{inventoryHistoryPage=Math.max(0,inventoryHistoryPage-1);loadInventoryHistory();};$('inventoryHistoryNext').onclick=()=>{if(inventoryHistory.length===50){inventoryHistoryPage++;loadInventoryHistory();}};
$('csv').onclick=()=>downloadEnquiries('csv');$('excel').onclick=()=>downloadEnquiries('excel');
$('refreshServiceBookings').onclick=loadServiceBookings;$('serviceBookingPrev').onclick=()=>{servicePage--;loadServiceBookings();};$('serviceBookingNext').onclick=()=>{servicePage++;loadServiceBookings();};$('refreshTechnicians').onclick=loadTechnicians;
$('technicianForm').onsubmit=async event=>{event.preventDefault();const button=$('technicianForm').querySelector('button');button.disabled=true;$('techniciansMessage').textContent='Saving technician…';try{await api('admin-service-bookings',json('POST',{action:'create-technician',name:$('technicianName').value.trim(),mobile:$('technicianMobile').value.trim(),trade:$('technicianTrade').value.trim()}));$('technicianForm').reset();$('techniciansMessage').textContent='Technician record saved.';await loadTechnicians();}catch(error){$('techniciansMessage').textContent=error.message;}finally{button.disabled=false;}};
$('photoQuery').addEventListener('input',()=>{photoPage=0;renderPhotos();});$('photoCategory').addEventListener('change',()=>{photoPage=0;renderPhotos();});$('photoStatus').addEventListener('change',()=>{photoPage=0;renderPhotos();});$('photoPrev').onclick=()=>{photoPage--;renderPhotos();};$('photoNext').onclick=()=>{photoPage++;renderPhotos();};$('photoReport').onclick=photoReport;
initPhotos();if('Notification'in window&&Notification.permission==='granted')$('desktopNotifications').textContent='Desktop notifications enabled';api('admin-session').then(()=>{$('login').hidden=true;$('workspace').hidden=false;setView('overview');startNotificationPolling();loadOverview();}).catch(error=>{$('message').textContent=error.message;});
