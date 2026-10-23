# Local encrypted backup operator procedure

Prepared 23 October 2026 for the owner-approved existing project `cepmvqqrjcvhyzszqand`.
This procedure is not evidence that the real database was exported or restored.

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

Prompt handoff regression: the first owner attempt returned `INVALID_LOCAL_INPUT` before any database connection. The prompt had read text controls after closing the form. It now captures the validated payload in memory before closing, serializes that captured payload to an explicitly UTF-8 stdin pipe, then clears it. `scripts/backup-prompt-input.ps1` contains only the form-lifecycle helper, with no file/process/network operations. The separate Windows fixture test (`tests/windows/backup-prompt.test.ps1`) verifies the serialized payload after controls have been disposed; it never loads the real backup runner or contacts Supabase. The owner selected continuing this free local route. A passed prompt fixture is still not a real export result.

## What runs

The source connection uses `verify-full` TLS against the Windows trusted-root certificate bundle, a fixed project endpoint and read-only session options. There is no SSL downgrade, database-password rotation, permission expansion, production restore, migration, payment or account deletion. Do not broaden source privileges if pg_dump reports a permission failure.

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
