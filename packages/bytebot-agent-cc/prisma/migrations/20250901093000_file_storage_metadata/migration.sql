-- AlterTable
ALTER TABLE "File" RENAME COLUMN "data" TO "legacy_data";

ALTER TABLE "File"
    ADD COLUMN "storage_path" TEXT,
    ADD COLUMN "storage_provider" TEXT NOT NULL DEFAULT 'filesystem';

UPDATE "File"
SET "storage_path" = COALESCE("storage_path", '');

ALTER TABLE "File"
    ALTER COLUMN "storage_path" SET NOT NULL;

ALTER TABLE "File"
    ALTER COLUMN "storage_provider" DROP DEFAULT;
