import {test,expect} from '@playwright/test';
const id='11111111-1111-4111-8111-111111111111';
const ok=(data:unknown)=>({status:200,json:{code:'OK',data}});
test('partner carousel is published-only and owner can manage entries through confirm workflow',async({page})=>{
 const rows:{id:string;name:string;logoUrl:string;websiteUrl:string;sortOrder:number;visible:boolean}[]=[];
 await page.route('**/api/partners',route=>route.fulfill(ok(rows.filter(x=>x.visible))));
 await page.route('https://cdn.example.com/logo.png',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#fbb03b"/></svg>'}));
 await page.route('**/api/auth?action=session',route=>route.fulfill(ok({id,displayName:'مالك بُعد'})));
 await page.route('**/api/host',route=>route.fulfill(ok({credits:2,events:[],products:[],contentVersions:[]})));
 let seq=0;const seen:string[]=[];
 await page.route('**/api/owner',route=>{
  const body=route.request().postDataJSON();seen.push(body.action);
  if(body.action==='profile')return route.fulfill(ok({owner:true}));
  if(body.action==='partners')return route.fulfill(ok(rows));
  if(body.action==='view')return route.fulfill(ok({users:0,slots:0,pendingOrders:0,alerts:[]}));
  if(body.action==='partnerSave'){
   if(body.payload.id){const index=rows.findIndex(x=>x.id===body.payload.id);rows[index]={...rows[index],...body.payload};}
   else rows.push({...body.payload,id:'44444444-4444-4444-8444-'+String(++seq).padStart(12,'0')});
   return route.fulfill(ok({saved:true,replayed:false,id:rows[0].id}));
  }
  if(body.action==='partnerDelete'){rows.splice(rows.findIndex(x=>x.id===body.payload.id),1);return route.fulfill(ok({deleted:true,replayed:false}));}
  return route.fulfill(ok({}));
 });
 await page.goto('/?lang=ar');
 await expect(page.getByTestId('partners-carousel')).toHaveCount(0);
 await page.locator('.platform-account-trigger').click();
 await page.getByRole('menuitem',{name:'الملف الشخصي'}).click();
 await page.getByRole('button',{name:'لوحة المالك'}).click();
 await page.getByRole('navigation',{name:'أقسام لوحة المالك'}).getByRole('button',{name:/الشركاء/}).click();
 await expect(page.getByRole('heading',{name:'إضافة شريك'})).toBeVisible();
 await page.getByLabel('اسم الشريك').fill('شريك بُعد');
 await page.getByLabel(/رابط الشعار/).fill('https://cdn.example.com/logo.png');
 await page.getByRole('button',{name:'مراجعة الحفظ'}).click();
 await expect(page.getByRole('dialog').getByRole('heading',{name:'إضافة شريك جديد'})).toBeVisible();
 await page.getByRole('dialog').getByLabel('سبب الإجراء').fill('شريك تم اعتماده');
 await page.getByRole('dialog').getByRole('checkbox').check();
 await page.getByRole('dialog').getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'إغلاق'}).click();
 await expect(page.getByText('شريك بُعد')).toBeVisible();
 await page.getByRole('button',{name:/شريك بُعد/}).click();
 await page.getByRole('checkbox',{name:'إظهار الشريك على الموقع بعد الحفظ'}).check();
 await page.getByRole('button',{name:'مراجعة الحفظ'}).click();
 await page.getByRole('dialog').getByLabel('سبب الإجراء').fill('تفعيل الشريك');
 await page.getByRole('dialog').getByRole('checkbox').check();
 await page.getByRole('dialog').getByRole('button',{name:'تأكيد التنفيذ'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'إغلاق'}).click();
 await expect(page.getByText('1 منشور')).toBeVisible();
 await page.reload();
 await expect(page.getByTestId('partners-carousel')).toBeVisible();
 await expect(page.getByTestId('partners-carousel').getByRole('img',{name:'شريك بُعد'})).toBeVisible();
 expect(seen.filter(x=>x==='partnerSave')).toHaveLength(2);
});
