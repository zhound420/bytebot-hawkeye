-- CreateEnum
CREATE TYPE "ApiKeyName" AS ENUM ('ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY');

-- CreateTable
CREATE TABLE "ApiKey" (
    "name" "ApiKeyName" NOT NULL,
    "value" TEXT,
    "lastFour" TEXT,
    "length" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("name")
);
