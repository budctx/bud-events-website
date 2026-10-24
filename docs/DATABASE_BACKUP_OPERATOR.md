# Local encrypted backup operator procedure

Prepared 23 October 2026 for the owner-approved existing project `cepmvqqrjcvhyzszqand`.
This procedure is not evidence that the real database was exported or restored.

Current outcome, 24 October: after the official CA correction the owner completed a new visible attempt. It reached `RESTORED_DATA_MISMATCH`, `verified:false`, after encrypted archive/metadata creation. No successful receipt was issued. Keep the encrypted candidate and failure evidence; do not rerun export or ask for the database password by default. The owner requested Expert OS oversight. Separate-context technical and Manager reviews require a synthetic reproduction of the fingerprint mismatch and a reviewed offline revalidation path before one bounded real validation. The leading timezone/serialization hypothesis remains unproven for this archive. TLS success is superseded as the latest backup state by the restore failure; all remote migrations and sales remain gated.

## Reviewed recovery strategy

The original Expert OS 1.6.9 Independent Review, Recovery Loop Control and Manager Meta-Review modules were read. Fresh-context same-model reviewers (L1, not human certification) found a reproducible presentation-dependent fingerprint defect. An in-memory PostgreSQL reproduction showed that identical timestamptz rows hash differently under UTC and Asia/Riyadh. This proves a comparison defect, not the cause of this particular archive's failure.

The corrected comparison pins UTC, ISO/YMD dates, postgres interval formatting and extra_float_digits=3 on every fingerprint connection, verifies those settings and compares exact table identities, counts and original row digests independently of catalog ordering. It does not remove columns or ignore changed values. Sanitized failures distinguish table-set, row-count, content and settings differences. Legacy encrypted metadata remains authoritative: its expected hashes are never recalculated or replaced to obtain success; if those retained hashes do not match, revalidation stops. Unsupported metadata formats are rejected.

`node scripts/database-backup.mjs --self-test` uses only fabricated data and disposable loopback PostgreSQL clusters. Expanded coverage includes timestamptz/timestamp/date/interval, numeric/float, JSON, bytea, null, Arabic text, duplicates and empty tables. It reproduces the old timezone defect, checks canonical equality, rejects six mutations, restores into a cluster with Asia/Riyadh defaults and exercises encrypted offline verification with fixture-only receipts. This does not certify an actual owner archive or full managed recovery.

After exact-candidate review and local tests, use `scripts/verify-existing-backup.ps1 -BackupName backup-2026-10-24T15-14-25.392Z` under the owner account with a visible Normal window. This asks **only for the existing backup passphrase**, not the database password. The `--verify-existing` route has no TLS preflight or source connection; its only PostgreSQL connections are loopback. The candidate name is validated, symbolic-link inputs are rejected, AES-GCM authentication and stored dump SHA are checked, original before/after fingerprints must agree, and a fresh local restore must match every original table/count/digest. Only after successful cleanup does it create a separate `offline-verification-receipt.json`, linked to the unchanged encrypted archive's SHA256. Original archive, metadata and original failure result remain unchanged. A separate `offline-last-result.json` is the sanitized operator outcome.

Recovery budget: at most one real offline revalidation after reviewed prerequisites. Any mismatch, crash, timeout, absent success receipt or cleanup failure stops further prompts/retries and returns to Manager review. A fresh remote export requires a demonstrated reason why the retained archive cannot answer the question. No automatic rerun or migration/payment activation follows any local PASS.

Exact-candidate technical review found a further blocking cleanup path: failed shutdown or failed preparation after startup could fall through to recursive removal of a possibly running local cluster. Cluster lifecycle is now tracked before requesting startup; startup/preparation failures attempt to stop that exact cluster. Recursive removal is guarded by confirmed stop. If stop is uncertain, the private directory is retained with `LOCAL_CLUSTER_STOP_UNVERIFIED_RETAINED`, and no success receipt is written. Failure-injection tests cover stop timeout, preparation failure after start, ambiguous start timeout and successful recovery stop. This fault handling is synthetic evidence; never induce shutdown failures with owner data merely to test it.

