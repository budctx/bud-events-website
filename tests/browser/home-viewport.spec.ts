import {test,expect} from '@playwright/test';

// The public home is a viewport composition: the illustration must retain its
// aspect ratio and the approved hero/proof/footer must remain readable.
const standardDesktop=[
 {width:1753,height:864},
 {width:1440,height:900},
 {width:1366,height:768},
 {width:1024,height:768},
];
async function home(page:import('@playwright/test').Page,withPartner=false,signedIn=false){
 await page.route('**/api/auth?action=session',r=>r.fulfill(signedIn?{status:200,json:{code:'OK',data:{id:'11111111-1111-4111-8111-111111111111',displayName:'407i'}}}:{status:401,json:{code:'DISCORD_AUTH_REQUIRED'}}));
 if(signedIn)await page.route('**/api/host',r=>r.fulfill({status:200,json:{code:'OK',data:{credits:1,events:[],products:[],contentVersions:[]}}}));
 await page.route('**/api/owner?public=partners',r=>r.fulfill({status:200,json:{code:'OK',data:withPartner?[{id:'44444444-4444-4444-8444-444444444444',name:'Rais',logoUrl:'https://cdn.example.com/logo.png',websiteUrl:'https://discord.gg/raiss'}]:[]}}));
 await page.route('https://cdn.example.com/logo.png',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#fbb03b"/></svg>'}));
 await page.goto('/?lang=ar');
 await expect(page.getByTestId('hero-explore')).toBeVisible();
 await expect.poll(()=>page.locator('.platform-scene img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 if(withPartner)await expect(page.locator('.platform-proof [data-testid="partners-carousel"]')).toBeVisible();
}
for(const viewport of standardDesktop)for(const withPartner of [false,true]){
 test(`home fits ${viewport.width}x${viewport.height} with partners=${withPartner}`,async({page},info)=>{
  await page.setViewportSize(viewport);
  await home(page,withPartner);
  const metrics=await page.evaluate(()=>{
   const box=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
   return {viewport:{width:innerWidth,height:innerHeight},docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,
    scene:box('.platform-scene'),header:box('.platform-header'),hero:box('.platform-hero'),proof:box('.platform-proof'),footer:box('.platform-footer')};
  });
  expect(metrics.docWidth).toBeLessThanOrEqual(viewport.width+1);
  expect(metrics.docHeight).toBeLessThanOrEqual(viewport.height+2);
  expect(metrics.header.bottom).toBeLessThan(metrics.hero.top);
  expect(metrics.hero.bottom).toBeLessThanOrEqual(metrics.proof.top+1);
  expect(metrics.proof.bottom).toBeLessThanOrEqual(metrics.footer.top+1);
  expect(metrics.footer.bottom).toBeLessThanOrEqual(viewport.height+1);
  expect(metrics.scene.bottom).toBeLessThanOrEqual(viewport.height+1);
  expect(metrics.scene.top).toBeGreaterThanOrEqual(-1);
  expect(metrics.scene.width/metrics.scene.height).toBeCloseTo(1.5,2);
  await page.screenshot({path:info.outputPath(`home-viewport-${viewport.width}-partners-${withPartner}.png`),animations:'disabled'});
 });
}
for(const viewport of [{width:390,height:844},{width:375,height:667},{width:320,height:568},{width:920,height:600}]){
 test(`home remains readable on constrained ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);
  await home(page);
  const bounds=await page.evaluate(()=>{
   const h=document.querySelector('.platform-hero')!.getBoundingClientRect();
   const f=document.querySelector('.platform-footer')!.getBoundingClientRect();
   return {bodyWidth:document.documentElement.scrollWidth,screenWidth:innerWidth,heroBottom:h.bottom,footerTop:f.top};
  });
  expect(bounds.bodyWidth).toBeLessThanOrEqual(bounds.screenWidth+1);
  expect(bounds.heroBottom).toBeLessThanOrEqual(bounds.footerTop+2);
  await expect(page.getByTestId('hero-explore')).toBeEnabled();
  await expect(page.getByRole('button',{name:'الدعم'})).toBeVisible();
 });
}

/* Owner-approved wide layout: align navigation and footer to the viewport
   edges, rather than centering a fixed 1312px container on large monitors. */
for(const viewport of [
 {width:1366,height:768},{width:1440,height:900},
 {width:1753,height:864},{width:1920,height:1080}
])for(const signedIn of [false,true]){
 test('home edge gutters '+viewport.width+'x'+viewport.height+' signedIn='+signedIn,async({page})=>{
  await page.setViewportSize(viewport);
  await home(page,false,signedIn);
  if(signedIn)await expect(page.locator('.platform-account-trigger')).toBeVisible();
  const metrics=await page.evaluate(signedIn=>{
   const rect=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
   return {
    brand:rect('.platform-brand'),
    identity:rect(signedIn?'.platform-account-trigger':'.platform-login'),
    navigation:rect('.platform-navigation'),
    headline:rect('.platform-hero'),
    footerCopyright:rect('.platform-footer small'),
    footerLinks:rect('.platform-footer-links'),
    horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
    verticalOverflow:document.documentElement.scrollHeight-innerHeight
   };
  },signedIn);
  expect(metrics.brand.left).toBeGreaterThanOrEqual(60);
  expect(metrics.brand.left).toBeLessThanOrEqual(68);
  expect(metrics.footerCopyright.left).toBeGreaterThanOrEqual(60);
  expect(metrics.footerCopyright.left).toBeLessThanOrEqual(68);
  expect(viewport.width-metrics.identity.right).toBeGreaterThanOrEqual(60);
  expect(viewport.width-metrics.identity.right).toBeLessThanOrEqual(68);
  expect(viewport.width-metrics.footerLinks.right).toBeGreaterThanOrEqual(60);
  expect(viewport.width-metrics.footerLinks.right).toBeLessThanOrEqual(68);
  expect(metrics.navigation.left).toBeGreaterThanOrEqual(metrics.brand.right+12);
  expect(metrics.navigation.right).toBeLessThanOrEqual(metrics.identity.left-12);
  expect((metrics.navigation.left+metrics.navigation.right)/2).toBeGreaterThanOrEqual(viewport.width/2-4);
  expect((metrics.navigation.left+metrics.navigation.right)/2).toBeLessThanOrEqual(viewport.width/2+4);
  expect(metrics.headline.right).toBeLessThanOrEqual(viewport.width-60);
  expect(metrics.headline.right).toBeGreaterThanOrEqual(viewport.width-69);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(metrics.verticalOverflow).toBeLessThanOrEqual(2);
 });
}
