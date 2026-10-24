// Operator tool. Credentials arrive only through stdin from the local masked prompt.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { officialCaPath, verifySourceTls } from './backup-tls.mjs';
import { BackupClusterLifecycle } from './backup-cluster-lifecycle.mjs';

const execute = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
let postgresRoot = ROOT;
const PRIVATE = join(ROOT, 'supabase', '.temp', 'secure-backups');
const BIN = join(ROOT, 'supabase', '.temp', 'backup-tools', 'runtime', 'pgsql', 'bin');
const SOURCE = { host: 'aws-0-ap-south-1.pooler.supabase.com', port: '5432', user: 'postgres.cepmvqqrjcvhyzszqand', database: 'postgres' };
const MAGIC = Buffer.from('BUDBAK01');
const clusterLifecycles = new Map();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const key = (password, salt) => scryptSync(password, salt, 32, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
export function encrypt(bytes, password) {
  if (typeof password !== 'string' || password.length < 16) throw Error('BACKUP_PASSPHRASE_TOO_SHORT');
  const salt = randomBytes(16), iv = randomBytes(12), secret = key(password, salt);
  try {
    const cipher = createCipheriv('aes-256-gcm', secret, iv); cipher.setAAD(MAGIC);
    const body = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
  } finally { secret.fill(0); }
}
export function decrypt(bytes, password) {
  if (bytes.length < 52 || !bytes.subarray(0, 8).equals(MAGIC)) throw Error('INVALID_BACKUP');
  const secret = key(password, bytes.subarray(8, 24));
  try {
    const cipher = createDecipheriv('aes-256-gcm', secret, bytes.subarray(24, 36));
    cipher.setAAD(MAGIC); cipher.setAuthTag(bytes.subarray(36, 52));
    return Buffer.concat([cipher.update(bytes.subarray(52)), cipher.final()]);
  } finally { secret.fill(0); }
}
export function inside(parent, child) {
  const part = relative(resolve(parent), resolve(child));
  return part !== '' && !part.startsWith('..') && !isAbsolute(part);
}
export function scopedRestoreList(toc) {
  return toc.split('\n').filter(line => line.startsWith(';') || /\s(?:auth|bud_platform|public)\s/.test(line)).join('\n');
}
async function removePrivate(path) {
  if (!inside(PRIVATE, path)) throw Error('UNSAFE_CLEANUP_TARGET');
  for (const [data,lifecycle] of clusterLifecycles) if (resolve(path) === resolve(data) || inside(path,data)) lifecycle.assertRemovable();
  await rm(path, { recursive: true, force: true });
  for (const data of clusterLifecycles.keys()) if (resolve(path) === resolve(data) || inside(path,data)) clusterLifecycles.delete(data);
}
// Classify locally; never return stderr, commands, paths, usernames or credentials.
export function postgresFailureCode(name,error) {
  const tool=['psql','pg_dump','pg_restore','initdb','pg_ctl'].includes(name)?name.toUpperCase():'TOOL';
  const code=error?.code;
  if(code==='ENOENT')return `POSTGRES_${tool}_BINARY_NOT_FOUND`;
  if(code==='EACCES'||code==='EPERM')return `POSTGRES_${tool}_LOCAL_ACCESS_DENIED`;
  if(error?.killed===true||code==='ETIMEDOUT')return `POSTGRES_${tool}_TIMEOUT`;
  const message=typeof error?.stderr==='string'?error.stderr.slice(0,8192):'';
  const reason=/certificate verify failed|root certificate|SSL error|certificate validation|server certificate/i.test(message)?'TLS_FAILED'
    :/password authentication failed|no password supplied|SASL authentication failed/i.test(message)?'AUTHENTICATION_FAILED'
    :/could not translate host name|Name or service not known|No such host/i.test(message)?'DNS_FAILED'
    :/connection timed out|timeout expired/i.test(message)?'CONNECTION_TIMEOUT'
    :/connection refused|could not connect to server|network is unreachable/i.test(message)?'CONNECTION_FAILED'
    :/permission denied|must be owner|insufficient privilege/i.test(message)?'PERMISSION_DENIED':'FAILED';
  return `POSTGRES_${tool}_${reason}`;
}
async function tool(name, args, env) {
  // Native PostgreSQL bootstrap on Windows requires ASCII paths; use the same folder's 8.3 alias.
  const native = value => value.replaceAll(ROOT, postgresRoot);
  env = { ...env, ...(env.PGPASSFILE ? { PGPASSFILE: native(env.PGPASSFILE) } : {}), ...(env.PGSSLROOTCERT ? { PGSSLROOTCERT: native(env.PGSSLROOTCERT) } : {}) };
  if (name === 'pg_ctl') return new Promise((accept, reject) => {
    const child = spawn(native(join(BIN, 'pg_ctl.exe')), args.map(native), { env, windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(Error('POSTGRES_PG_CTL_TIMEOUT')); }, 90000);
    child.once('error', () => { clearTimeout(timer); reject(Error('POSTGRES_PG_CTL_FAILED')); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? accept('') : reject(Error('POSTGRES_PG_CTL_FAILED')); });
  });
  try { return (await execute(native(join(BIN, name + '.exe')), args.map(native), { env, windowsHide: true, timeout: 180000, maxBuffer: 8 * 1024 * 1024 })).stdout.trim(); }
  catch(error) { throw Error(postgresFailureCode(name,error)); }
}
function cleanEnv(extra) {
  return { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('PG'))), ...extra };
}
async function connection(work, config, password, sslRoot, remoteAllowed = false) {
  if (config.host !== '127.0.0.1' && !(remoteAllowed && JSON.stringify(config) === JSON.stringify(SOURCE))) throw Error('REMOTE_CONNECTION_NOT_ALLOWED');
  const passfile = join(work, randomBytes(8).toString('hex') + '.pgpass');
  const escaped = password.replaceAll('\\', '\\\\').replaceAll(':', '\\:');
  await writeFile(passfile, `${config.host}:${config.port}:${config.database}:${config.user}:${escaped}\n`, { mode: 0o600, flag: 'wx' });
  return cleanEnv({ PGHOST: config.host, PGPORT: config.port, PGUSER: config.user, PGDATABASE: config.database,
    PGPASSFILE: passfile, PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'bud-backup-readonly',
    PGSSLMODE: sslRoot ? 'verify-full' : 'disable', ...(sslRoot ? { PGSSLROOTCERT: sslRoot, PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=60000' } : {}) });
}
async function sql(env, query) { return tool('psql', ['-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], env); }
const ident = name => '"' + name.replaceAll('"', '""') + '"';
const FINGERPRINT_OPTIONS = '-c timezone=UTC -c DateStyle=ISO,YMD -c IntervalStyle=postgres -c extra_float_digits=3';
const ordered = snapshot => [...snapshot].sort((a,b) => {
  const left = a.schema + '.' + a.table, right = b.schema + '.' + b.table;
  return left < right ? -1 : left > right ? 1 : 0;
});
export function snapshotMismatch(expected, actual) {
  const left = ordered(expected), right = ordered(actual);
  if (left.length !== right.length || left.some((t,i) => t.schema !== right[i].schema || t.table !== right[i].table)) return 'TABLE_SET_MISMATCH';
  if (left.some((t,i) => t.count !== right[i].count)) return 'ROW_COUNT_MISMATCH';
  if (left.some((t,i) => t.digest !== right[i].digest)) return 'CONTENT_MISMATCH';
  return null;
}
async function fingerprint(env, canonical = true) {
  // Hash typed rows under identical presentation settings, independent of local defaults.
  if (canonical) {
    env = { ...env, PGOPTIONS: (env.PGOPTIONS ?? '') + ' ' + FINGERPRINT_OPTIONS };
    const settings = JSON.parse(await sql(env,`select json_build_array(current_setting('TimeZone'),current_setting('DateStyle'),current_setting('IntervalStyle'),current_setting('extra_float_digits'))`));
    if (JSON.stringify(settings) !== JSON.stringify(['UTC','ISO, YMD','postgres','3'])) throw Error('FINGERPRINT_SETTINGS_MISMATCH');
  }
  const tables = JSON.parse(await sql(env, `select coalesce(json_agg(json_build_object('schema',n.nspname,'table',c.relname) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('auth','bud_platform','public')`));
  const result = [];
  for (const table of tables) {
    const value = JSON.parse(await sql(env, `select json_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from ${ident(table.schema)}.${ident(table.table)} t`));
    result.push({ ...table, ...value });
  }
  return ordered(result);
}
async function localCluster(work, timezone = 'UTC') {
  if (!['UTC','Asia/Riyadh'].includes(timezone)) throw Error('INVALID_FIXTURE_TIMEZONE');
  const data = join(work, 'cluster'), pwfile = join(work, 'local-password');
  const password = randomBytes(32).toString('hex'); await writeFile(pwfile, password, { mode: 0o600 });
  const port = await new Promise((accept, reject) => { const server = createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => accept(value)); }); });
  await tool('initdb', ['-D', data, '-U', 'postgres', '--auth=scram-sha-256', '--pwfile=' + pwfile, '--encoding=UTF8', '--locale=C'], cleanEnv({}));
  const lifecycle = new BackupClusterLifecycle(() => tool('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], cleanEnv({})));
  clusterLifecycles.set(data,lifecycle);
  const env = await lifecycle.initialize(
    () => tool('pg_ctl', ['-D', data, '-l', join(work, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -c timezone=${timezone}`, '-w', 'start'], cleanEnv({})),
    () => connection(work, { host: '127.0.0.1', port: String(port), user: 'postgres', database: 'postgres' }, password),
  );
  return { env, stop: () => lifecycle.stop() };
}
async function exportArchive(work, source) {
  const archive = join(work, 'database.dump');
  await tool('pg_dump', ['-w', '-Fc', '--file=' + archive], source);
  const bytes = await readFile(archive);
  if (bytes.length < 100 || bytes.subarray(0, 5).toString() !== 'PGDMP') throw Error('INVALID_DUMP');
  return { archive, bytes };
}
async function restoreArchive(work, archive, roles, expected, timezone = 'UTC') {
  const local = await localCluster(work,timezone);
  try {
    // Role passwords are deliberately excluded. All changes below target this local disposable cluster only.
    for (const role of roles) if (!role.name.startsWith('pg_') && role.name !== 'postgres') {
      await sql(local.env, `create role ${ident(role.name)} ${role.bypass ? 'bypassrls' : 'nobypassrls'} nologin`);
    }
    // Supabase's managed extensions/services need a Supabase recovery target. Exercise the account/application
    // schemas here, without substituting stubs for missing dependencies or treating this as a full managed restore.
    const list = join(work, 'application-restore.list');
    await writeFile(list, scopedRestoreList(await tool('pg_restore', ['--list', archive], local.env)));
    await tool('pg_restore', ['-w', '--exit-on-error', '--no-owner', '--use-list=' + list, '--dbname=postgres', archive], local.env);
    const actual = await fingerprint(local.env);
    const mismatch = snapshotMismatch(expected, actual);
    if (mismatch) throw Error('RESTORED_' + mismatch);
    return { restoredTables: actual.length, authUsers: actual.find(t => t.schema === 'auth' && t.table === 'users')?.count ?? null };
  } finally { await local.stop(); }
}
async function protectRoot() {
  const identity = (await execute('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true })).stdout;
  if (/CodexSandbox/i.test(identity)) throw Error('WINDOWS_OPERATOR_REQUIRED');
  const user = identity.match(/S-1-[0-9-]+/)?.[0];
  if (!user) throw Error('WINDOWS_IDENTITY_UNAVAILABLE');
  await mkdir(PRIVATE, { recursive: true });
  await execute('icacls.exe', [PRIVATE, '/inheritance:r', '/grant:r', '*' + user + ':(OI)(CI)F'], { windowsHide: true });
  postgresRoot = (await execute('powershell.exe', ['-NoProfile', '-Command', '(New-Object -ComObject Scripting.FileSystemObject).GetFolder($env:BUD_BACKUP_WORKSPACE).ShortPath'],
    { windowsHide: true, env: { ...process.env, BUD_BACKUP_WORKSPACE: ROOT } })).stdout.trim();
  if (!/^[\x20-\x7e]+$/.test(postgresRoot)) throw Error('POSTGRES_REQUIRES_ASCII_PATH');
}
async function selfTest() {
  await protectRoot(); const work = await mkdtemp(join(PRIVATE, 'selftest-'));
  const fixtureName = 'fixture-' + randomBytes(8).toString('hex'), fixtureDirectory = join(PRIVATE,fixtureName);
  let source, fixtureStage = 'BOOTSTRAP';
  try {
    source = await localCluster(work);
    fixtureStage = 'SCHEMA';
    await sql(source.env, `create schema auth; create schema bud_platform; create table auth.users(id uuid primary key,marker text); insert into auth.users values('11111111-1111-4111-8111-111111111111','fixture-only'); create table bud_platform.wallets(host_id uuid,credits int); insert into bud_platform.wallets select id,5 from auth.users; alter table bud_platform.wallets enable row level security;`);
    await sql(source.env, String.raw`create table bud_platform.rich_fixture(id int, moment timestamptz, plain timestamp, day date, duration interval, amount numeric, fraction double precision, payload jsonb, bytes bytea, marker text, missing text);
      insert into bud_platform.rich_fixture values(1,'2026-10-24T00:30:00Z','2026-10-24 00:30:00','2026-10-24','2 days 3 hours',1.2300,1.23456789012345,jsonb_build_object('key',U&'\0628\064F\0639\062F'),decode('00ff','hex'),U&'fixture-\0628\064F\0639\062F',null);
      create table bud_platform.empty_fixture(id int);`);
    fixtureStage = 'TIMEZONE';
    const rawQuery = `select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from bud_platform.rich_fixture t`;
    const rawUtc = await sql({...source.env,PGOPTIONS:'-c timezone=UTC'},rawQuery);
    const rawRiyadh = await sql({...source.env,PGOPTIONS:'-c timezone=Asia/Riyadh'},rawQuery);
    if (rawUtc === rawRiyadh) throw Error('FIXTURE_TIMEZONE_REPRODUCTION_FAILED');
    fixtureStage = 'EXPORT';
    const expected = await fingerprint(source.env), dump = await exportArchive(work, source.env);
    const legacyExpected = await fingerprint(source.env,false);
    if (snapshotMismatch(expected,legacyExpected)) throw Error('FIXTURE_LEGACY_HASH_MISMATCH');
    if (snapshotMismatch(expected,await fingerprint({...source.env,PGOPTIONS:'-c timezone=Asia/Riyadh'}))) throw Error('FIXTURE_CANONICAL_SETTINGS_FAILED');
    fixtureStage = 'MUTATIONS';
    for (const [mutation,undo,reason] of [
      ["update bud_platform.rich_fixture set moment=moment+interval '1 second'","update bud_platform.rich_fixture set moment=moment-interval '1 second'",'CONTENT_MISMATCH'],
      ["update bud_platform.rich_fixture set marker='changed'",String.raw`update bud_platform.rich_fixture set marker=U&'fixture-\0628\064F\0639\062F'`,'CONTENT_MISMATCH'],
      ['insert into bud_platform.rich_fixture select * from bud_platform.rich_fixture','delete from bud_platform.rich_fixture where ctid in (select ctid from bud_platform.rich_fixture limit 1)','ROW_COUNT_MISMATCH'],
      ['delete from bud_platform.wallets',"insert into bud_platform.wallets select id,5 from auth.users",'ROW_COUNT_MISMATCH'],
      ['create table bud_platform.extra_fixture(id int)','drop table bud_platform.extra_fixture','TABLE_SET_MISMATCH'],
      ['drop table bud_platform.empty_fixture','create table bud_platform.empty_fixture(id int)','TABLE_SET_MISMATCH'],
    ]) {
      await sql(source.env,mutation);
      if (snapshotMismatch(expected,await fingerprint(source.env)) !== reason) throw Error('FIXTURE_MUTATION_UNDETECTED');
      await sql(source.env,undo);
      if (snapshotMismatch(expected,await fingerprint(source.env))) throw Error('FIXTURE_RESET_MISMATCH');
    }
    fixtureStage = 'ENCRYPTION';
    const password = randomBytes(32).toString('hex'), encrypted = encrypt(dump.bytes, password), clear = decrypt(encrypted, password);
    if (hash(clear) !== hash(dump.bytes)) throw Error('ENCRYPTION_ROUNDTRIP_FAILED');
    const secondWork = join(work, 'restore'); await mkdir(secondWork); const restored = join(secondWork, 'verify.dump'); await writeFile(restored, clear);
    fixtureStage = 'RESTORE';
    const checked = await restoreArchive(secondWork, restored, [], expected,'Asia/Riyadh');
    await mkdir(fixtureDirectory);
    await writeFile(join(fixtureDirectory,'database.budenc'),encrypted);
    await writeFile(join(fixtureDirectory,'recovery-metadata.budenc'),encrypt(Buffer.from(JSON.stringify({source:SOURCE,roles:[],before:legacyExpected,after:legacyExpected,dumpSha256:hash(dump.bytes)})),password));
    fixtureStage = 'OFFLINE';
    const offline = await verifyExisting(fixtureName,{passphrase:password},true);
    if (!offline.verified || offline.verificationMode !== 'offline-fixture' || offline.project !== 'fixture-only') throw Error('OFFLINE_FIXTURE_FAILED');
    return { status: 'SELF_TEST_PASSED', ...checked, timezoneDefectReproduced:true, canonicalTimezoneRestorePassed:true, mutationChecks:6, offlineFixtureVerified:true, remoteBackupCreated: false };
  } catch (error) {
    const reason = /^[A-Z_]+$/.test(error.message) ? error.message : 'FAILED';
    throw Error('SELF_TEST_' + fixtureStage + '_' + reason);
  } finally { if (source) await source.stop(); await removePrivate(work); await removePrivate(fixtureDirectory); }
}
async function backup(input) {
  if (typeof input.password !== 'string' || !input.password || /[\r\n]/.test(input.password) || typeof input.passphrase !== 'string' || input.passphrase.length < 16) throw Error('INVALID_LOCAL_INPUT');
  await verifySourceTls(SOURCE);
  const sslRoot = fileURLToPath(officialCaPath);
  await protectRoot(); const work = await mkdtemp(join(PRIVATE, 'pending-'));
  const final = join(PRIVATE, 'backup-' + new Date().toISOString().replaceAll(':', '-'));
  await mkdir(final);
  let receipt;
  try {
    const source = await connection(work, SOURCE, input.password, sslRoot, true);
    const before = await fingerprint(source);
    const roles = JSON.parse(await sql(source, `select json_agg(json_build_object('name',rolname,'bypass',rolbypassrls) order by rolname) from pg_roles`));
    const dump = await exportArchive(work, source);
    const after = await fingerprint(source);
    // Fingerprints stay inside the encrypted manifest; no Auth records or hashes are printed.
    const encrypted = encrypt(dump.bytes, input.passphrase);
    await writeFile(join(final, 'database.budenc'), encrypted, { flag: 'wx' });
    await writeFile(join(final, 'recovery-metadata.budenc'), encrypt(Buffer.from(JSON.stringify({ source: SOURCE, roles, before, after, dumpSha256: hash(dump.bytes), fingerprintVersion:2 })), input.passphrase), { flag: 'wx' });
    if (snapshotMismatch(before, after)) throw Error('SOURCE_CHANGED_DURING_BACKUP_RETRY_REQUIRED');
    const clear = decrypt(encrypted, input.passphrase);
    if (hash(clear) !== hash(dump.bytes)) throw Error('DECRYPTION_CHECK_FAILED');
    const recovered = join(work, 'recovered.dump'); await writeFile(recovered, clear);
    const verified = await restoreArchive(work, recovered, roles, before);
    receipt = { status: 'BACKUP_AND_SCOPED_LOCAL_RESTORE_PASSED', createdAt: new Date().toISOString(), project: 'cepmvqqrjcvhyzszqand',
      encryptedSha256: hash(encrypted), ...verified, restoredSchemas: ['auth','bud_platform','public'], fullManagedRestoreTested: false,
      remoteRestoreTested: false, managedAuthSettingsIncluded: false, storageObjectContentsIncluded: false };
  } finally { input.password = ''; input.passphrase = ''; await removePrivate(work); }
  await writeFile(join(final, 'receipt.json'), JSON.stringify(receipt, null, 2), {flag:'wx'});
  return { ...receipt, directory: final };
}
export function validateRecoveryMetadata(value) {
  if (value?.fingerprintVersion !== undefined && value.fingerprintVersion !== 2) throw Error('BACKUP_METADATA_INVALID');
  if (!value || JSON.stringify(value.source) !== JSON.stringify(SOURCE) || !/^[a-f0-9]{64}$/.test(value.dumpSha256 ?? '') || !Array.isArray(value.roles)) throw Error('BACKUP_METADATA_INVALID');
  for (const role of value.roles) if (!role || typeof role.name !== 'string' || !role.name || typeof role.bypass !== 'boolean') throw Error('BACKUP_METADATA_INVALID');
  for (const snapshot of [value.before,value.after]) {
    if (!Array.isArray(snapshot) || snapshot.length === 0 || snapshot.length > 10000) throw Error('BACKUP_METADATA_INVALID');
    const names = new Set();
    for (const table of snapshot) {
      if (!table || !['auth','bud_platform','public'].includes(table.schema) || typeof table.table !== 'string' || !table.table || table.table.includes('\0') || !Number.isSafeInteger(table.count) || table.count < 0 || !/^[a-f0-9]{32}$/.test(table.digest ?? '')) throw Error('BACKUP_METADATA_INVALID');
      const name = table.schema + '.' + table.table;
      if (names.has(name)) throw Error('BACKUP_METADATA_INVALID');
      names.add(name);
    }
  }
  if (snapshotMismatch(value.before,value.after)) throw Error('SOURCE_CHANGED_DURING_BACKUP_RETRY_REQUIRED');
  return value;
}
async function verifyExisting(backupName, input, fixtureOnly = false) {
  // Fixed child name, never an arbitrary path. This route never contacts SOURCE or TLS preflight.
  const allowedName = fixtureOnly ? /^fixture-[a-f0-9]{16}$/ : /^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
  if (!allowedName.test(backupName ?? '')) throw Error('BACKUP_SELECTION_INVALID');
  if (typeof input.passphrase !== 'string' || input.passphrase.length < 16 || Object.keys(input).some(k => k !== 'passphrase')) throw Error('INVALID_LOCAL_INPUT');
  await protectRoot();
  const candidate = join(PRIVATE,backupName);
  const work = await mkdtemp(join(PRIVATE,'offline-verify-'));
  let receipt;
  try {
    for (const path of [candidate,join(candidate,'database.budenc'),join(candidate,'recovery-metadata.budenc')]) {
      if ((await lstat(path)).isSymbolicLink()) throw Error('BACKUP_SELECTION_INVALID');
    }
    const encrypted = await readFile(join(candidate,'database.budenc'));
    const metadata = validateRecoveryMetadata(JSON.parse(decrypt(await readFile(join(candidate,'recovery-metadata.budenc')),input.passphrase).toString('utf8')));
    const clear = decrypt(encrypted,input.passphrase);
    if (hash(clear) !== metadata.dumpSha256) throw Error('DECRYPTION_CHECK_FAILED');
    const archive = join(work,'recovered.dump'); await writeFile(archive,clear,{flag:'wx'});
    const checked = await restoreArchive(work,archive,metadata.roles,metadata.before);
    // Preserve original archive, metadata and failure result. Write a separate linked receipt only on PASS.
    receipt = { status:'BACKUP_AND_SCOPED_LOCAL_RESTORE_PASSED', verified:true, verifiedAt:new Date().toISOString(), project:fixtureOnly?'fixture-only':'cepmvqqrjcvhyzszqand',
      encryptedSha256:hash(encrypted), verificationMode:fixtureOnly?'offline-fixture':'offline-existing-archive', fingerprintSettings:'UTC/ISO-YMD/postgres/extra_float_digits3',
      originalExpectedFingerprintsRetained:true, ...checked, restoredSchemas:['auth','bud_platform','public'],fullManagedRestoreTested:false,
      remoteRestoreTested:false,managedAuthSettingsIncluded:false,storageObjectContentsIncluded:false };
  } finally { input.passphrase=''; await removePrivate(work); }
  await writeFile(join(candidate,'offline-verification-receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
  return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const readInput = async () => JSON.parse(await new Promise((accept, reject) => { let text = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', part => { text += part; if (text.length > 8192) reject(Error('INPUT_TOO_LARGE')); }); process.stdin.on('end', () => accept(text)); }));
    const result = process.argv[2] === '--check-tls' ? await verifySourceTls(SOURCE) : process.argv[2] === '--self-test' ? await selfTest() : process.argv[2] === '--verify-existing'
      ? await verifyExisting(process.argv[3],await readInput()) : process.argv[2] === '--run'
      ? await backup(await readInput())
      : { status: 'USE_LOCAL_BACKUP_PROMPT' };
    console.log(JSON.stringify(result));
  } catch (error) {
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'BACKUP_FAILED';
    console.log(JSON.stringify({ status: code, verified: false })); process.exitCode = 1;
  }
}
