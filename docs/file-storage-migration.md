# File Storage Migration Guide

This guide explains how to migrate existing task file uploads from the legacy
`File.data` column (base64-encoded blobs) to the new shared filesystem storage
introduced by the Bytebot agent. The process is designed to be repeatable,
scripted, and reversible when necessary.

## Summary of Changes

- Prisma schema now records `storage_path` and `storage_provider` metadata
  instead of inline base64 payloads.
- Legacy base64 data has been renamed to `legacy_data` in the database and is
  ignored by the Prisma client.
- A reusable `FileStorageService` streams incoming uploads directly to a shared
  volume (`BYTEBOT_SHARED_STORAGE_PATH`) during task creation.
- The agent scheduler copies staged files from shared storage into the desktop
  mount (`BYTEBOT_DESKTOP_MOUNT_PATH`) instead of invoking the daemon's
  `write_file` HTTP endpoint.
- A data migration script transforms historical rows and supports rollback.

## Prerequisites

1. Ensure the shared storage directory is mounted and writable by the agent and
   desktop daemon. Configure via `BYTEBOT_SHARED_STORAGE_PATH` (defaults to
   `/var/bytebot/uploads`).
2. Confirm the desktop daemon observes the same directory used by the scheduler
   (default `/home/user/Desktop` or override with `BYTEBOT_DESKTOP_MOUNT_PATH`).
3. Back up the `File` table or database before running any migrations.

## Migration Steps

1. **Apply Prisma schema changes**

   ```bash
   cd packages/bytebot-agent
   npx prisma migrate deploy
   ```

   This adds `storage_path`, `storage_provider`, and renames `data` to
   `legacy_data`.

2. **Dry-run the data migration (optional but recommended)**

   ```bash
   npx ts-node scripts/migrate-file-storage.ts --dry-run
   ```

   Review the planned file movements and ensure the storage path is correct.

3. **Execute the migration**

   ```bash
   npx ts-node scripts/migrate-file-storage.ts
   ```

   The script streams each legacy base64 payload to disk, updates
   `storage_path`, and clears `legacy_data`.

4. **Verify results**

   - Confirm files exist on disk under the shared storage directory grouped by
     task ID.
   - Inspect the `File` table: `storage_path` should be populated and
     `legacy_data` should be `NULL`.
   - Trigger a task run to confirm the agent scheduler stages files onto the
     desktop mount.

## Rollback Procedure

If you must revert to the previous inline-storage implementation:

1. **Restore base64 payloads**

   ```bash
   cd packages/bytebot-agent
   npx ts-node scripts/migrate-file-storage.ts --rollback
   ```

   This reads each staged file from shared storage, re-encodes it to base64,
   and places the value back into `legacy_data` while clearing `storage_path`.

2. **Revert application code and schema**

   - Check out the prior Git revision that used the inline storage model.
   - Run `npx prisma migrate resolve --applied <migration_id>` as needed to mark
     the latest migration as rolled back, or rebuild the database from backup.

3. **Restart services** to ensure they load the older Prisma client and stop
   referencing the shared storage paths.

> **Note:** The rollback process does not delete files on disk. Remove them
> manually only after confirming the database has been restored and no longer
> references the shared storage paths.

## Operational Tips

- The migration script is idempotent—running it again will skip files that
  already have `storage_path` set (forward) or missing on disk (rollback).
- Use the `--dry-run` flag in both directions to audit planned updates without
  touching the database.
- Monitor disk capacity on the shared volume during the first migration, as it
  will mirror the size of existing base64 data.
