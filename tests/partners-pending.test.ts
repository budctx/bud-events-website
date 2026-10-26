import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('pending owner command allowlist includes partner creates/edits/deletes without arbitrary fields',async()=>{
 const code=await readFile(new URL('../src/owner-pending.ts',import.meta.url),'utf8');
 assert.match(code,/partnerSave:\['id','name','logoUrl','websiteUrl','sortOrder','visible'\]/);
 assert.match(code,/partnerDelete:\['id'\]/);
 assert.match(code,/Object\.keys\(p\.payload\)\.every\(key=>fields\[p\.kind\]\.includes\(key\)\)/);
});
