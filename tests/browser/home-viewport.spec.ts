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
 // Measure final layout after the platform-section-enter motion completes.
 await page.locator('.platform-home-main').evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
 if(withPartner)await expect(page.locator('.platform-proof [data-testid="partners-carousel"]')).toBeVisible();
}
for(const viewport of standardDesktop)for(const withPartner of [false,true]){
 test(`home fits ${viewport.width}x${viewport.height} with partners=${withPartner}`,async({page},info)=>{
  await page.setViewportSize(viewport);
  await home(page,withPartner);
  expect(await page.evaluate(()=>[document.documentElement,document.body].map(el=>getComputedStyle(el).backgroundColor))).toEqual(['rgb(246, 240, 226)','rgb(246, 240, 226)']);
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

// Header/footer are the same shared chrome in every public section. Measure
// signed-in and anonymous layouts, including both responsive breakpoints.
for(const viewport of [
 {width:320,height:568},{width:390,height:844},
 {width:700,height:440},{width:768,height:440},
 {width:920,height:600},{width:1440,height:900},{width:1920,height:1080}
])for(const signedIn of [false,true]){
 test(`shared header and footer stay aligned across sections ${viewport.width} signedIn=${signedIn}`,async({page})=>{
  await page.setViewportSize(viewport);
  await home(page,false,signedIn);
  const measure=()=>page.evaluate(()=>{
   const box=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
   const footer=document.querySelector('.platform-footer')!,style=getComputedStyle(footer);
   return {header:box('.platform-header'),brand:box('.platform-brand'),nav:box('.platform-navigation'),identity:box('.platform-header-tools'),
    footer:{width:footer.getBoundingClientRect().width,height:footer.getBoundingClientRect().height,padding:style.padding,margin:style.margin,justify:style.justifyContent,
     copyright:getComputedStyle(footer.querySelector('small')!).display,gap:getComputedStyle(footer.querySelector('.platform-footer-links')!).gap,
     buttonFont:getComputedStyle(footer.querySelector('button')!).fontSize},overflow:document.documentElement.scrollWidth-innerWidth};
  });
  const expected=await measure();
  for(const section of ['events','bots','designs','home']){
   await page.getByTestId('nav-'+section).click();
   await expect(page.getByTestId('nav-'+section)).toHaveAttribute('aria-current','page');
   const actual=await measure();
   expect(actual.header).toEqual(expected.header);expect(actual.brand).toEqual(expected.brand);
   expect(actual.nav).toEqual(expected.nav);expect(actual.identity).toEqual(expected.identity);
   expect(actual.footer).toEqual(expected.footer);expect(actual.overflow).toBeLessThanOrEqual(1);
   const nav=actual.nav,identity=actual.identity,brand=actual.brand;
   if(viewport.width>700){
    expect(nav.x).toBeGreaterThanOrEqual(brand.x+brand.width);
    expect(nav.x+nav.width).toBeLessThanOrEqual(identity.x);
    expect(Math.abs(nav.x+nav.width/2-viewport.width/2)).toBeLessThanOrEqual(1);
   }
  }
 });
}

for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:844,height:390},{width:1024,height:768},{width:1366,height:768},{width:1440,height:900}])test(`events catalogue fits the viewport ${viewport.width}x${viewport.height}`,async({page},info)=>{
 await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/auth**',r=>r.fulfill({json:{code:'OK',data:{id:'11111111-1111-4111-8111-111111111111',displayName:'مقدم بُعد'}}}));
 await page.route('**/api/host',r=>r.fulfill({json:{code:'OK',data:{credits:2,events:[{eventId:'fit-fixture',title:'فعالية',phase:'live',version:1,state:{phase:'live',winners:[],prizes:[]}}],products:[],contentVersions:[]}}}));
 await page.goto('/?screen=events');await expect(page.getByTestId('event-carousel')).toBeVisible();await expect(page.getByTestId('event-setup')).toBeVisible();
 const fits=async()=>{const dimensions=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,h:innerHeight,w:innerWidth}));expect(dimensions.height).toBeLessThanOrEqual(dimensions.h+1);expect(dimensions.width).toBeLessThanOrEqual(dimensions.w+1);
 for(const selector of ['.platform-header','.platform-footer','.platform-gallery-intro','.bud-carousel-navigation','.bud-carousel-status','.bud-events-slide:not([inert])>.platform-product-card']){const b=await page.locator(selector).boundingBox();expect(b,selector).not.toBeNull();expect(b!.y,selector).toBeGreaterThanOrEqual(0);expect(b!.y+b!.height,selector).toBeLessThanOrEqual(viewport.height+1);}};
 await fits();const cardBounds=await page.locator('.bud-events-slide:not([inert])>article').boundingBox();for(const sample of await page.locator('.qc-demo-card').all()){const b=await sample.boundingBox();expect(b!.x).toBeGreaterThanOrEqual(cardBounds!.x+5);expect(b!.x+b!.width).toBeLessThanOrEqual(cardBounds!.x+cardBounds!.width-5);}
 for(const id of ['event-resume','event-setup','product-card-qc']){const b=await page.getByTestId(id).boundingBox();expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.y+b!.height).toBeLessThanOrEqual(viewport.height);const card=await page.locator('.bud-events-slide:not([inert])>article').boundingBox();expect(b!.y+b!.height).toBeLessThanOrEqual(card!.y+card!.height-5);}
 await page.screenshot({path:info.outputPath('events-fit.png')});
 for(const title of ['ميني قيمز','كروت الحظ']){await page.getByRole('button',{name:'عرض فعالية '+title,exact:true}).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await fits();}
 await page.getByRole('button',{name:'عرض فعالية سؤال وشرط',exact:true}).click();await page.getByTestId('event-how').click();await expect(page.getByRole('dialog',{name:'كيف ابدأ؟'})).toBeVisible();
});
