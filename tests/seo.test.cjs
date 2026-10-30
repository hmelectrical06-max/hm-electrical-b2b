'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const generate=require('../scripts/seo.cjs');
test('staging and production SEO modes preserve public routes and exclude private pages',()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'hm-seo-'));
 const previous={...process.env};
 try{
  fs.cpSync('public',output,{recursive:true});delete process.env.HM_SITE_MODE;delete process.env.CONTEXT;
  generate(output);
  assert.equal(fs.readdirSync(path.join(output,'products')).length,984);
  assert.equal(fs.readdirSync(path.join(output,'materials')).length,16);
  assert.match(fs.readFileSync(path.join(output,'robots.txt'),'utf8'),/Disallow: \//);
  assert.match(fs.readFileSync(path.join(output,'index.html'),'utf8'),/noindex,nofollow/);
  const sitemap=fs.readFileSync(path.join(output,'sitemap.xml'),'utf8');
  assert.equal([...sitemap.matchAll(/<loc>/g)].length,1003);
  assert.equal([...sitemap.matchAll(/\/products\//g)].length,984);
  assert.match(fs.readFileSync(path.join(output,'catalogue.html'),'utf8'),/name="description"/);
  assert.match(fs.readFileSync(path.join(output,'tools.html'),'utf8'),/name="description"/);
  for(const route of ['/company-profile.html','/privacy.html','/asset-policy.html']){
   assert.match(fs.readFileSync(path.join(output,route.slice(1)),'utf8'),/name="robots" content="noindex,nofollow"/);
   assert.ok(!sitemap.includes(`https://hmelectricalb2b.com${route}`),route);
  }
  for(const match of sitemap.matchAll(/<loc>https:\/\/hmelectricalb2b.com([^<]+)<\/loc>/g)){
   const route=match[1],file=path.join(output,route,route.endsWith('/')?'index.html':'');
   assert.ok(fs.existsSync(file),route);
   const html=fs.readFileSync(file,'utf8');assert.equal([...html.matchAll(/rel="canonical"/g)].length,1,route);
   assert.ok(html.includes(`href="https://hmelectricalb2b.com${route}"`),route);
   if(route.startsWith('/products/')){
    assert.match(html,/"@type":"Product"/,route);
    assert.match(html,/"@type":"BreadcrumbList"/,route);
    assert.doesNotMatch(html,/"(?:offers|aggregateRating|review|price|availability)"/i,route);
    assert.match(html,/MRP on request/,route);
    assert.match(html,/Product-specific photograph is not available/,route);
    assert.match(html,/Product code/,route);
    assert.match(html,/Source catalogue code/,route);
    assert.match(html,/WhatsApp/,route);
    assert.match(html,/Related specifications/,route);
   }
   for(const link of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
    if(/^(?:https?:|mailto:|tel:|data:)/.test(link[1]))continue;
    const clean=link[1].split(/[?#]/)[0];if(!clean)continue;
    const base=clean.startsWith('/')?output:path.dirname(file),dest=path.resolve(base,'.'+(clean.startsWith('/')?clean:'/'+clean));
    assert.ok(fs.existsSync(dest),`${route} -> ${clean}`);
   }
  }
  process.env.HM_SITE_MODE='production';delete process.env.HM_LAUNCH_APPROVED;
  assert.throws(()=>generate(output),/HM_LAUNCH_APPROVED/);
  process.env.HM_LAUNCH_APPROVED='true';process.env.CONTEXT='deploy-preview';assert.throws(()=>generate(output),/forbidden/);
  process.env.CONTEXT='production';fs.cpSync('public',output,{recursive:true});generate(output);
  const productionRobots=fs.readFileSync(path.join(output,'robots.txt'),'utf8');
  assert.match(productionRobots,/Allow: \//);
  assert.match(productionRobots,/Disallow: \/admin\//);
  assert.match(productionRobots,/Sitemap: https:\/\/hmelectricalb2b.com\/sitemap.xml/);
  const productionSitemap=fs.readFileSync(path.join(output,'sitemap.xml'),'utf8');
  assert.equal([...productionSitemap.matchAll(/<loc>/g)].length,1003);
  assert.equal([...productionSitemap.matchAll(/\/products\//g)].length,984);
  assert.doesNotMatch(productionSitemap,/company-profile|privacy\.html|asset-policy|\/admin\//);
  assert.doesNotMatch(fs.readFileSync(path.join(output,'index.html'),'utf8'),/noindex|PRIVATE REVIEW|hmelectricals\.com/);
  assert.match(fs.readFileSync(path.join(output,'catalogue.html'),'utf8'),/name="robots" content="index,follow"/);
  assert.match(fs.readFileSync(path.join(output,'tools.html'),'utf8'),/name="robots" content="index,follow"/);
  assert.match(fs.readFileSync(path.join(output,'catalogue.html'),'utf8'),/name="description"/);
  assert.match(fs.readFileSync(path.join(output,'tools.html'),'utf8'),/name="description"/);
  for(const route of ['/company-profile.html','/privacy.html','/asset-policy.html']){
   assert.match(fs.readFileSync(path.join(output,route.slice(1)),'utf8'),/name="robots" content="noindex,nofollow"/);
  }
  assert.match(fs.readFileSync(path.join(output,'admin/index.html'),'utf8'),/noindex/);
  const headers=fs.readFileSync(path.join(output,'_headers'),'utf8');
  assert.match(headers,/\/admin\/\*[\s\S]*X-Robots-Tag: noindex, nofollow[\s\S]*Cache-Control: no-store/);
  assert.doesNotMatch(headers,/\n\/\*\n\s+X-Robots-Tag: noindex, nofollow/);
  for(const match of productionSitemap.matchAll(/<loc>https:\/\/hmelectricalb2b.com([^<]+)<\/loc>/g)){
   const route=match[1],file=path.join(output,route,route.endsWith('/')?'index.html':'');
   assert.ok(fs.existsSync(file),route);
   const html=fs.readFileSync(file,'utf8');
   assert.equal([...html.matchAll(/rel="canonical"/g)].length,1,route);
   assert.ok(html.includes(`href="https://hmelectricalb2b.com${route}"`),route);
   assert.match(html,/name="robots" content="index,follow"/,route);
   if(route.startsWith('/products/')){
    assert.match(html,/"@type":"Product"/,route);
    assert.match(html,/"@type":"BreadcrumbList"/,route);
    assert.doesNotMatch(html,/"(?:offers|aggregateRating|review|price|availability)"/i,route);
    assert.match(html,/MRP on request/,route);
    assert.match(html,/Product-specific photograph is not available/,route);
    assert.match(html,/Product code/,route);
    assert.match(html,/Source catalogue code/,route);
    assert.match(html,/WhatsApp/,route);
   }
  }
 }finally{process.env=previous;fs.rmSync(output,{recursive:true,force:true});}
});
