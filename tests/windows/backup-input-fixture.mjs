// Fixture-only stdin consumer. Does not import the backup engine or use the network.
let input = '';
for await (const chunk of process.stdin) input += chunk.toString('utf8');
const payload = JSON.parse(input);
if (payload.password !== 'fixture-only-database-password\u0628\u00e9'
    || payload.passphrase !== 'fixture-only-encryption-passphrase\u0639') {
  process.exitCode = 1;
} else {
  process.stdout.write('FIXTURE_UTF8_INPUT_PASSED');
}
