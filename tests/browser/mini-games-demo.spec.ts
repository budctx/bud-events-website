import {test,expect} from '@playwright/test';
for (const width of [1440,390,320]) test(`public memory sample ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/events');
 const demo=page.getByTestId('mini-games-demo');
 await expect(demo).toBeVisible();
 const cards=demo.locator('.mini-demo-card');
 await expect(cards).toHaveCount(4);
 await expect(demo.locator('.mini-demo-front')).toHaveText(['','','','']);
 // Learn the sample through the same reveals available to a visitor.
 const values:string[]=[];
 for(let i=0;i<4;i+=2){
  await cards.nth(i).click(); await cards.nth(i+1).click();
  values[i]=(await cards.nth(i).getAttribute('aria-label'))!.split(': ')[1].split('،')[0];
  values[i+1]=(await cards.nth(i+1).getAttribute('aria-label'))!.split(': ')[1].split('،')[0];
  if(values[i]!==values[i+1])await expect(demo.locator('[data-revealed=true]')).toHaveCount(0);
 }
 for(const emoji of new Set(values)){
  const indices=values.flatMap((value,index)=>value===emoji?[index]:[]);
  for(const index of indices)if(await cards.nth(index).getAttribute('data-matched')!=='true')await cards.nth(index).click();
 }
 await expect(demo.getByRole('status')).toHaveText('طابقتها! 🎉');
 await expect(demo.locator('[data-matched=true]')).toHaveCount(4);
 await demo.getByRole('button',{name:'جرّب مرة ثانية'}).click();
 await expect(demo.locator('[data-revealed=true]')).toHaveCount(0);
 await expect(cards.nth(0)).toBeFocused();
 await expect(demo.locator('.mini-demo-front')).toHaveText(['','','','']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
