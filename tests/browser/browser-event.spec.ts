import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const ok=(data:unknown)=>({status:200,json:{code:'OK',data}});
const content={version:'test-local-v1',questions:['دولة','مدينة'],conditions:['تبدأ بحرف س','من كلمتين'],pairs:[['0','0'],['1','1']]};
async function setup(page:Page,base=''){
 const requests:any[]=[];
 await page.route('**/api/auth?action=session',r=>r.fulfill(ok({id:owner,displayName:'حساب محلي'})));
 await page.route('**/api/host',r=>{const body=r.request().postDataJSON();requests.push(body);if(body.action==='dashboard')return r.fulfill(ok({runtime:'browser-v1',ownerId:owner,credits:2,events:[],products:[{id:'question-condition',name:'سؤال وشرط',available:true,slotCost:1}],contentVersions:[{id:content.version,questionCount:2,conditionCount:2}]}));if(body.action==='localStart')return r.fulfill(ok({eventId:id,title:body.title,storage:'browser-v1',ownerId:owner}));if(body.action==='localContent')return r.fulfill(ok({eventId:id,ownerId:owner,title:'سؤال وشرط',expiresAt:new Date(Date.now()+4*3600000).toISOString(),content,legacy:null}));if(body.action==='localFinish')return r.fulfill(ok({closed:true}));return r.fulfill({status:400,json:{code:'UNEXPECTED_GAMEPLAY_UPLOAD'}});});
 await page.goto(base+'/?screen=events');return requests;
}
async function start(page:Page){await page.getByTestId('event-setup').click();await expect(page.getByText(/تُحفظ الفعالية ونتائجها في هذا المتصفح فقط/)).toHaveCount(0);await expect(page.locator('#host-attempts')).toHaveCount(0);await page.locator('#host-prizes').fill('جائزة محلية خاصة');await page.getByRole('switch',{name:'تفعيل المؤقت',exact:true}).click();await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();await expect(page.locator('.manual-game')).toBeVisible();await expect(page.locator('.mg-disclosure')).toHaveCount(0);await expect(page.getByRole('button',{name:'اكشف سؤال',exact:true})).toBeVisible();}
test('browser game starts timer immediately, persists locally and never uploads gameplay or private prizes',async({page,context})=>{
 const requests=await setup(page);await page.evaluate(owner=>localStorage.setItem(`bud-host-setup-draft:v1:${owner}`,JSON.stringify({schema:1,title:'سؤال وشرط',prizeText:'',config:{duration:5,timerEnabled:false,attempts:3},savedAt:Date.now()})),owner);await start(page);const before=requests.length;
 const paid=requests.find(x=>x.action==='localStart');expect(Object.keys(paid).sort()).toEqual(['action','idempotencyKey','title']);expect(JSON.stringify(requests)).not.toContain('جائزة محلية خاصة');
 await context.setOffline(true);await page.getByRole('button',{name:'اكشف سؤال',exact:true}).click();await page.getByRole('button',{name:'اكشف شرط',exact:true}).click();await expect(page.getByRole('timer')).toHaveText('5');await expect(page.getByRole('button',{name:'صحيحة',exact:true})).toBeEnabled();await page.getByRole('button',{name:'صحيحة',exact:true}).click();await page.getByLabel('اسم الفائز',{exact:true}).fill('اسم محلي خاص');await page.getByRole('button',{name:'إضافة الفائز',exact:true}).click();await expect(page.getByRole('dialog',{name:'تسجيل الفائز',exact:true})).not.toBeVisible();expect(requests).toHaveLength(before);
 const record=await page.evaluate(({owner,id})=>JSON.parse(localStorage.getItem(`bud-browser-event:v1:${owner}:${id}`)!),{owner,id});expect(record.state.config.attempts).toBe(1);expect(record.state.winners[0].name).toBe('اسم محلي خاص');expect(record.state.round).toBe(1);await expect(page.locator('.mg-remote-status')).toHaveCount(0);
 await context.setOffline(false);await page.reload();await expect(page.getByRole('button',{name:/الفائزون/})).toContainText('1/1');expect(requests).toHaveLength(before);
});
test('another tab cannot write the same locally saved event',async({page,context})=>{
 await setup(page);await start(page);const other=await context.newPage();await other.goto(page.url());await other.evaluate(({owner,id})=>sessionStorage.setItem('bud-browser-event:active',JSON.stringify({ownerId:owner,eventId:id})),{owner,id});await other.reload();await expect(other.getByRole('heading',{name:'الفعالية مفتوحة في تبويب آخر'})).toBeVisible();await expect(other.getByRole('button',{name:'اكشف سؤال',exact:true})).toHaveCount(0);await other.close();
});
test('unavailable local storage stops before paying for a new run',async({page})=>{
 const requests=await setup(page);await page.evaluate(()=>{Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem:()=>{throw Error('fixture storage blocked');},removeItem:()=>{}}});});await page.getByTestId('event-setup').click();await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();await expect(page.getByRole('alert')).toContainText('الحفظ المحلي');expect(requests.some(x=>x.action==='localStart')).toBe(false);
});
test('a cached application can reload an ongoing local event offline without server recovery',async({page,context})=>{
 await setup(page,'http://127.0.0.1:4175');await page.evaluate(async()=>{await navigator.serviceWorker.ready;await new Promise<void>(resolve=>{if(navigator.serviceWorker.controller)resolve();else navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true});});});
 await start(page);await page.getByRole('button',{name:'اكشف سؤال',exact:true}).click();
 await expect.poll(()=>page.evaluate(async()=>{
  const cache=await caches.open('bud-public-app-v1');
  const assets=Array.from(new Set([
   ...Array.from(document.scripts).map(script=>script.src),
   ...performance.getEntriesByType('resource').map(entry=>entry.name),
  ].filter(name=>{try{const url=new URL(name);return url.origin===location.origin&&url.pathname.startsWith('/assets/')&&!url.search;}catch{return false;}})));
  if(assets.length<2 || !(await cache.match('/')))return false;
  return (await Promise.all(assets.map(url=>cache.match(url)))).every(Boolean);
 }),{timeout:15000}).toBe(true);
 const cached=await page.evaluate(async()=>(await (await caches.open('bud-public-app-v1')).keys()).map(r=>r.url));expect(cached.some(url=>url.includes('/api/'))).toBe(false);await context.setOffline(true);await page.reload();await expect(page.getByRole('button',{name:'اكشف سؤال',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'اكشف شرط',exact:true}).click();await expect(page.getByRole('timer')).toHaveText('5');
});

