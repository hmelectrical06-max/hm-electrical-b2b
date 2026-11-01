'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const checkPublishSecrets=require('../scripts/check-publish-secrets.cjs');

test('publish check rejects configured server credentials without printing their values',()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'hm-publish-secrets-'));
 const previous=process.env.HM_EMAIL_PROVIDER_TOKEN;
 const secret='test-resend-secret-value-123';
 try{
  fs.writeFileSync(path.join(output,'index.html'),'<html>public site</html>');
  process.env.HM_EMAIL_PROVIDER_TOKEN=secret;
  assert.doesNotThrow(()=>checkPublishSecrets(output));
  fs.writeFileSync(path.join(output,'config.js'),`window.config="${secret}";`);
  assert.throws(()=>checkPublishSecrets(output),error=>{
   assert.match(error.message,/HM_EMAIL_PROVIDER_TOKEN/);
   assert.match(error.message,/config\.js/);
   assert.ok(!error.message.includes(secret));
   return true;
  });
 }finally{
  if(previous===undefined)delete process.env.HM_EMAIL_PROVIDER_TOKEN;
  else process.env.HM_EMAIL_PROVIDER_TOKEN=previous;
  fs.rmSync(output,{recursive:true,force:true});
 }
});
