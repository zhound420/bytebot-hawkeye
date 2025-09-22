-- AlterTable
ALTER TABLE "Task"
ADD COLUMN     "iterationsSinceSummary" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSummarizedMessageId" TEXT;

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN     "estimatedTokens" INTEGER NOT NULL DEFAULT 0;
