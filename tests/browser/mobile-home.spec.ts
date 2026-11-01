import {test,expect} from '@playwright/test';
const sizes=[{width:320,height:568},{width:360,height:640},{width:375,height:667},{width:390,height:844},{width:393,height:852},{width:430,height:932},{width:667,height:375}];
for(const size of sizes){
 test('mobile home flow and menu '+size.width+'x'+size.height,async({page},info)=>{
  await page.setViewportSize(size);
  await page.route('**/api/auth?action=session',r=>r.fulfill({status:200,json:{code:'OK',data:{id:'11111111-1111-4111-8111-111111111111',displayName:'407i'}}}));
  await page.route('**/api/host',r=>r.fulfill({status:200,json:{code:'OK',data:{credits:1,events:[],products:[],contentVersions:[]}}}));
  await page.route('**/api/owner?public=partners',r=>r.fulfill({json:{code:'OK',data:[{id:'44444444-4444-4444-8444-444444444444',name:'Rais',logoUrl:'https://cdn.example.com/logo.svg',websiteUrl:'https://discord.gg/raiss'}]}}));
  await page.route('https://cdn.example.com/logo.svg',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#fbb03b"/></svg>'}));
  await page.route('**/api/owner?public=reviews',r=>r.fulfill({json:{code:'OK',data:[{id:'22222222-2222-4222-8222-222222222222',name:'تجربة حقيقية',comment:'أعجبني تنظيم الفعالية',avatarUrl:null}]}}));
  await page.goto('/');
  const menu=page.getByRole('button',{name:'فتح قائمة التنقل'});await expect(menu).toBeVisible();
  await expect(page.getByTestId('nav-events')).not.toBeVisible();
  const art=page.locator('.platform-mobile-art'),cta=page.getByTestId('hero-explore');
  await expect(art).toBeVisible();await expect(cta).toBeVisible();
  const metrics=await page.evaluate(()=>{
   const rect=(q:string)=>{const r=document.querySelector(q)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height}};
   return {cta:rect('[data-testid=hero-explore]'),art:rect('.platform-mobile-art'),partners:rect('.platform-partners-mobile'),reviews:rect('.platform-reviews-mobile'),footer:rect('.platform-footer'),width:document.documentElement.scrollWidth,viewport:innerWidth,height:document.documentElement.scrollHeight};
  });
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport+1);
  expect(metrics.cta.bottom).toBeLessThan(metrics.art.y);
  expect(metrics.art.bottom).toBeLessThanOrEqual(metrics.partners.y+1);
  expect(metrics.partners.bottom).toBeLessThanOrEqual(metrics.reviews.y+1);
  expect(metrics.reviews.bottom).toBeLessThanOrEqual(metrics.footer.y+1);
  await expect(page.locator('.platform-partners-mobile')).toContainText('شركاؤنا');
  await expect(page.locator('.platform-reviews-mobile')).toContainText('أعجبني تنظيم الفعالية');
  await page.screenshot({path:info.outputPath('mobile-home-'+size.width+'x'+size.height+'.png'),fullPage:true,animations:'disabled'});
  await menu.click();await expect(page.getByTestId('nav-events')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByTestId('nav-events')).not.toBeVisible();
  await expect(menu).toBeFocused();
  await menu.click();await page.getByTestId('nav-events').click();
  await expect(page.getByTestId('event-carousel')).toBeVisible();
  await expect(page.getByTestId('nav-events')).not.toBeVisible();
 });
}
for(const size of [{width:768,height:1024},{width:820,height:1180},{width:1024,height:768},{width:1440,height:900},{width:844,height:390}]){
 test('tablet desktop navigation unaffected '+size.width+'x'+size.height,async({page})=>{
  await page.setViewportSize(size);await page.goto('/');
  await expect(page.getByTestId('hero-explore')).toBeVisible();
  await expect(page.getByTestId('nav-events')).toBeVisible();
  await expect(page.getByRole('button',{name:'فتح قائمة التنقل'})).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 });
}
