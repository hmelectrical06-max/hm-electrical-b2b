'use strict';
const fs=require('fs'),path=require('path');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const line=(x1,y1,x2,y2,color='#526776',w=8)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
const rect=(x,y,w,h,fill='#d8e1e6',r=8)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="#526776" stroke-width="4"/>`;
const circle=(x,y,r,fill='#d8e1e6')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#526776" stroke-width="5"/>`;
function family(p){const n=p.name.toLowerCase().split(/[—–]/)[0].trim();
 if(/meter panel/.test(n))return 'panel';
 if(/screwdriver/.test(n))return 'screwdriver';
 if(/angle grinder/.test(n))return 'grinder';
 if(/led panel|holder|ceiling rose/.test(n))return 'light';
 if(/industrial plug|industrial socket/.test(n))return 'socket';
 if(/cable tray/.test(n))return 'tray';
 if(/(?:gi|ms) base plate/.test(n))return 'plate';
 if(/enhancement compound/.test(n))return 'bottle';
 if(/meter|tester|test leads|voltage detector/.test(n))return 'meter';
 if(/drill bit|core bit|hole saw/.test(n))return 'bit';
 if(/claw hammer|ball peen hammer/.test(n))return 'hammer';
 if(/cable cutter|crimping tool|wire stripper|pipe cutter/.test(n))return 'pliers';
 if(/crimping machine|pipe threading machine/.test(n))return 'machine';
 if(/cable pulling roller/.test(n))return 'wheel';
 if(/cable tag|cable marker|cable tie/.test(n))return 'tape';
 if(/auxiliary contact/.test(n))return 'control';
 if(/socket set|socket wrench/.test(n))return 'wrench';
 if(/marker pen/.test(n))return 'pen';
 if(/flexible sprinkler/.test(n))return 'pipe';
 const rules=[['extinguisher',/extinguisher/],['sprinkler',/sprinkler/],['hose',/hose reel|hose cabinet|brigade inlet/],['valve',/valve|landing/],['detector',/smoke detector|manual call/],
 ['nut',/nut|washer/],['bolt',/screw|bolt|threaded|tie rod|anchor|wall plug|hammer fixing/],['gland',/gland/],['lug',/\blug\b|ferrule/],['clamp',/clamp|cleat|saddle|support|bracket/],
 ['pipe',/pipe|conduit|coupler|bush|bend/],['tray',/tray|raceway|channel|angle|din rail|flat|earth strip/],['earth',/earth|lightning|air terminal|down conductor|test link/],
 ['wire',/wire|cable/],['breaker',/mcb|mccb|rccb|rcbo|isolator|spd/],['panel',/\bdb\b|panel|enclosure|feeder pillar/],['box',/box/],
 ['light',/led|light|bulb|batten|tube|cob|holder|ceiling rose|exit sign/],['socket',/socket|plug/],['switch',/switch|regulator|bell|indicator|push button|plate|selector/],
 ['meter',/meter|tester|test leads|voltage detector/],['drill',/drill|hammer|blower|heat gun|impact driver|demolition/],['wheel',/wheel|disc|hole saw|core bit|drill bit/],
 ['machine',/machine/],['pliers',/plier|cutter|crimping|stripper/],['wrench',/spanner|wrench|allen key/],['screwdriver',/screwdriver/],['saw',/hacksaw/],
 ['safety',/helmet|shoes|gloves|goggles|jacket|harness|lockout/],['tape',/tape|sleeve|marker|cable tag|cable tie/],['bottle',/adhesive|cement|sealant|compound/],
 ['control',/contactor|relay|transformer|smps|terminal block/],['rod',/welding rod|electrode/],['level',/spirit level/],['pen',/marker pen/]];
 return rules.find(([,r])=>r.test(n))?.[0]||'specification';
}
function drawing(p){const n=p.name.toLowerCase(),f=family(p);let s='';
 if(f==='rod'){for(let i=0;i<4;i++)s+=line(235+i*18,300+i*4,450+i*18,145+i*4,'#9fada7',12)+line(450+i*18,145+i*4,472+i*18,130+i*4,'#c1a484',8);}
 else if(f==='pen')s=line(250,297,435,160,'#374f60',35)+line(435,160,473,132,'#1b3547',42)+line(229,312,250,297,'#1b3547',17);
 else if(f==='meter'&&/line tester|non contact/.test(n))s=line(252,300,381,173,'#8da4b2',12)+line(381,173,455,100,'#d4b854',32)+line(231,320,252,300,'#526776',8);
 else if(f==='meter'&&/test leads/.test(n))s=`<path d="M270 280q-100-180 65-134t80 149" fill="none" stroke="#a44638" stroke-width="10"/><path d="M320 304q-95-180 65-134t80 149" fill="none" stroke="#243e50" stroke-width="10"/>`+line(270,280,290,339,'#a44638',18)+line(290,339,299,365,'#9bafb9',5)+line(320,304,340,363,'#243e50',18);
 else if(f==='earth'&&/rod|electrode|air terminal|down conductor/.test(n))s=line(269,330,443,131,'#b68a57',25)+line(443,131,457,115,'#cfac78',12)+line(269,330,257,345,'#b68a57',12);
 else if(f==='tape'&&/sleeve/.test(n))s=line(247,285,440,167,'#304d60',46)+circle(440,167,24,'#516f7e')+circle(440,167,12,'#f3f6f7');
 else if(f==='tape'&&/cable tie/.test(n))s=`<path d="M300 295q-135-175 55-160t5 150l150 28" fill="none" stroke="#536d7c" stroke-width="14"/>`+rect(330,270,45,37,'#536d7c',2);
 else if(f==='bit'){if(/core bit|hole saw/.test(n))s=rect(282,177,146,130,'#9aaeb9',3)+`<ellipse cx="355" cy="177" rx="73" ry="23" fill="#536d7b" stroke="#314f61" stroke-width="5"/>`+line(355,311,355,356,'#526776',18);else{s=line(265,320,429,148,'#9eafb7',29);for(let i=0;i<10;i++)s+=line(275+i*15,289-i*16,297+i*15,308-i*16,'#415d6d',5);}}
 else if(f==='grinder')s=rect(251,188,216,76,'#bf9553',20)+circle(237,227,73,'#4b6170')+circle(237,227,24,'#c0cbd0')+line(362,182,362,138,'#233d4f',21);
 else if(f==='plate'){s=rect(238,156,234,164,'#bccbd2',3);for(const x of [258,452])for(const y of [176,300])s+=circle(x,y,8,'#f3f6f7');}
 else if(f==='breaker'){const poles=/\b(?:fp|4p)\b/.test(n)?4:/\b(?:tp|tpn|3p)\b/.test(n)?3:/\bdp\b/.test(n)?2:1;for(let i=0;i<poles;i++){const x=290+(i-poles/2)*62;s+=rect(x,135,60,188,'#f3f4f1')+rect(x+12,190,36,55,'#173b52')+circle(x+30,160,8,'#adb8be')+circle(x+30,299,8,'#adb8be');}s+=line(245,340,455,340,'#b2bfc6',9);}
 else if(f==='wire'){s=`<ellipse cx="340" cy="238" rx="138" ry="84" fill="none" stroke="#233e50" stroke-width="55"/><ellipse cx="340" cy="238" rx="138" ry="84" fill="none" stroke="#4e6f7d" stroke-width="5" stroke-dasharray="7 9"/>`+line(465,255,540,290,'#223e51',22)+line(540,290,566,302,'#b67e43',14);}
 else if(f==='pipe'){const bend=/bend|elbow/.test(n);s=bend?`<path d="M260 150v115q0 45 45 45h160" fill="none" stroke="#93a7b1" stroke-width="54"/>`:`<path d="M220 290L490 166" stroke="#a4b6be" stroke-width="59"/>`;s+=circle(bend?260:490,bend?150:166,30,'#526776')+circle(bend?260:490,bend?150:166,18,'#edf2f4');}
 else if(f==='tray'){s=`<path d="M194 276l258-120 85 61-258 121z" fill="#d6dfe3" stroke="#526776" stroke-width="5"/><path d="M194 276v-44l258-120v44M279 338v-45l258-120v44" fill="#aebfc7" stroke="#526776" stroke-width="5"/>`;for(let i=0;i<8;i++)s+=line(240+i*31,263-i*14,279+i*31,293-i*14,'#718895',6);}
 else if(f==='panel'||f==='box'){s=rect(240,115,230,230,'#c6d1d6')+rect(259,132,192,196,'#e5ebee')+rect(412,210,14,58,'#526776');if(f==='panel')s+=rect(285,161,65,35,'#344e60')+circle(310,240,8,'#bf7f4b')+circle(345,240,8,'#4d886b');}
 else if(f==='switch'||f==='socket'){s=rect(245,140,225,180,'#e6e9e5',18)+rect(262,157,191,146,'#f8faf7',14);if(f==='socket')s+=circle(358,193,12,'#173b52')+circle(321,247,11,'#173b52')+circle(394,247,11,'#173b52');else if(/regulator|dimmer/.test(n))s+=circle(357,231,47,'#b5c6cd')+line(357,231,375,202,'#173b52',7);else s+=rect(310,183,94,96,'#bdcbd0',10)+line(326,207,385,207,'#fff',4);}
 else if(f==='gland'){s=rect(258,166,187,109,'#c8b17b',2)+`<path d="M286 148h102l27 72-27 72H286l-27-72z" fill="#d9c18d" stroke="#7e724f" stroke-width="5"/>`+circle(430,220,54,'#d9c18d')+circle(430,220,28,'#526776');for(let i=0;i<5;i++)s+=line(248+i*9,177,248+i*9,262,'#8b794d',3);}
 else if(f==='lug'){s=circle(300,210,62,'#c78a55')+circle(300,210,30,'#f7f8f7')+rect(344,183,160,55,'#c78a55',5)+circle(500,210,26,'#9d673f');}
 else if(f==='bolt'||f==='rod'){s=line(250,275,472,170,'#a8b7be',30);for(let i=0;i<15;i++)s+=line(280+i*12,243-i*5.5,286+i*12,267-i*5.5,'#647985',4);s+=`<path d="M225 250l44 1 22 38-22 38-44-1-22-38z" fill="#b6c5cd" stroke="#526776" stroke-width="5"/>`;}
 else if(f==='nut'){s=`<path d="M293 142h119l59 94-59 94H293l-59-94z" fill="#c3cfd5" stroke="#526776" stroke-width="6"/>`+circle(352,236,49,'#f7f8f7');}
 else if(f==='clamp'){s=`<path d="M255 291v-87a99 99 0 0 1 198 0v87" fill="none" stroke="#9eb1bb" stroke-width="24"/>`+rect(234,280,54,22,'#657d8b')+rect(425,280,54,22,'#657d8b')+line(260,306,260,340,'#526776',10)+line(450,306,450,340,'#526776',10);}
 else if(f==='light'){if(/tube|batten|rope|rice/.test(n))s=rect(185,208,345,48,'#f5eed4',18)+rect(185,208,27,48,'#8c9fa9')+rect(503,208,27,48,'#8c9fa9');else if(/bulb|smart/.test(n))s=circle(355,204,77,'#fff6d7')+rect(321,270,68,57,'#9babaf')+line(326,287,386,287,'#526776',4)+line(326,304,386,304,'#526776',4);else s=rect(242,142,228,170,'#526776')+rect(260,160,192,133,'#fff3c7')+line(285,330,427,330,'#526776',10);}
 else if(f==='valve'){s=line(205,250,510,250,'#b59a64',42)+rect(310,202,91,94,'#c7ad76')+line(355,202,355,150,'#526776',15)+`<ellipse cx="355" cy="144" rx="69" ry="18" fill="none" stroke="#a8443a" stroke-width="10"/>`;}
 else if(f==='extinguisher'){s=rect(295,176,117,175,'#b54c3d',30)+rect(327,150,54,40,'#526776')+line(340,147,407,147,'#526776',14)+`<path d="M404 155q80 5 65 119" fill="none" stroke="#263d4d" stroke-width="15"/>`+rect(466,259,25,61,'#263d4d');}
 else if(f==='hose'){s=rect(225,119,270,224,'#b64c3d')+circle(360,230,78,'#a73c33')+circle(360,230,55,'#344e60')+circle(360,230,28,'#d5dfe2');}
 else if(f==='sprinkler'){s=line(357,130,357,235,'#b59a64',28)+line(310,250,403,250,'#b59a64',12)+`<path d="M324 237v49h66v-49" fill="none" stroke="#b59a64" stroke-width="9"/>`+line(357,250,357,282,'#bd5447',11)+line(323,300,392,300,'#b59a64',8);}
 else if(f==='meter'){s=rect(260,125,190,220,'#bcad6b',22)+rect(284,153,142,64,'#cadbcb')+circle(355,265,39,'#344e60')+line(355,265,372,243,'#dce5e9',5)+circle(310,320,8,'#ad443b')+circle(396,320,8,'#263d4d');}
 else if(f==='control'){s=rect(267,136,180,191,'#b6c5cc')+rect(294,180,126,84,'#344e60');for(let i=0;i<3;i++)s+=circle(295+i*60,151,9,'#e7edef')+circle(295+i*60,309,9,'#e7edef');}
 else if(f==='drill'){s=rect(245,158,185,95,'#c39852',22)+rect(411,178,67,48,'#526776')+line(477,200,546,200,'#7c919c',12)+`<path d="M292 245h89l-14 104h-76z" fill="#344e60" stroke="#526776" stroke-width="5"/>`+rect(278,334,108,25,'#c39852');}
 else if(f==='machine'){s=rect(235,146,260,169,'#456d81')+circle(284,250,34,'#1b3546')+rect(350,183,109,44,'#d0dedb')+line(273,333,273,358)+line(455,333,455,358);}
 else if(f==='pliers'){s=circle(352,224,17,'#b5c5cd')+line(352,224,297,147,'#9cb0bc',25)+line(352,224,408,147,'#9cb0bc',25)+line(340,239,286,340,'#bd7c48',28)+line(365,239,420,340,'#bd7c48',28);}
 else if(f==='wrench'){s=`<path d="M264 141q-57 54-6 104l127 105 40-44-127-106q23-45-14-75l-9 44-29 11z" fill="#b7c6cf" stroke="#526776" stroke-width="5"/>`;}
 else if(f==='screwdriver'||f==='pen'){s=line(255,310,399,166,'#9aadb7',15)+line(399,166,458,106,'#bd7d46',38)+line(235,330,255,310,'#526776',8);}
 else if(f==='wheel'){s=circle(354,235,106,'#677f8d')+circle(354,235,28,'#e8edef')+circle(354,235,8,'#526776');}
 else if(f==='safety'){if(/helmet/.test(n))s=`<path d="M244 269q0-131 111-131t111 131z" fill="#d2ab4f" stroke="#526776" stroke-width="5"/>`+rect(220,267,274,31,'#d2ab4f');else if(/shoes/.test(n))s=`<path d="M265 150h110v112l115 29v49H235v-63h30z" fill="#536673" stroke="#243e51" stroke-width="6"/>`+line(239,325,483,325,'#b8c5ca',12);else if(/goggles/.test(n))s=rect(216,185,122,99,'#c1dce1',25)+rect(373,185,122,99,'#c1dce1',25)+line(338,221,373,221,'#526776',15)+line(204,219,180,180)+line(508,219,532,180);else if(/gloves/.test(n))s=`<path d="M290 331v-81l-43-51q-10-29 15-26l30 27v-76q9-27 26 0v72-95q12-28 27 0v96-83q13-25 27 0v84-58q15-22 27 0v137l-22 54z" fill="#d2b27c" stroke="#526776" stroke-width="5"/>`;else s=rect(277,131,158,204,'#d2ab4f')+line(300,150,410,310,'#e8edef',14)+line(410,150,300,310,'#e8edef',14);}
 else if(f==='hammer'){s=line(332,305,379,149,'#b58a53',30)+rect(295,135,165,52,'#aebdc4',5);}
 else if(f==='tape'){s=circle(355,235,104,'#d1b574')+circle(355,235,57,'#f7f8f7');}
 else if(f==='bottle'){s=rect(300,178,111,164,'#d4decf',16)+rect(324,127,63,53,'#526776')+rect(313,224,85,64,'#c6a46b');}
 else if(f==='earth'){s=rect(285,130,140,210,'#718a81')+line(310,180,400,180,'#d7e3dc',7)+line(355,165,355,280,'#c49c5e',12)+line(323,280,388,280,'#c49c5e',8);}
 else if(f==='detector'){s=circle(355,235,108,'#e1e7e9')+circle(355,235,68,'#e8edef');for(let i=0;i<5;i++)s+=line(315,200+i*16,396,200+i*16,'#8da1ad',5);}
 else if(f==='saw'){s=`<path d="M240 302V160h235v142" fill="none" stroke="#bd8a4e" stroke-width="20"/>`+line(234,302,475,302,'#526776',6);}
 else if(f==='level'){s=rect(220,199,280,65,'#d0af5f')+circle(360,231,21,'#b6d1c2')+rect(246,217,42,29,'#d9e4df');}
 return {family:f,svg:s};
}
function svg(p){const d=drawing(p);const name=p.name.length>44?p.name.slice(0,42)+'…':p.name;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 520" role="img" aria-label="${esc(p.name+' '+p.size+' representative illustration')}"><rect width="720" height="520" rx="20" fill="#f3f6f7"/><text x="34" y="43" font-family="Arial,sans-serif" font-size="14" letter-spacing="2" fill="#59717e">HM ELECTRICAL · ${esc(p.id)}</text><ellipse cx="356" cy="363" rx="150" ry="17" fill="#e1e8eb"/>${d.svg}<path d="M34 397H686" stroke="#d7e0e4"/><text x="34" y="436" font-family="Arial,sans-serif" font-size="24" font-weight="600" fill="#17394d">${esc(name)}</text><text x="34" y="470" font-family="Arial,sans-serif" font-size="18" fill="#526b7a">${esc(p.size+' · '+p.unit)}</text><text x="34" y="502" font-family="Arial,sans-serif" font-size="12" fill="#627987">REPRESENTATIVE ILLUSTRATION · MAKE / MODEL TO CONFIRM</text></svg>`;}
function generate(output,products){const dir=path.join(output,'photos/products');fs.mkdirSync(dir,{recursive:true});for(const p of products)fs.writeFileSync(path.join(dir,p.id+'.svg'),svg(p));return products.length;}
module.exports={family,svg,generate};