## Verified tooling and boundaries

- Official EDB PostgreSQL Windows binaries 17.11 were downloaded through the link on https://www.enterprisedb.com/download-postgresql-binaries (`fileid=1260616`). Archive SHA-256: `80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F`. Runtime stays under ignored `supabase/.temp/backup-tools/`; no Windows service or paid resource was installed.
- The authenticated Supabase Connect dialog supplied session-pooler host `aws-0-ap-south-1.pooler.supabase.com`, port 5432, database `postgres`, user `postgres.cepmvqqrjcvhyzszqand`. This is the free IPv4 alternative, not the transaction pooler.
- Run under the actual Windows owner account. The restricted Codex execution account cannot run PostgreSQL bootstrap reliably and is rejected before backup-folder creation. PostgreSQL's Windows bootstrap also rejected the Arabic workspace path; the tool uses Windows' ASCII 8.3 alias for the same directory, without moving the project.
- Real PostgreSQL fixture self-test passed: export, AES-256-GCM encryption/decryption, separate local cluster restore, and exact Auth/application row-count and digest comparison. This was one fixture account and one fixture wallet, not the owner's database.

## Owner input

Run `powershell.exe -NoProfile -STA -File scripts/database-backup.ps1` locally. All three fields are masked:

1. Existing **database password**, not the Supabase dashboard login password.
2. A new backup passphrase of at least 16 characters.
3. Confirmation of the backup passphrase.

Keep the passphrase in the owner's password manager; it is not recoverable from the files. Do not paste either password into chat, shell arguments, a command history, environment configuration, screenshots, Notion or Git. Do not reset the database password merely to satisfy this procedure. Cancellation makes no remote changes.

The prompt passes credentials through a local child-process stdin pipe. The database password is held in a temporary owner-only pgpass file, not process arguments or PGPASSWORD. Temporary plaintext files and disposable data directories are removed in finally cleanup after the local server stops. A crash or forced termination can leave a private pending directory; inspect the exact directory and stop its own server before cleanup. Never recursively delete a computed path without checking its resolved containment.

Prompt handoff regressions: the first owner attempt returned `INVALID_LOCAL_INPUT` before any database connection because controls were read after closing the form. Capture now happens before closing. The second attempt failed before starting Node because Windows PowerShell 5.1/.NET Framework lacks `ProcessStartInfo.StandardInputEncoding`. The helper now writes BOM-free UTF-8 bytes directly to the child stdin stream and clears the byte buffer. It never starts processes, reads files or accesses the network itself. The standalone Windows fixture (`tests/windows/backup-prompt.test.ps1`) checks disposed controls and actual Node stdin parsing, including Arabic/accented characters, using only a dummy consumer. Run it with Windows PowerShell 5.1, the same runtime as the prompt; it never imports the real backup runner or contacts Supabase. The owner authorized one final free local attempt. A passed fixture is still not a real export result.

## What runs

The source connection uses `verify-full` TLS against the reviewed official Supabase CA in `scripts/certificates/supabase-prod-ca-2021.crt`, a fixed project endpoint and read-only session options. The public CA came from the authenticated project's Database Settings download link, https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt. Its SHA-256 certificate fingerprint is pinned in `scripts/backup-tls.mjs`; validity dates and CA status are checked. A certificate replacement requires review, never automatic fallback to a different trust store. There is no SSL downgrade, database-password rotation, permission expansion, production restore, migration, payment or account deletion. Do not broaden source privileges if pg_dump reports a permission failure.

