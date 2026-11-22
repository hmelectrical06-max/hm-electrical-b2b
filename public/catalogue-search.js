'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.HM_CATALOGUE_SEARCH=api;
})(typeof window==='undefined'?globalThis:window,function(){
 const synonymGroups=[
  ['mcb','miniature circuit breaker','mini circuit breaker'],
  ['mccb','moulded case circuit breaker','molded case circuit breaker'],
  ['sp','single pole','1 pole'],
  ['dp','double pole','2 pole'],
  ['tp','triple pole','three pole','3 pole'],
  ['fp','four pole','4 pole'],
  ['gi','galvanized iron','galvanised iron'],
  ['ms','mild steel'],
  ['ss','stainless steel'],
  ['phe','plumbing public health engineering','public health engineering'],
  ['xlpe','cross linked polyethylene','crosslinked polyethylene'],
  ['ht','high tension'],
  ['lt','low tension'],
  ['db','distribution board','panel board'],
  ['earthing','grounding'],
  ['fire fighting','firefighting','fire protection'],
  ['tools','tooling','equipment'],
  ['fasteners','fixings','fixing hardware'],
  ['wires','wire','cables','cable'],
  ['switches','switchgear'],
  ['sockets','socket','outlet']
 ];
 const categorySynonyms={
  'Cable Management':'cable tray cable support trunking',
  'Cable Termination':'cable gland lug ferrule termination accessories',
  'Conduit and Accessories':'conduit pipe electrical accessories fittings',
  'Control and Automation':'control automation electrical controls',
  'Earthing and Lightning':'earthing grounding lightning protection',
  'Electrical Distribution':'distribution board panel board electrical panel',
  'Electrical Protection':'circuit breaker switchgear mcb mccb protection',
  'Fasteners and Hardware':'fasteners fixings fixing hardware bolts nuts screws washers anchors',
  'Fire Fighting':'firefighting fire protection fire safety',
  'Lighting':'lights luminaires illumination',
  'Plumbing and PHE':'plumbing public health engineering pipes fittings',
  'Safety and Consumables':'safety personal protective equipment ppe consumables',
  'Switches and Sockets':'switchgear outlets electrical accessories',
  'Tools and Machinery':'tools equipment machinery accessories',
  'Wires and Cables':'wire electrical cable power cable'
 };
 const normalize=value=>String(value??'').toLowerCase()
  .replace(/\b(\d+(?:\.\d+)?)\s*c(?:ores?)?\s*(?:[/x×*]\s*)?(?=\d)/g,'$1core ').replace(/\bal\b/g,'aluminium').replace(/\bcu\b/g,'copper')
  .replace(/\b(?:boash|boasch)\b/g,'bosch').replace(/\b(?:grender|grainder)\b/g,'grinder').replace(/\b(?:fastner|fashtner)\b/g,'fastener').replace(/\b(?:elbew|elbo)\b/g,'elbow').replace(/\bengle\b/g,'angle').replace(/\b(?:ferul|ferrul)\b/g,'ferrule').replace(/\b(?:tep|tapeing)\b/g,'tape').replace(/\b(?:tar|taar)\b/g,'wire').replace(/\bpaip\b/g,'pipe').replace(/ashirwad/g,'ashirvad')
  .replace(/\bsq\.?\s*mm\b|\bmm2\b|mm²/g,'sqmm')
  .replace(/\bamps?\b|\bamperes?\b/g,'a')
  .replace(/(\d)\s+(mm|sqmm|a|v|kw)\b/g,'$1$2')
  .replace(/[^a-z0-9.]+/g,' ').trim();
 const values=value=>Array.isArray(value)?value.flatMap(values):value&&typeof value==='object'?Object.values(value).flatMap(values):value==null?[]:[String(value)];
 function searchText(product){
  const fields=[
   product.id,product.sourceCode,product.requestedCode,product.sourceRows,product.source,
   product.brand,product.manufacturer,product.manufacturerSku,product.category,product.group,
   product.name,product.size,product.unit,product.specification,product.specifications,
   product.description,product.hsn,product.hsnCode,product.HSN
  ].flatMap(values);
  const base=normalize(fields.join(' '));
  const aliases=synonymGroups.filter(group=>group.some(term=>base.includes(normalize(term)))).flat();
  return normalize([...fields,...aliases,categorySynonyms[product.category]||''].join(' '));
 }
 const enquiryStop=new Set('i we need required requirement requirements want please kindly plz pls quote quotation enquiry inquiry price prices rate rates mrp cost show tell me what is are the a an for in near nearby at to and with my your our have available availability stock mumbai mumbra thane kausa sion borivali dahisar andheri malad goregaon bandra kurla mulund vashi navi mira bhayandar kalyan dombivli panvel bhiwandi ka ki ke hai kya chahiye chaiye mujhe do dena dikhao batao bhejo qty quantity'.split(' '));
 const enquiryBrands=new Set('polycab finolex havells kei anchor braco ashirvad supreme ajay legrand schneider bosch dewalt ador makita esab fischer hilti'.split(' '));
 function enquiryTerms(query){return normalize(query).replace(/(?<!\d)\.|\.(?!\d)/g,' ').replace(/\b\d+(?:\.\d+)?\s*(?:rolls?|coils?|boxes?|pcs|pieces?|nos|metres?|meters?|mtrs?)\b/g,' ').split(/\s+/).filter(t=>t&&!enquiryStop.has(t));}
 function matchesProduct(product,query){
  const terms=enquiryTerms(query);
  if(!terms.length)return true;
  const text=searchText(product);
  const make=normalize([product.brand,product.manufacturer].filter(Boolean).join(' '));
  return terms.every(term=>text.includes(term)||enquiryBrands.has(term)&&(!make||/^(as per|to confirm|any make|brand open)/.test(make)));
 }
 function matches(text,query){
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  const normalizedText=normalize(text);
  return terms.every(term=>normalizedText.includes(term));
 }
 const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const productPath=product=>product._seoPath||`/products/${slug(`${product.id} ${product.name} ${product.size}`)}/`;
 return {normalize,searchText,matches,matchesProduct,slug,productPath,enquiryTerms};
});
