import { X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { connect as tcpConnect } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

// Public CA downloaded from the authenticated project's Database Settings link:
// https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
export const officialCaPath = new URL('./certificates/supabase-prod-ca-2021.crt', import.meta.url);
const fingerprint = '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA';
export function validateOfficialCa(pem, now = Date.now()) {
  let cert;
  try { cert = new X509Certificate(pem); } catch { throw Error('BACKUP_CA_INVALID'); }
  if (!cert.ca || cert.fingerprint256 !== fingerprint) throw Error('BACKUP_CA_UNEXPECTED');
  if (now < Date.parse(cert.validFrom) || now >= Date.parse(cert.validTo)) throw Error('BACKUP_CA_EXPIRED');
  return pem;
}
export async function readOfficialCa() {
  return validateOfficialCa(await readFile(officialCaPath));
}
// No authentication or SQL: PostgreSQL SSLRequest followed by verified TLS only.
export async function verifySourceTls(source) {
  const ca = await readOfficialCa();
  return new Promise((accept, reject) => {
    let secure;
    let finished = false;
    const socket = tcpConnect(Number(source.port), source.host);
    const timer = setTimeout(() => finish(Error('BACKUP_TLS_PREFLIGHT_TIMEOUT')), 15000);
    const finish = error => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      // The TLS wrapper owns its underlying socket. Destroying both can crash Node on Windows.
      if (secure) secure.destroy(); else socket.destroy();
      error ? reject(error) : accept({ status: 'POSTGRES_TLS_VERIFIED_WITH_OFFICIAL_CA', verified: false });
    };
    socket.once('error', () => finish(Error('BACKUP_TLS_PREFLIGHT_CONNECTION_FAILED')));
    socket.once('connect', () => socket.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])));
    socket.once('data', response => {
      if (response.length !== 1 || response[0] !== 83) return finish(Error('BACKUP_TLS_PREFLIGHT_UNSUPPORTED'));
      secure = tlsConnect({ socket, servername: source.host, ca, rejectUnauthorized: true }, () => finish());
      secure.once('error', () => finish(Error('BACKUP_TLS_PREFLIGHT_CERTIFICATE_FAILED')));
    });
  });
}
