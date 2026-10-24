import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, inside, scopedRestoreList, postgresFailureCode, snapshotMismatch, validateRecoveryMetadata } from '../scripts/database-backup.mjs';
import { readOfficialCa, validateOfficialCa } from '../scripts/backup-tls.mjs';
import { BackupClusterLifecycle } from '../scripts/backup-cluster-lifecycle.mjs';

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

test('recovery comparison preserves all expected tables, counts and contents independent of catalog ordering',()=>{
 const row={schema:'auth',table:'users',count:1,digest:'a'.repeat(32)};
 const other={schema:'bud_platform',table:'wallets',count:0,digest:'b'.repeat(32)};
 assert.equal(snapshotMismatch([row,other],[other,row]),null);
 assert.equal(snapshotMismatch([row],[{...row,digest:'c'.repeat(32)}]),'CONTENT_MISMATCH');
 assert.equal(snapshotMismatch([row],[{...row,count:2}]),'ROW_COUNT_MISMATCH');
 assert.equal(snapshotMismatch([row,other],[row]),'TABLE_SET_MISMATCH');
 assert.equal(snapshotMismatch([row],[row,other]),'TABLE_SET_MISMATCH');
 const metadata={source:{host:'aws-0-ap-south-1.pooler.supabase.com',port:'5432',user:'postgres.cepmvqqrjcvhyzszqand',database:'postgres'},roles:[],before:[row,other],after:[other,row],dumpSha256:'d'.repeat(64)};
 assert.equal(validateRecoveryMetadata(metadata),metadata);
 assert.throws(()=>validateRecoveryMetadata({...metadata,source:{...metadata.source,host:'other'}}),/BACKUP_METADATA_INVALID/);
 assert.throws(()=>validateRecoveryMetadata({...metadata,before:[row,row]}),/BACKUP_METADATA_INVALID/);
 assert.throws(()=>validateRecoveryMetadata({...metadata,before:[{...row,count:-1}]}),/BACKUP_METADATA_INVALID/);
 assert.throws(()=>validateRecoveryMetadata({...metadata,after:[{...row,digest:'e'.repeat(32)},other]}),/SOURCE_CHANGED/);
});

test('ambiguous local cluster shutdown retains work and blocks cleanup/receipt, including failed post-start preparation',async()=>{
 let stopCalls=0, deleted=false, receipt=false;
 const lifecycle=new BackupClusterLifecycle(async()=>{stopCalls++;throw Error('fixture stop timed out')});
 await lifecycle.initialize(async()=>{},async()=>({fixture:true}));
 await assert.rejects(lifecycle.stop());
 assert.throws(()=>{lifecycle.assertRemovable();deleted=true;receipt=true},/LOCAL_CLUSTER_STOP_UNVERIFIED_RETAINED/);
 assert.equal(deleted,false);assert.equal(receipt,false);assert.equal(stopCalls,1);
 const postStart=new BackupClusterLifecycle(async()=>{stopCalls++;throw Error('fixture stop denied')});
 await assert.rejects(postStart.initialize(async()=>{},async()=>{throw Error('fixture passfile failure')}),/LOCAL_CLUSTER_STOP_UNVERIFIED_RETAINED/);
 assert.throws(()=>postStart.assertRemovable(),/LOCAL_CLUSTER_STOP_UNVERIFIED_RETAINED/);
 const startTimeout=new BackupClusterLifecycle(async()=>{stopCalls++;throw Error('fixture stop uncertain')});
 await assert.rejects(startTimeout.initialize(async()=>{throw Error('fixture start timed out')},async()=>{}),/LOCAL_CLUSTER_STOP_UNVERIFIED_RETAINED/);
 assert.throws(()=>startTimeout.assertRemovable(),/LOCAL_CLUSTER_STOP_UNVERIFIED_RETAINED/);
 assert.equal(stopCalls,3);
 const recovered=new BackupClusterLifecycle(async()=>{stopCalls++});
 await assert.rejects(recovered.initialize(async()=>{},async()=>{throw Error('fixture preparation failure')}),/fixture preparation failure/);
 assert.doesNotThrow(()=>recovered.assertRemovable());assert.equal(stopCalls,4);
});
