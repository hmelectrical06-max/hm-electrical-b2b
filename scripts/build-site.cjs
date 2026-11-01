'use strict';
const fs=require('node:fs');
const path=require('node:path');

const root=process.cwd();
if(process.env.NETLIFY){
 const production=process.env.HM_SITE_MODE==='production';
 if(production&&process.env.HM_LAUNCH_APPROVED!=='true')throw Error('Launch blocked until testing and explicit launch approval.');
 if(!production&&process.env.HM_PRIVATE_TESTING_ACK!=='true')throw Error('Staging blocked: enable visitor access protection before setting HM_PRIVATE_TESTING_ACK=true.');
}
const source=path.resolve(root,'public');
const output=path.resolve(root,'dist');
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw Error('Invalid publish directory.');
if(!fs.existsSync(path.join(source,'index.html')))throw Error('public/index.html is required.');
fs.rmSync(output,{recursive:true,force:true});
fs.cpSync(source,output,{recursive:true});
require('./seo.cjs')(output);
require('./check-publish-secrets.cjs')(output);
if(!fs.existsSync(path.join(output,'index.html')))throw Error('Build output is missing index.html.');
console.log('Built dist/ from public/. Netlify publishes only the static website; Functions remain outside it.');
