import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=(name:string)=>readFile(new URL('../src/'+name,import.meta.url),'utf8');

test('every event reuses the shared journey outside its activity screen',async()=>{
 const [questionCondition,miniGames,journey]=await Promise.all([
  source('Game.tsx'),source('mini-games/MiniGames.tsx'),source('EventJourney.tsx')
 ]);
 for(const implementation of [questionCondition,miniGames]){
  assert.match(implementation,/EventJourneyHeader/);
  assert.match(implementation,/EventJourneySteps/);
  assert.match(implementation,/EventClosingStage/);
  assert.match(implementation,/EventFinishDialog/);
 }
 assert.doesNotMatch(miniGames,/className="mini-steps"|className="mini-closing"/);
 assert.match(journey,/الإعداد.*شاشة الفعالية.*الجوائز.*الختام/s);
 assert.match(journey,/إنهاء الفعالية\؟/);
 assert.match(journey,/شكرًا لكم على المشاركة/);
 assert.match(journey,/نسخ النتائج/);
});

test('both paid setup flows reuse the shared setup stage and start loader',async()=>{
 const [questionSetup,miniSetup]=await Promise.all([
  source('HostPortal.tsx'),source('mini-games/MiniSetupModal.tsx')
 ]);
 for(const implementation of [questionSetup,miniSetup]){
  assert.match(implementation,/EventSetupStage/);
  assert.match(implementation,/EventStartLoader/);
 }
 assert.match(miniSetup,/startMiniHostEvent\(ownerId,pendingKey\.current,title\.trim\(\),prizeText,setStartStep\)/);
});

test('Mini Games retains the persisted custom session title and offers a functional winners action',async()=>{
 const [host,miniGames,session]=await Promise.all([
  source('mini-games/MiniGamesHost.tsx'),source('mini-games/MiniGames.tsx'),source('mini-games/session.ts')
 ]);
 assert.match(host,/sessionName=\{run\.title\.trim\(\) \|\| 'ميني قيمز'\}/);
 assert.match(session,/title:payload\.title/);
 assert.match(miniGames,/onWinners=\{\(\)=>openManager\(\)\}/);
 assert.match(miniGames,/WinnerList/);
 assert.match(miniGames,/type:'rename-winner'/);
 assert.match(miniGames,/type:'delete-winner'/);
});
