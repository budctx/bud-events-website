import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, inside, scopedRestoreList } from '../scripts/database-backup.mjs';

test('backup encryption restores exact bytes and refuses a wrong passphrase, tampering and truncation', () => {
 const data = Buffer.from('PGDMP fixture containing private account data');
 const passphrase = 'fixture-only-long-backup-passphrase';
 const sealed = encrypt(data, passphrase);
 assert.deepEqual(decrypt(sealed, passphrase), data);
 assert.ok(!sealed.includes(Buffer.from('private account')));
 assert.notDeepEqual(sealed, encrypt(data, passphrase));
 assert.throws(() => decrypt(sealed, 'different-fixture-passphrase'));
 for (const index of [0, 10, 28, 40, 55]) {
  const changed = Buffer.from(sealed); changed[index] ^= 1; assert.throws(() => decrypt(changed, passphrase));
 }
 assert.throws(() => decrypt(sealed.subarray(0, 30), passphrase));
 assert.throws(() => encrypt(data, 'short'));
});

test('local restore explicitly includes account/application schemas and excludes managed services', () => {
 const selected = scopedRestoreList('; Archive\n1; 0 0 SCHEMA - auth postgres\n2; 0 0 TABLE DATA auth users owner\n3; 0 0 TABLE bud_platform wallets owner\n4; 0 0 FUNCTION public bud_live_balance(uuid) owner\n5; 0 0 TABLE DATA storage objects owner\n6; 0 0 EXTENSION - pg_graphql\n7; 0 0 ACL - SCHEMA auth owner');
 assert.match(selected,/TABLE DATA auth users/); assert.match(selected,/TABLE bud_platform wallets/);
 assert.match(selected,/FUNCTION public bud_live_balance/); assert.match(selected,/SCHEMA - auth/); assert.match(selected,/ACL - SCHEMA auth/);
 assert.doesNotMatch(selected,/storage objects|pg_graphql/);
});

test('backup cleanup is restricted to children of its private directory', () => {
 assert.equal(inside('C:/backup/private', 'C:/backup/private/work-123'), true);
 for (const target of ['C:/backup/private','C:/backup','C:/backup/private-other','C:/backup/private/../../outside','D:/outside']) {
  assert.equal(inside('C:/backup/private', target), false);
 }
});
