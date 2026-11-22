'use strict';
const catalogue=require('./sales-catalogue.cjs');
const groups=[
 {key:'electrical',label:'Electrical',intent:/\belectrical\b|\belectric\b/,categories:/^(Wires and Cables|Electrical Protection|Electrical Distribution|Cable Termination|Cable Management|Conduit and Accessories|Lighting|Switches and Sockets|Earthing and Lightning)$/,seeds:[/^FR copper wire$/i,/^Flexible Cable$/i,/^MCB SP$/i,/^RCCB$/i,/^RCBO$/i,/^MCCB$/i,/^GI perforated cable tray$/i,/^Brass double compression gland$/i,/^Copper cable lug$/i,/^GI rigid conduit$/i,/^LED panel/i,/^GI earth strip$/i]},
 {key:'fire',label:'Fire Fighting',intent:/\bfire\b|\bfirefighting\b/,categories:/^Fire Fighting$/,seeds:[/^Upright sprinkler$/i,/^Pendent sprinkler$/i,/^Sidewall sprinkler$/i,/^Concealed sprinkler$/i,/^Alarm check valve$/i,/^Deluge valve$/i,/^Hydrant valve$/i,/^Fire brigade inlet valve$/i,/^Hose reel complete$/i,/^Fire alarm control panel$/i,/^Smoke detector$/i,/^ABC powder extinguisher$/i]},
 {key:'plumbing',label:'Plumbing / PHE',intent:/\bplumbing\b|\bphe\b/,categories:/^Plumbing and PHE$|^CPVC|^UPVC|^PVC|plumbing|water supply|drainage/i,seeds:[/^CPVC hot water pipe$/i,/^CPVC Elbow 90 degree$/i,/^CPVC Equal tee$/i,/^CPVC Coupler$/i,/^CPVC Reducer$/i,/^CPVC Union$/i,/^UPVC.*pipe$/i,/^GI ERW pipe$/i,/^GI threaded elbow$/i,/^GI threaded tee$/i,/^Ball valve$/i,/^Gate valve$/i]},
 {key:'hardware',label:'Hardware & Fasteners',intent:/\bhardware\b|\bfasteners?\b/,categories:/^Fasteners and Hardware$/,seeds:[/^Steel anchor bolt$/i,/^Wedge anchor$/i,/^Drop in anchor$/i,/^Chemical anchor stud$/i,/^SS bolt$/i,/^SS nut$/i,/^SS washer$/i,/^Flat washer$/i,/^U bolt$/i,/^Coach screw$/i,/^Self tapping screw$/i,/^Machine screw$/i]},
 {key:'tools',label:'Tools & Machinery',intent:/\btools?\b|\bmachinery\b|\bmachines\b/,categories:/^Tools and Machinery$/,seeds:[/^Corded electric drill 13 mm$/i,/^SDS Plus rotary hammer 26 mm$/i,/^Angle grinder 100 mm$/i,/^Angle grinder 125 mm$/i,/^ARC welding inverter 400 A$/i,/^Metal chop saw/i,/^Electric demolition hammer 5 kg$/i,/^Cordless drill driver 18 V$/i,/^HSS drill bit$/i,/^SDS drill bit$/i,/^Hole saw cutter$/i,/^Threading die$/i]},
 {key:'safety',label:'Safety & Consumables',intent:/\bsafety\b|\bppe\b|\bconsumables\b/,categories:/^Safety and Consumables$/,seeds:[/safety helmet/i,/safety shoe/i,/safety goggle/i,/safety glove/i,/full body.*harness/i,/face shield/i,/ear plug/i,/reflective.*jacket/i,/fire blanket/i,/respirator/i,/dust mask/i,/insulation tape/i]}
];
function requested(text){const q=catalogue.normal(text);if(catalogue.specs(q).size||/\b(plumbers?|electricians?|technicians?|labou?r|manpower|workers?|booking)\b|\b(installation|maintenance|repair|contracting)\b/.test(q))return [];
 const selected=groups.filter(g=>g.intent.test(q));const broad=/\b(list|range|types?|which|what|available|catalogue|catalog|show|kon|kaun|konsa|kaunsa|konse|kaunse|kons[aie])\b|kya kya|kon kon|kaun kaun|do you have|you have|(?:aapke|apke|tumhare) (?:pass|pas|paas)/.test(q)||/^(electrical|fire|fire fighting|firefighting|plumbing|phe|hardware|tools|machinery|safety|ppe)( materials?| items?| products?)?[?. ]*$/.test(q);
 if(!broad)return [];if(selected.length)return selected;
 return /\b(all|sab|complete|full)\b/.test(q)&&/\b(material|materials|items|products|catalogue|catalog)\b/.test(q)?groups:[];
}
function build(selected,items){const sections=[];for(const g of selected){const rows=items.filter(p=>p.hidden!==true&&p.availability!=='discontinued'&&!/\bcivil\b|shuttering|pile head/i.test(p.name||''));const chosen=[],seen=new Set();const add=p=>{if(!p)return;const key=catalogue.normal(p.name);if(seen.has(key))return;seen.add(key);chosen.push(p);};for(const re of g.seeds)add(rows.find(p=>re.test(p.name)));
 for(const p of rows.filter(p=>g.categories.test(p.category||p.group||'')))if(chosen.length<12)add(p);
 sections.push({category:g.label,names:chosen.slice(0,12).map(p=>p.name)});
 }
 const reply=sections.map(s=>s.category+' — listed materials:\n'+s.names.map((n,i)=>`${i+1}. ${n}`).join('\n')).join('\n\n')+'\n\nShare the item, size and quantity. Prices and stock are subject to confirmation; items without rates can also be quoted on request.';
 return {step:'category-list',reply,products:[],categoryLists:sections,handoff:false};
}
module.exports={requested,build};
