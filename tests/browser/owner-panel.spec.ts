import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
const id='11111111-1111-4111-8111-111111111111';
const ok=(data:unknown)=>({status:200,json:{code:'OK',data}});
async function setup(page:Page,owner=true){
 await page.route('**/api/auth?action=session',r=>r.fulfill(ok({id,displayName:'حساب الاختبار'})));
 await page.route('**/api/host',r=>r.fulfill(ok({credits:2,events:[],products:[],contentVersions:[]})));
 await page.route('**/api/owner',r=>{
  const body=r.request().postDataJSON();
  if(body.action==='profile')return r.fulfill(ok({owner}));
  if(body.action==='view')return r.fulfill(ok(body.section==='overview'?{users:3,slots:2,pendingOrders:1,alerts:[]}:
   body.section==='health'?{database:'ok',discord:'unknown',whop:'unknown',vercel:'unknown'}:
   {rows:body.section==='users'?[{id,name:'مستخدم تجريبي',discord_id:'123456789012345678'}]:[]}));
  return r.fulfill(ok({id,replayed:false,code:'BUD-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'}));
 });
 await page.goto('/?screen=events');
 await page.locator('.platform-account-trigger').click();
 await page.getByRole('menuitem',{name:'الملف الشخصي'}).click();
 await expect(page.getByRole('heading',{name:'الملف الشخصي',exact:true})).toBeVisible();
}
for(const size of [{width:1440,height:900},{width:390,height:844}])test(`owner panel includes all nine sections and has no horizontal clipping ${size.width}`,async({page})=>{
 await page.setViewportSize(size);await setup(page);
 await page.getByRole('button',{name:'لوحة المالك',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'أقسام لوحة المالك'});await expect(nav.getByRole('button')).toHaveCount(9);
 await expect(page.getByRole('heading',{name:'نظرة عامة وتنبيهات'})).toBeVisible();
 await nav.getByRole('button',{name:'المستخدمون',exact:true}).click();await expect(page.getByRole('button',{name:'فتح ملف المستخدم'})).toBeVisible();
 await nav.getByRole('button',{name:'صحة النظام',exact:true}).click();await expect(page.getByText('غير معروف',{exact:true}).first()).toBeVisible();
 await nav.getByRole('button',{name:'المفاتيح والمنح',exact:true}).click();await expect(page.getByRole('heading',{name:'إنشاء مفتاح هدية أو حملة'})).toBeVisible();
 const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
 await page.screenshot({path:`docs/evidence/owner-panel-${size.width}.png`,fullPage:true});
});
test('profile is the sole redeem entry, ordinary user has no owner entry and invalid code can be corrected',async({page})=>{
 await setup(page,false);await expect(page.getByRole('button',{name:'لوحة المالك',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'استرداد مفتاح',exact:true}).click();
 await page.route('**/api/owner',r=>r.fulfill({status:400,json:{code:'INVALID_OR_EXPIRED_CODE'}}));
 await page.getByLabel('المفتاح',{exact:true}).fill('BUD-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');await page.getByRole('button',{name:'استرداد',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('المفتاح غير صالح أو غير متاح للاستخدام.');await expect(page.getByLabel('المفتاح',{exact:true})).toBeEnabled();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('lost redeem response retries the same operation, then refreshes wallet',async({page})=>{
 await setup(page,false);const requests:any[]=[];
 await page.route('**/api/owner',r=>{const body=r.request().postDataJSON();if(body.action==='profile')return r.fulfill(ok({owner:false}));requests.push(body);return requests.length===1?r.abort('connectionfailed'):r.fulfill(ok({receipt:id,credits:3}));});
 await page.getByRole('button',{name:'استرداد مفتاح',exact:true}).click();await page.getByLabel('المفتاح',{exact:true}).fill('BUD-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');await page.getByRole('button',{name:'استرداد',exact:true}).click();
 await expect(page.getByRole('button',{name:'التحقق من الطلب السابق'})).toBeVisible();await page.getByRole('button',{name:'التحقق من الطلب السابق'}).click();
 await expect(page.getByRole('status')).toContainText('تم استرداد المفتاح');expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
});
test('owner mutation requires reason and confirmation; one-time code is removed when closing',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'لوحة المالك',exact:true}).click();await page.getByRole('navigation',{name:'أقسام لوحة المالك'}).getByRole('button',{name:'المفاتيح والمنح'}).click();
 await page.getByLabel('انتهاء الصلاحية').fill('2027-01-01T12:00');await page.getByRole('button',{name:'مراجعة إنشاء المفتاح'}).click();
 await expect(page.getByRole('button',{name:'تأكيد التنفيذ'})).toBeDisabled();await page.getByLabel('سبب الإجراء').fill('هدية للمجتمع');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await expect(page.locator('output.owner-secret')).toHaveText('BUD-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await expect(page.locator('output.owner-secret')).toHaveCount(0);
});