Before showing any password fields, the prompt runs `node scripts/database-backup.mjs --check-tls`: only PostgreSQL SSLRequest and a fully verified TLS handshake, with no credentials or SQL. The backup repeats this check. A successful handshake reports `verified:false` because it is not a backup or authentication result. Launch the owner's explicitly requested interactive prompt with `-WindowStyle Normal`; a hidden PowerShell process or a WAITING status file alone does not prove that the owner can see the form.

On 24 October, the owner's actual new attempt returned `POSTGRES_PSQL_TLS_FAILED`. A credential-free probe using the old Windows roots returned `SELF_SIGNED_CERT_IN_CHAIN`; the same endpoint with the dashboard's official CA passed hostname/chain verification. This establishes a trust-store issue for that attempt, not a wrong password. No actual export/restore passed as part of this TLS diagnosis.

The first preflight implementation printed success but crashed Node 24.12 on Windows while destroying both the TLS wrapper and its underlying socket (exit -1073741819). Cleanup now closes only the owning wrapper and settles once. `powershell.exe -NoProfile -File tests/windows/backup-tls.test.ps1` checks two real credential-free handshakes and requires both a valid result and process exit 0. A separate native `psql -w` probe with no password confirmed that libpq accepted the official CA and reached authentication. None of these probes proves export or restore.

The tool fingerprints Auth/application table contents before/after a full custom-format database export. A changing source fails verification rather than assuming consistency across separate inspection sessions; the pg_dump archive itself is a consistent snapshot. Archive and recovery metadata are encrypted separately with random salts/IVs, scrypt-derived keys and AES-256-GCM authentication. Wrong passphrase, truncation and tampering fail closed in tests.

The encrypted archive is decrypted into a temporary owner-only directory and restored into a fresh password-protected PostgreSQL cluster listening on 127.0.0.1 at a temporary port. Only `auth`, `bud_platform` and `public` objects are restored for this local check; managed Supabase services/extensions are not replaced by stubs. Restored row counts and content digests must match the inspected source. A missing dependency or restore error means **not verified**, even when an encrypted candidate archive exists. Role names/bypass attributes are retained in encrypted recovery metadata, but role passwords, global role memberships and full managed-service recovery are not established by this local check.

## Output and evidence

All output stays in owner-only, Git-ignored `supabase/.temp/secure-backups/`:

- A unique `backup-…` folder contains `database.budenc` and `recovery-metadata.budenc`. Both require the backup passphrase.
- A successful `receipt.json` states `BACKUP_AND_SCOPED_LOCAL_RESTORE_PASSED`, encrypted SHA-256, restored table count, Auth user count, date and explicit limitations.
- `last-result.json` contains only a sanitized final result/failure code. `prompt-status.json` reports input readiness. These do not contain credentials, Auth rows or plaintext row digests.
- No receipt means no verified backup. Do not confuse `SELF_TEST_PASSED` with a remote export result.

The encrypted files are external to Supabase's primary failure domain, but remain on this computer until the owner chooses a second private storage location. No cloud upload, sharing, scheduled retention policy or remote restore drill is performed. Do not upload them to Git or Notion. Database archives do not contain Storage object bytes or hosted Auth/OAuth/environment settings. Commercial recovery readiness remains open until the necessary external copy, managed recovery procedure, retention/RPO/RTO and remote drill evidence exist.

References: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [TLS verification](https://www.postgresql.org/docs/17/libpq-ssl.html), [password files](https://www.postgresql.org/docs/17/libpq-pgpass.html).

## Sanitized failure diagnosis

New attempts classify missing executables, local execution denial, process timeout, certificate validation, authentication, DNS, connection timeout/refusal and database permission errors into fixed POSTGRES tool/reason codes. Unknown errors remain FAILED. Raw stderr, commands, paths, connection strings and credentials are never returned or logged; classification happens in memory. This is diagnosis only: TLS verification, credentials, privileges and remote data remain unchanged. Earlier POSTGRES_PSQL_FAILED cannot be retrospectively classified from the generic receipt. No prompt retry or real backup was performed to test this change; fixture tests validate classification and secret suppression.
