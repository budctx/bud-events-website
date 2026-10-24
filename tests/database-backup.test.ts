import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, inside, scopedRestoreList, postgresFailureCode } from '../scripts/database-backup.mjs';
import { readOfficialCa, validateOfficialCa } from '../scripts/backup-tls.mjs';

test('backup trusts only the reviewed official CA and rejects corrupt or expired trust material', async () => {
 const ca = await readOfficialCa();
 assert.deepEqual(validateOfficialCa(ca),ca);
 assert.throws(()=>validateOfficialCa('invalid certificate'),/BACKUP_CA_INVALID/);
 assert.throws(()=>validateOfficialCa(ca,0),/BACKUP_CA_EXPIRED/);
 assert.throws(()=>validateOfficialCa(ca,Date.UTC(2100,0,1)),/BACKUP_CA_EXPIRED/);
});

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

test('backup diagnoses failure classes without returning stderr, secrets or unknown error content',()=>{
 const secret='postgres://private:password@private-host/private-db';
 for(const [failure,reason] of [
  [{code:'ENOENT'},'BINARY_NOT_FOUND'],[{code:'EACCES'},'LOCAL_ACCESS_DENIED'],[{killed:true},'TIMEOUT'],
  [{stderr:'certificate verify failed'},'TLS_FAILED'],[{stderr:'password authentication failed'},'AUTHENTICATION_FAILED'],
  [{stderr:'could not translate host name'},'DNS_FAILED'],[{stderr:'connection timed out'},'CONNECTION_TIMEOUT'],
  [{stderr:'connection refused'},'CONNECTION_FAILED'],[{stderr:'permission denied for table users'},'PERMISSION_DENIED'],
  [{stderr:'unknown error'},'FAILED'],
 ] as const) {
  const code=postgresFailureCode('psql',{...failure,stderr:('stderr' in failure?failure.stderr:'')+' '+secret,message:secret,stdout:secret});
  assert.equal(code,'POSTGRES_PSQL_'+reason); assert.doesNotMatch(code,/password|private|postgres:\/\//);
 }
 assert.equal(postgresFailureCode(secret,{stderr:secret}),'POSTGRES_TOOL_FAILED');
});
