'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const clean=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const excluded=s=>/\bcivil\b|shuttering|pile head|excavation|reinforcement|\bstructure\b/i.test(s);
function build(){
 const html=fs.readFileSync(path.join(root,'public/company-projects.html'),'utf8'),projects=[];
 let status=null;
 const currentHtml=html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
 for(const m of currentHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>|<article[^>]*>([\s\S]*?)<\/article>/g)){
  if(m[1]){status=/running|current work/i.test(clean(m[1]))?'Running':/completed/i.test(clean(m[1]))?'Completed':null;continue;}
  const name=clean(m[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1]||'');
  const detail=[...m[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(p=>clean(p[1])).join(' · ');
  if(name&&status&&!excluded(name)&&!projects.some(p=>p.name===name&&p.detail===detail&&p.status===status))projects.push({name,detail,status});
 }
 const teamHtml=fs.readFileSync(path.join(root,'public/company-team.html'),'utf8'),team=[];
 for(const m of teamHtml.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g)){
  const name=clean(m[1].match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/)?.[1]||'');
  const detail=[...m[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(x=>clean(x[1])).join(' ').slice(0,260);
  if(name&&!excluded(name+' '+detail))team.push({name,detail});
 }
 const sourceDate=html.match(/<meta name="hm-project-record-date" content="([^"]+)"/)?.[1]||html.match(/register dated ([^.]+)\./i)?.[1]||null;
 const result={sourceDate,projectSource:'/company-projects.html',teamSource:'/company-team.html',projects,team};
 fs.writeFileSync(path.join(root,'server/public-company-knowledge.json'),JSON.stringify(result,null,2)+'\n');
 return result;
}
if(require.main===module){const k=build();console.log(JSON.stringify({publicProjects:k.projects.length,runningRecords:k.projects.filter(p=>p.status==='Running').length,sourceDate:k.sourceDate}));}
module.exports={build};
