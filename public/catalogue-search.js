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
 function matchesProduct(product,query){
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  if(!terms.length)return true;
  const text=searchText(product);
  return terms.every(term=>text.includes(term));
 }
 function matches(text,query){
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  const normalizedText=normalize(text);
  return terms.every(term=>normalizedText.includes(term));
 }
 const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const productPath=product=>`/products/${slug(`${product.id} ${product.name} ${product.size}`)}/`;
 return {normalize,searchText,matches,matchesProduct,slug,productPath};
});
