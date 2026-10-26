import test from 'node:test';
import assert from 'node:assert/strict';
import {readHostSetupDraft,saveHostSetupDraft,clearHostSetupDraft} from '../src/host-setup-draft.ts';

class FixtureStorage {
  private data = new Map<string,string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key,value); }
  removeItem(key: string) { this.data.delete(key); }
}
const config = {duration: 13, timerEnabled: true, attempts: 2 as const};
test('host setup draft restores only for the same host, and clears on successful start', () => {
  const store = new FixtureStorage(), now=Date.now();
  assert.equal(saveHostSetupDraft('owner-a',{title:'ليلة المجتمع',prizeText:'جائزة أولى\nجائزة ثانية',config},store,now),true);
  assert.equal(readHostSetupDraft('owner-b',store,now),null);
  assert.deepEqual(readHostSetupDraft('owner-a',store,now),{schema:1,savedAt:now,title:'ليلة المجتمع',prizeText:'جائزة أولى\nجائزة ثانية',config});
  clearHostSetupDraft('owner-a',store);
  assert.equal(readHostSetupDraft('owner-a',store),null);
});
test('invalid, expired and untrusted drafts never restore or break setup', () => {
  const store = new FixtureStorage(), now=Date.now();
  assert.equal(saveHostSetupDraft('owner',{title:'',prizeText:'',config:{...config,duration:99}},store),false);
  assert.equal(saveHostSetupDraft('owner',{title:'Hi',prizeText:'Gift',config},store,now - 31*86400000),true);
  assert.equal(readHostSetupDraft('owner',store,now),null);
  assert.equal(saveHostSetupDraft('owner',{title:'Hi',prizeText:'Gift',config},store,now + 10000),true);
  assert.equal(readHostSetupDraft('owner',store,now),null);
  assert.equal(saveHostSetupDraft('owner',{title:'Hi',prizeText:'Gift',config},store,now),true);
  store.setItem('bud-host-setup-draft:v1:owner','{not-json');
  assert.equal(readHostSetupDraft('owner',store,now),null);
});
test('storage rejection does not throw or affect financial operations', () => {
  const blocked = { getItem: () => {throw Error('privacy block')}, setItem: () => {throw Error('quota')}, removeItem: () => {throw Error('blocked')} };
  assert.equal(saveHostSetupDraft('owner',{title:'ليلة',prizeText:'هدية',config},blocked),false);
  assert.equal(readHostSetupDraft('owner',blocked),null);
  assert.doesNotThrow(()=>clearHostSetupDraft('owner',blocked));
});
