const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
for(const dir of ['scripts','server','netlify/functions','public/admin','public'])for(const file of fs.readdirSync(dir))if(/\.(cjs|js)$/.test(file)){const r=cp.spawnSync(process.execPath,['--check',path.join(dir,file)],{stdio:'inherit'});if(r.status)process.exit(r.status);}
for(const file of ['public/company.json','server/catalogue.json'])JSON.parse(fs.readFileSync(file));
if(fs.existsSync('public/.env')||fs.existsSync('public/server'))throw Error('Server secrets must stay outside publish directory.');
if(!fs.existsSync('public/index.html'))throw Error('public/index.html is required.');
console.log('Build checks passed. public/ is the website source; dist/ is generated.');
