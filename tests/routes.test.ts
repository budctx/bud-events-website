import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readPublicPage,publicRoute,publicPaths} from '../src/routes.ts';
test('public paths take precedence and legacy links remain readable',()=>{
 for(const [page,path] of Object.entries(publicPaths)) {
  assert.equal(readPublicPage(new URL('https://budteam.net'+path+(path==='/'?'?screen=home':'?screen=home'))),page);
  assert.equal(readPublicPage(new URL('https://budteam.net/?screen='+page+'&lang=en')),page);
 }
 assert.equal(readPublicPage(new URL('https://budteam.net/?screen=local&event=fixture')),'events');
});
test('clean routes preserve functional parameters and policy anchors without leaking credentials',()=>{
 const url=new URL('https://budteam.net/?screen=events&lang=ar&promoCode=bud10&order=receipt&check=whop&token=secret#terms');
 assert.equal(publicRoute('events',url),'\/events?order=receipt&check=whop&promoCode=bud10');
 assert.equal(publicRoute('policies',url,'profile'),'/policies?panel=profile#terms');
 assert.equal(publicRoute('home',url),'/');
});
