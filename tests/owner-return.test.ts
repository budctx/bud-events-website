import test from 'node:test';
import assert from 'node:assert/strict';
import {readOwnerReturn,saveOwnerReturn,clearOwnerReturn} from '../src/owner-return.ts';
const entries=new Map<string,string>();
Object.defineProperty(globalThis,'sessionStorage',{value:{getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>entries.set(key,value),removeItem:(key:string)=>entries.delete(key)},configurable:true});
const target={ownerId:'owner-a',section:'partners',search:'',offset:0};
test('owner return is tab-scoped, expires and rejects arbitrary navigation destinations',()=>{
 assert.equal(saveOwnerReturn(target),true);assert.equal(readOwnerReturn()?.section,'partners');
 const key='bud-owner-reauth-return:v1';
 for(const change of [{section:'https://evil.example'},{offset:-1},{expiresAt:Date.now()-1},{expiresAt:Date.now()+700000},{search:'a'.repeat(81)}]){
  sessionStorage.setItem(key,JSON.stringify({...target,expiresAt:Date.now()+300000,...change}));assert.equal(readOwnerReturn(),null);
 }
 saveOwnerReturn(target);clearOwnerReturn();assert.equal(readOwnerReturn(),null);
});
