// Operator tool. Credentials arrive only through stdin from the local masked prompt.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
let postgresRoot = ROOT;
const PRIVATE = join(ROOT, 'supabase', '.temp', 'secure-backups');
const BIN = join(ROOT, 'supabase', '.temp', 'backup-tools', 'runtime', 'pgsql', 'bin');
const SOURCE = { host: 'aws-0-ap-south-1.pooler.supabase.com', port: '5432', user: 'postgres.cepmvqqrjcvhyzszqand', database: 'postgres' };
const MAGIC = Buffer.from('BUDBAK01');
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
  await rm(path, { recursive: true, force: true });
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
async function connection(work, config, password, sslRoot) {
  const passfile = join(work, randomBytes(8).toString('hex') + '.pgpass');
  const escaped = password.replaceAll('\\', '\\\\').replaceAll(':', '\\:');
  await writeFile(passfile, `${config.host}:${config.port}:${config.database}:${config.user}:${escaped}\n`, { mode: 0o600, flag: 'wx' });
  return cleanEnv({ PGHOST: config.host, PGPORT: config.port, PGUSER: config.user, PGDATABASE: config.database,
    PGPASSFILE: passfile, PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'bud-backup-readonly',
    PGSSLMODE: sslRoot ? 'verify-full' : 'disable', ...(sslRoot ? { PGSSLROOTCERT: sslRoot, PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=60000' } : {}) });
}
async function sql(env, query) { return tool('psql', ['-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], env); }
const ident = name => '"' + name.replaceAll('"', '""') + '"';
async function fingerprint(env) {
  const tables = JSON.parse(await sql(env, `select coalesce(json_agg(json_build_object('schema',n.nspname,'table',c.relname) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('auth','bud_platform','public')`));
  const result = [];
  for (const table of tables) {
    const value = JSON.parse(await sql(env, `select json_build_object('count',count(*),'digest',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from ${ident(table.schema)}.${ident(table.table)} t`));
    result.push({ ...table, ...value });
  }
  return result;
}
async function localCluster(work) {
  const data = join(work, 'cluster'), pwfile = join(work, 'local-password');
  const password = randomBytes(32).toString('hex'); await writeFile(pwfile, password, { mode: 0o600 });
  const port = await new Promise((accept, reject) => { const server = createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => accept(value)); }); });
  await tool('initdb', ['-D', data, '-U', 'postgres', '--auth=scram-sha-256', '--pwfile=' + pwfile, '--encoding=UTF8', '--locale=C'], cleanEnv({}));
  await tool('pg_ctl', ['-D', data, '-l', join(work, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'], cleanEnv({}));
  const env = await connection(work, { host: '127.0.0.1', port: String(port), user: 'postgres', database: 'postgres' }, password);
  return { env, stop: () => tool('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], cleanEnv({})) };
}
async function exportArchive(work, source) {
  const archive = join(work, 'database.dump');
  await tool('pg_dump', ['-w', '-Fc', '--file=' + archive], source);
  const bytes = await readFile(archive);
  if (bytes.length < 100 || bytes.subarray(0, 5).toString() !== 'PGDMP') throw Error('INVALID_DUMP');
  return { archive, bytes };
}
async function restoreArchive(work, archive, roles, expected) {
  const local = await localCluster(work);
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
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('RESTORED_DATA_MISMATCH');
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
  let source;
  try {
    source = await localCluster(work);
    await sql(source.env, `create schema auth; create schema bud_platform; create table auth.users(id uuid primary key,marker text); insert into auth.users values('11111111-1111-4111-8111-111111111111','fixture-only'); create table bud_platform.wallets(host_id uuid,credits int); insert into bud_platform.wallets select id,5 from auth.users; alter table bud_platform.wallets enable row level security;`);
    const expected = await fingerprint(source.env), dump = await exportArchive(work, source.env);
    const password = randomBytes(32).toString('hex'), encrypted = encrypt(dump.bytes, password), clear = decrypt(encrypted, password);
    if (hash(clear) !== hash(dump.bytes)) throw Error('ENCRYPTION_ROUNDTRIP_FAILED');
    const secondWork = join(work, 'restore'); await mkdir(secondWork); const restored = join(secondWork, 'verify.dump'); await writeFile(restored, clear);
    const checked = await restoreArchive(secondWork, restored, [], expected);
    return { status: 'SELF_TEST_PASSED', ...checked, remoteBackupCreated: false };
  } finally { if (source) await source.stop(); await removePrivate(work); }
}
async function backup(input) {
  if (typeof input.password !== 'string' || !input.password || /[\r\n]/.test(input.password) || typeof input.passphrase !== 'string' || input.passphrase.length < 16) throw Error('INVALID_LOCAL_INPUT');
  const sslRoot = join(PRIVATE, 'windows-roots.pem');
  if (!(await readFile(sslRoot, 'utf8')).includes('BEGIN CERTIFICATE')) throw Error('TRUST_ROOTS_UNAVAILABLE');
  await protectRoot(); const work = await mkdtemp(join(PRIVATE, 'pending-'));
  const final = join(PRIVATE, 'backup-' + new Date().toISOString().replaceAll(':', '-'));
  await mkdir(final);
  try {
    const source = await connection(work, SOURCE, input.password, sslRoot);
    const before = await fingerprint(source);
    const roles = JSON.parse(await sql(source, `select json_agg(json_build_object('name',rolname,'bypass',rolbypassrls) order by rolname) from pg_roles`));
    const dump = await exportArchive(work, source);
    const after = await fingerprint(source);
    // Fingerprints stay inside the encrypted manifest; no Auth records or hashes are printed.
    const encrypted = encrypt(dump.bytes, input.passphrase);
    await writeFile(join(final, 'database.budenc'), encrypted, { flag: 'wx' });
    await writeFile(join(final, 'recovery-metadata.budenc'), encrypt(Buffer.from(JSON.stringify({ source: SOURCE, roles, before, after, dumpSha256: hash(dump.bytes) })), input.passphrase), { flag: 'wx' });
    if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('SOURCE_CHANGED_DURING_BACKUP_RETRY_REQUIRED');
    const clear = decrypt(encrypted, input.passphrase);
    if (hash(clear) !== hash(dump.bytes)) throw Error('DECRYPTION_CHECK_FAILED');
    const recovered = join(work, 'recovered.dump'); await writeFile(recovered, clear);
    const verified = await restoreArchive(work, recovered, roles, before);
    const receipt = { status: 'BACKUP_AND_SCOPED_LOCAL_RESTORE_PASSED', createdAt: new Date().toISOString(), project: 'cepmvqqrjcvhyzszqand',
      encryptedSha256: hash(encrypted), ...verified, restoredSchemas: ['auth','bud_platform','public'], fullManagedRestoreTested: false,
      remoteRestoreTested: false, managedAuthSettingsIncluded: false, storageObjectContentsIncluded: false };
    await writeFile(join(final, 'receipt.json'), JSON.stringify(receipt, null, 2));
    return { ...receipt, directory: final };
  } finally { input.password = ''; input.passphrase = ''; await removePrivate(work); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = process.argv[2] === '--self-test' ? await selfTest() : process.argv[2] === '--run'
      ? await backup(JSON.parse(await new Promise((accept, reject) => { let text = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', part => { text += part; if (text.length > 8192) reject(Error('INPUT_TOO_LARGE')); }); process.stdin.on('end', () => accept(text)); })))
      : { status: 'USE_LOCAL_BACKUP_PROMPT' };
    console.log(JSON.stringify(result));
  } catch (error) {
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'BACKUP_FAILED';
    console.log(JSON.stringify({ status: code, verified: false })); process.exitCode = 1;
  }
}
