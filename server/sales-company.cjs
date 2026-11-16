'use strict';
const data=require('./public-company-knowledge.json'),company=require('../public/company.json');
const CONTACT='Please call 8085560156 / 7905681022 or email hmelectrical06@gmail.com.';
const SERVICES='Electrical contracting and installation; Fire Fighting installation and maintenance; Plumbing/PHE; HVAC and mechanical installation; fabrication; B2B material supply; and technician/manpower enquiries.';
function projectReply(q){
 const status=/complet|finished|past/i.test(q)?'Completed':/running|ongoing|active|current|working/i.test(q)?'Running':null;
 const records=data.projects.filter(p=>!status||p.status===status);
 if(/how many|count|number|kitn|total/i.test(q)){
  const running=data.projects.filter(p=>p.status==='Running').length,completed=data.projects.filter(p=>p.status==='Completed').length;
  return `The approved public register${data.sourceDate?' dated '+data.sourceDate:''} lists ${status?records.length+' '+status.toLowerCase():data.projects.length+' project'} records${status?'':` (${running} running, ${completed} completed)`}. Separate work scopes at one location may be separate records. This is a dated register, not a live site feed; our office can confirm today's active sites. https://hmelectricalb2b.com/company-projects.html`;
 }
 const ignored=new Set('project projects experience portfolio client clients completed running ongoing active current tell about show company site sites'.split(' '));
 const terms=(q.toLowerCase().match(/[a-z]{3,}/g)||[]).filter(w=>!ignored.has(w));
 const found=records.filter(p=>terms.some(w=>(p.name+' '+p.detail).toLowerCase().split(/[^a-z]+/).includes(w)));
 const shown=(found.length?found:records).slice(0,3);
 return (status?status+' public project records: ':'From our approved public portfolio: ')+shown.map(p=>p.name+' ('+p.status+')').join('; ')+`. Register${data.sourceDate?' dated '+data.sourceDate:''}; current progress is confirmed by our office. https://hmelectricalb2b.com/company-projects.html`;
}
function reply(q){
 if(/\b(projects?|portfolio|experience|clients?)\b|(?:active|running|ongoing|current).{0,20}\bsites?\b/i.test(q))return projectReply(q);
 if(/\b(team|staff|owner|proprietor|leadership)\b/i.test(q))return 'HM ELECTRICAL is led by proprietor '+company.proprietor+'. Our public team includes electrical, Fire Fighting and PHE site supervisors, site staff and a billing team. Technician availability is confirmed for each job. https://hmelectricalb2b.com/company-team.html';
 const words=q.toLowerCase().match(/[a-z]{3,}/g)||[];
 const person=data.team.find(p=>words.filter(w=>!['mohammad','khan','electrical'].includes(w)).some(w=>p.name.toLowerCase().split(' ').includes(w)));
 if(person)return `${person.name} — ${person.detail} https://hmelectricalb2b.com/company-team.html`;
 if(/\b(services?|capabilities)\b|what (?:do you|does.*company)|what.*company.*do/i.test(q))return 'HM ELECTRICAL handles '+SERVICES+' Share the material or work you need; our team will confirm scope, availability and rates.';
 if(/\b(company|profile|about us|address|shop|office)\b/i.test(q)&&!/pipe|wire|cable|mcb|fastener/i.test(q))return `HM ELECTRICAL provides B2B material supply and project/technician services across Mumbai, Mumbra and Thane. Operating shop: Khardi Road, Mumbra, Thane. Registered office: A-85, Naik Nagar, LBS Marg, Sion West, Mumbai 400022. ${CONTACT} https://hmelectricalb2b.com/company-profile.html`;
 return null;
}
module.exports={reply,projectReply,CONTACT,SERVICES};
