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
test('account menu is the redeem entry, ordinary user has no owner entry and invalid code can be corrected',async({page})=>{
 await setup(page,false);await expect(page.getByRole('button',{name:'لوحة المالك',exact:true})).toHaveCount(0);
 await page.locator('.platform-account-trigger').click();await page.getByRole('menuitem',{name:'استرداد مفتاح',exact:true}).click();
 await page.route('**/api/owner',r=>r.fulfill({status:400,json:{code:'INVALID_OR_EXPIRED_CODE'}}));
 await page.getByLabel('المفتاح',{exact:true}).fill('BUD-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');await page.getByRole('button',{name:'استرداد',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('المفتاح غير صالح أو غير متاح للاستخدام.');await expect(page.getByLabel('المفتاح',{exact:true})).toBeEnabled();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('lost redeem response retries the same operation, then refreshes wallet',async({page})=>{
 await setup(page,false);const requests:any[]=[];
 await page.route('**/api/owner',r=>{const body=r.request().postDataJSON();if(body.action==='profile')return r.fulfill(ok({owner:false}));requests.push(body);return requests.length===1?r.abort('connectionfailed'):r.fulfill(ok({receipt:id,credits:3}));});
 await page.locator('.platform-account-trigger').click();await page.getByRole('menuitem',{name:'استرداد مفتاح',exact:true}).click();await page.getByLabel('المفتاح',{exact:true}).fill('BUD-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');await page.getByRole('button',{name:'استرداد',exact:true}).click();
 await expect(page.getByRole('button',{name:'التحقق من الطلب السابق'})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await page.locator('.platform-account-trigger').click();await page.getByRole('menuitem',{name:'استرداد مفتاح',exact:true}).click();await page.getByRole('button',{name:'التحقق من الطلب السابق'}).click();
 await expect(page.getByRole('status')).toContainText('تم استرداد المفتاح');expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
});
test('owner mutation requires reason and confirmation; one-time code is removed when closing',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'لوحة المالك',exact:true}).click();await page.getByRole('navigation',{name:'أقسام لوحة المالك'}).getByRole('button',{name:'المفاتيح والمنح'}).click();
 await page.getByLabel('انتهاء الصلاحية').fill('2027-01-01T12:00');await page.getByRole('button',{name:'مراجعة إنشاء المفتاح'}).click();
 await expect(page.getByRole('button',{name:'تأكيد التنفيذ'})).toBeDisabled();await page.getByLabel('سبب الإجراء').fill('هدية للمجتمع');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await expect(page.locator('output.owner-secret')).toHaveText('BUD-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await expect(page.locator('output.owner-secret')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify({...sessionStorage}))).not.toContain('BUD-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
});
test('uncertain administrative grant remains the same operation after closing the dialog and reloading',async({page})=>{
 await setup(page);const requests:any[]=[];let committed=false;
 await page.route('**/api/owner',r=>{
  const body=r.request().postDataJSON();
  if(body.action==='profile')return r.fulfill(ok({owner:true}));
  if(body.action==='view')return r.fulfill(ok({rows:[]}));
  if(body.action==='receipt')return r.fulfill(ok({found:committed,kind:'grant',result:{id,replayed:true}}));
  requests.push(body);committed=true;return r.abort('connectionfailed');
 });
 await page.getByRole('button',{name:'لوحة المالك',exact:true}).click();await page.getByRole('navigation',{name:'أقسام لوحة المالك'}).getByRole('button',{name:'المفاتيح والمنح'}).click();
 await page.getByLabel('معرّف الحساب الموثق').fill(id);await page.getByRole('button',{name:'مراجعة المنحة'}).click();
 await page.getByLabel('سبب الإجراء').fill('منحة يجب ألا تتكرر');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await expect(page.getByLabel('سبب الإجراء')).toBeDisabled();
 await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();await page.reload();
 await page.locator('.platform-account-trigger').click();await page.getByRole('menuitem',{name:'الملف الشخصي'}).click();await page.getByRole('button',{name:'لوحة المالك',exact:true}).click();
 await page.getByRole('button',{name:'التحقق من العملية السابقة',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await expect(page.getByRole('dialog').getByRole('status')).toContainText('العملية السابقة');expect(requests).toHaveLength(1);
});
test('profile distinguishes an unavailable permission check from an ordinary account and can retry',async({page})=>{
 await setup(page);let unavailable=true;
 await page.route('**/api/owner',r=>r.fulfill(unavailable?{status:503,json:{code:'OWNER_BACKEND_UNAVAILABLE'}}:ok({owner:true})));
 await page.getByRole('button',{name:'العودة للموقع'}).click();await page.locator('.platform-account-trigger').click();await page.getByRole('menuitem',{name:'الملف الشخصي'}).click();
 await expect(page.getByRole('alert')).toContainText('تعذر التحقق من صلاحيات الحساب');unavailable=false;
 await page.getByRole('button',{name:'إعادة التحقق من الصلاحيات'}).click();await expect(page.getByRole('button',{name:'لوحة المالك',exact:true})).toBeVisible();
});
test('an absent grant receipt retries the original frozen payload rather than opening a different grant',async({page})=>{
 await setup(page);const requests:any[]=[];
 await page.route('**/api/owner',r=>{
  const body=r.request().postDataJSON();if(body.action==='profile')return r.fulfill(ok({owner:true}));if(body.action==='view')return r.fulfill(ok({rows:[]}));
  if(body.action==='receipt')return r.fulfill(ok({found:false}));
  requests.push(body);return requests.length===1?r.abort('connectionfailed'):r.fulfill(ok({id,replayed:false}));
 });
 await page.getByRole('button',{name:'لوحة المالك',exact:true}).click();await page.getByRole('navigation',{name:'أقسام لوحة المالك'}).getByRole('button',{name:'المفاتيح والمنح'}).click();
 await page.getByLabel('معرّف الحساب الموثق').fill(id);await page.getByRole('button',{name:'مراجعة المنحة'}).click();await page.getByLabel('سبب الإجراء').fill('الطلب الأصلي');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await expect(page.getByLabel('سبب الإجراء')).toBeDisabled();await page.getByRole('dialog').getByRole('button',{name:'إغلاق',exact:true}).click();
 await page.getByRole('button',{name:'مراجعة المنحة'}).click();await expect(page.getByLabel('سبب الإجراء')).toHaveValue('الطلب الأصلي');await page.getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await expect(page.getByRole('dialog').getByRole('status')).toContainText('تمت العملية');expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
});
test('unavailable tab storage blocks administrative dispatch before a mutation is sent',async({page})=>{
 await setup(page);let mutations=0;
 await page.route('**/api/owner',r=>{const body=r.request().postDataJSON();if(body.action==='profile')return r.fulfill(ok({owner:true}));if(body.action==='view')return r.fulfill(ok({rows:[]}));mutations++;return r.fulfill(ok({id,replayed:false}));});
 await page.getByRole('button',{name:'لوحة المالك',exact:true}).click();await page.getByRole('navigation',{name:'أقسام لوحة المالك'}).getByRole('button',{name:'المفاتيح والمنح'}).click();
 await page.evaluate(()=>{Object.defineProperty(window,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{throw Error('fixture disabled storage');},removeItem:()=>{}}});});
 await page.getByLabel('معرّف الحساب الموثق').fill(id);await page.getByRole('button',{name:'مراجعة المنحة'}).click();await page.getByLabel('سبب الإجراء').fill('لا يرسل دون مرجع');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await expect(page.getByRole('dialog').getByRole('status')).toContainText('لم يُرسل الطلب');expect(mutations).toBe(0);
});

test('disabled owner configuration is distinct from permission failure; profile offers no purchase or redeem',async({page})=>{
 await setup(page,false);
 await page.route('**/api/owner',r=>r.fulfill({status:503,json:{code:'OWNER_PANEL_NOT_CONFIGURED'}}));
 await page.getByRole('button',{name:'العودة للموقع'}).click();await page.locator('.platform-account-trigger').click();await page.getByRole('menuitem',{name:'الملف الشخصي'}).click();
 await expect(page.getByRole('status')).toHaveText('لوحة المالك غير مفعّلة حاليًا.');
 await expect(page.getByRole('button',{name:'إعادة التحقق من الصلاحيات'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'شراء مفاتيح'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'استرداد مفتاح',exact:true})).toHaveCount(0);
 await page.locator('.platform-account-trigger').click();await expect(page.getByRole('menuitem',{name:'استرداد مفتاح',exact:true})).toBeVisible();
});