test('deleted local progress shows explicit loss and never requests cloud recovery',async({page})=>{
 const calls=await setup(page);await start(page);const count=calls.length;await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.getByRole('heading',{name:'الحفظ المحلي غير موجود'})).toBeVisible();expect(calls).toHaveLength(count);
});
test('a failed save during offline play is explicit and the current session keeps responding',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await start(page);await context.setOffline(true);await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota fixture');};});await page.getByRole('button',{name:'اكشف سؤال',exact:true}).click();await expect(page.getByRole('alert')).toContainText('التقدم الحالي مؤقت');await page.getByRole('button',{name:'اكشف شرط',exact:true}).click();await expect(page.getByRole('button',{name:'صحيحة',exact:true})).toBeEnabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'test-results/local-game-mobile.png'});
});

for(const width of [390,1440])test(`circle timer follows the saved deadline across reload and resets on the next round ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await page.clock.install();const calls=await setup(page);await start(page);const timer=page.getByRole('timer');const arc=timer.locator('.event-countdown-progress');
 await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1000);
 await expect(timer).toHaveText('5');await page.clock.runFor(1200);expect(Number(await arc.getAttribute('stroke-dashoffset'))).toBe(0);
 await page.getByRole('button',{name:'اكشف سؤال',exact:true}).click();await page.clock.runFor(1200);expect(Number(await arc.getAttribute('stroke-dashoffset'))).toBe(0);
 await page.getByRole('button',{name:'اكشف شرط',exact:true}).click();await page.clock.runFor(2100);await expect(timer).toHaveText('3');const savedOffset=Number(await arc.getAttribute('stroke-dashoffset'));expect(savedOffset).toBeGreaterThan(100);const savedDeadline=await page.evaluate(({owner,id})=>JSON.parse(localStorage.getItem(`bud-browser-event:v1:${owner}:${id}`)!).state.deadline,{owner,id});const count=calls.length;await page.clock.resume();await page.reload();await expect(page.getByRole('button',{name:'اكشف سؤال',exact:true})).toBeVisible();await page.clock.pauseAt((await page.evaluate(()=>Date.now()))+1000);await expect(timer).toHaveText(/^[0-3]$/);expect(await page.evaluate(({owner,id})=>JSON.parse(localStorage.getItem(`bud-browser-event:v1:${owner}:${id}`)!).state.deadline,{owner,id})).toBe(savedDeadline);expect(Number(await arc.getAttribute('stroke-dashoffset'))).toBeGreaterThanOrEqual(savedOffset-2);expect(calls).toHaveLength(count);
 await page.screenshot({path:info.outputPath('circle-timer.png')});await page.clock.runFor(3100);await expect(timer).toHaveText('0');await expect(timer).toHaveAttribute('data-expired','true');await expect(page.getByRole('button',{name:'خاطئة',exact:true})).toBeEnabled();await page.getByRole('button',{name:'خاطئة',exact:true}).click();await expect(timer).toHaveText('5');expect(Number(await arc.getAttribute('stroke-dashoffset'))).toBe(0);expect(calls).toHaveLength(count);
});
test('circle timer honors reduced motion without hiding the remaining time or progress',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.clock.install();await setup(page);await start(page);await page.getByRole('button',{name:'اكشف سؤال',exact:true}).click();await page.getByRole('button',{name:'اكشف شرط',exact:true}).click();await page.clock.runFor(4100);const timer=page.getByRole('timer');await expect(timer).toHaveText('1');await expect(timer).toHaveAttribute('data-urgent','true');expect(await timer.locator('.event-countdown-progress').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');await expect(timer.locator('svg')).toBeVisible();
});


test('the live browser event randomizes prize-to-card mapping once and preserves it on reload',async({page})=>{
 const entered=['الجائزة الذهبية','الجائزة الفضية','الجائزة البرونزية','القسيمة الخاصة'];
 await setup(page);
 await page.getByTestId('event-setup').click();
 await page.locator('#host-prizes').fill(entered.join('\n'));
 await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();
 await expect(page.getByRole('button',{name:'اكشف سؤال',exact:true})).toBeVisible();
 const readPrizes=()=>page.evaluate(({owner,id})=>{
  const stored=localStorage.getItem('bud-browser-event:v1:'+owner+':'+id);
  return JSON.parse(stored!).state.prizes as {id:string;name:string;revealed:boolean;winnerId:string|null}[];
 },{owner,id});
 const before=await readPrizes();
 expect(before.map(p=>p.id)).toEqual(['prize-1','prize-2','prize-3','prize-4']);
 expect(before.map(p=>p.name).sort()).toEqual([...entered].sort());
 // An unbiased random shuffle can reproduce input order by chance.
 // The persisted mapping, not visual nonidentity, is what must remain fixed.
 expect(before.every(p=>p.revealed===false&&p.winnerId===null)).toBe(true);
 await page.getByRole('button',{name:'صفحة الجوائز',exact:true}).click();
 await expect(page.locator('.mg-prize-card')).toHaveCount(entered.length);
 for(const name of entered)await expect(page.locator('.mg-prize-grid')).not.toContainText(name);
 await page.reload();
 await expect(page.locator('.mg-prize-card')).toHaveCount(entered.length);
 expect(await readPrizes()).toEqual(before);
 await expect(page.getByRole('button',{name:'فتح دون اسم',exact:true})).toHaveCount(0);
 await expect(page.locator('.mg-prize-card').first()).toBeEnabled();
 await page.locator('.mg-prize-card').first().click();
 await page.getByRole('button',{name:'كشف الجائزة',exact:true}).click();
 await expect(page.locator('.mg-result-prize')).toHaveText(before[0].name);
 const after=await readPrizes();
 expect(after.map(p=>p.name)).toEqual(before.map(p=>p.name));
 expect(after[0].revealed).toBe(true);
 expect(after.slice(1).every(p=>!p.revealed)).toBe(true);
});

test('event-start loader advances only when the server confirms each milestone',async({page})=>{
 await setup(page);
 let releaseStart!:()=>void,releaseContent!:()=>void;let starts=0;
 const startGate=new Promise<void>(r=>{releaseStart=r;}),contentGate=new Promise<void>(r=>{releaseContent=r;});
 await page.route('**/api/host',async route=>{
  const body=route.request().postDataJSON();
  if(body.action==='localStart'){starts++;await startGate;return route.fulfill(ok({eventId:id,title:body.title,storage:'browser-v1',ownerId:owner}));}
  if(body.action==='localContent'){await contentGate;return route.fulfill(ok({eventId:id,ownerId:owner,title:'سؤال وشرط',expiresAt:new Date(Date.now()+4*3600000).toISOString(),content,legacy:null}));}
  return route.fallback();
 });
 await page.getByTestId('event-setup').click();await page.getByRole('button',{name:'بدء الفعالية',exact:true}).click();
 const loader=page.getByRole('dialog',{name:'جارٍ تجهيز الفعالية'});
 await expect(loader).toBeVisible();await expect(loader.locator('li[data-state=current]')).toHaveText('التحقق من المفتاح وبدء الطلب');
 await expect(loader.locator('li[data-state=done]')).toHaveCount(0);
 await page.waitForTimeout(2200);
 await expect(loader.locator('li[data-state=done]')).toHaveCount(0);
 releaseStart();await expect(loader.locator('li[data-state=current]')).toHaveText('تجهيز محتوى الفعالية');
 await expect(loader.locator('li[data-state=done]')).toHaveCount(1);
 releaseContent();await expect(loader).not.toBeVisible();await expect(page.locator('.manual-game')).toBeVisible();await expect(page.locator('.mg-disclosure')).toHaveCount(0);expect(starts).toBe(1);
});
