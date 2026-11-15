'use strict';
const fs=require('node:fs');
const file='public/index.html';let html=fs.readFileSync(file,'utf8');
if(!html.includes('enquiry-helper.js')){if(!html.includes('</body>'))throw Error('Homepage closing body missing.');html=html.replace('</body>','<link rel="stylesheet" href="/enquiry-helper.css"><script defer src="/enquiry-helper.js"></script></body>');fs.writeFileSync(file,html);}
