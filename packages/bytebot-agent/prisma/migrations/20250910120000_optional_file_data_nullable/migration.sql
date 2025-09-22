-- AlterTable
ALTER TABLE "File"
    ADD COLUMN IF NOT EXISTS "storage_path" TEXT,
    ADD COLUMN IF NOT EXISTS "storage_provider" TEXT;

UPDATE "File"
SET "storage_path" = NULLIF("storage_path", '')
WHERE "storage_path" IS NOT NULL;

UPDATE "File"
SET "storage_provider" = COALESCE("storage_provider", 'filesystem')
WHERE "storage_provider" IS NULL;

ALTER TABLE "File"
    ALTER COLUMN "storage_path" DROP NOT NULL,
    ALTER COLUMN "storage_provider" DROP NOT NULL,
    ALTER COLUMN "legacy_data" DROP NOT NULL;
