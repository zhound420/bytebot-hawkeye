#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { createWriteStream, promises as fsPromises } from 'fs';
import { once } from 'events';
import { finished } from 'stream/promises';
import { join, parse, relative, resolve } from 'path';

type Direction = 'forward' | 'rollback';

interface CliOptions {
  direction: Direction;
  dryRun: boolean;
}

interface FileRow {
  id: string;
  name: string;
  taskId: string;
  storagePath?: string | null;
  legacyData?: string | null;
}

const prisma = new PrismaClient();
const DEFAULT_STORAGE_ROOT = resolve('/var', 'bytebot', 'uploads');

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const direction = args.includes('--rollback') ? 'rollback' : 'forward';
  const dryRun = args.includes('--dry-run');
  return { direction, dryRun };
}

function resolveStorageRoot(): string {
  const configured = process.env.BYTEBOT_SHARED_STORAGE_PATH;
  return configured ? resolve(configured) : DEFAULT_STORAGE_ROOT;
}

function sanitizeFileName(filename: string): string {
  const trimmed = filename.trim();
  const basename = trimmed.replace(/\\+/g, '/').split('/').pop() ?? 'file';
  const { name, ext } = parse(basename);
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
  const safeExt = ext.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 25);
  return `${safeName}${safeExt}`;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsPromises.access(target);
    return true;
  } catch {
    return false;
  }
}

async function generateUniquePath(directory: string, filename: string): Promise<string> {
  let candidate = join(directory, filename);
  const { name, ext } = parse(filename);
  let attempt = 0;

  while (await pathExists(candidate)) {
    attempt += 1;
    candidate = join(directory, `${name}-${attempt}${ext}`);
  }

  return candidate;
}

async function writeBase64ToFile(base64: string, destination: string) {
  const stream = createWriteStream(destination, { mode: 0o600 });
  try {
    const chunkSize = 1024 * 512;
    for (let offset = 0; offset < base64.length; offset += chunkSize) {
      const chunk = base64.slice(offset, offset + chunkSize);
      const buffer = Buffer.from(chunk, 'base64');
      if (!stream.write(buffer)) {
        await once(stream, 'drain');
      }
    }
    stream.end();
    await finished(stream);
  } catch (error) {
    stream.destroy();
    await fsPromises.rm(destination, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function migrateForward(storageRoot: string, dryRun: boolean) {
  console.log('Starting forward migration (database -> filesystem)');
  const rows = await prisma.$queryRaw<FileRow[]>`
    SELECT "id", "name", "taskId", "legacy_data" as "legacyData"
    FROM "File"
    WHERE COALESCE("storage_path", '') = ''
    ORDER BY "createdAt" ASC
  `;

  console.log(`Found ${rows.length} file(s) requiring migration.`);

  for (const row of rows) {
    if (!row.legacyData) {
      console.warn(`Skipping file ${row.id} (${row.name}) - no legacy data found.`);
      continue;
    }

    const sanitized = sanitizeFileName(row.name);
    const taskDirectory = join(storageRoot, row.taskId);
    await fsPromises.mkdir(taskDirectory, { recursive: true });
    const destination = await generateUniquePath(taskDirectory, sanitized);

    if (!dryRun) {
      await writeBase64ToFile(row.legacyData, destination);
      const relativePath = relative(storageRoot, destination);
      await prisma.$executeRawUnsafe(
        'UPDATE "File" SET "storage_path" = $1, "legacy_data" = NULL, "updatedAt" = NOW() WHERE "id" = $2',
        relativePath,
        row.id,
      );
      console.log(`Migrated ${row.name} -> ${relativePath}`);
    } else {
      console.log(`[dry-run] Would migrate ${row.name} to ${destination}`);
    }
  }
}

async function migrateRollback(storageRoot: string, dryRun: boolean) {
  console.log('Starting rollback migration (filesystem -> database)');
  const rows = await prisma.$queryRaw<FileRow[]>`
    SELECT "id", "name", "taskId", "storage_path" as "storagePath"
    FROM "File"
    WHERE COALESCE("storage_path", '') <> ''
    ORDER BY "createdAt" ASC
  `;

  console.log(`Found ${rows.length} file(s) staged on disk.`);

  for (const row of rows) {
    if (!row.storagePath) {
      console.warn(`Skipping file ${row.id} (${row.name}) - storage path missing.`);
      continue;
    }

    const absolutePath = resolve(storageRoot, row.storagePath);
    if (!(await pathExists(absolutePath))) {
      console.warn(
        `Skipping file ${row.id} (${row.name}) - expected file missing at ${absolutePath}.`,
      );
      continue;
    }

    if (!dryRun) {
      const buffer = await fsPromises.readFile(absolutePath);
      const base64 = buffer.toString('base64');
      await prisma.$executeRawUnsafe(
        'UPDATE "File" SET "legacy_data" = $1, "storage_path" = $2, "updatedAt" = NOW() WHERE "id" = $3',
        base64,
        '',
        row.id,
      );
      console.log(`Restored ${row.name} from ${row.storagePath}`);
    } else {
      console.log(`[dry-run] Would restore ${row.name} from ${absolutePath}`);
    }
  }
}

async function main() {
  const options = parseArgs();
  const storageRoot = resolveStorageRoot();
  console.log(`Using storage root: ${storageRoot}`);
  await fsPromises.mkdir(storageRoot, { recursive: true });

  if (options.direction === 'forward') {
    await migrateForward(storageRoot, options.dryRun);
  } else {
    await migrateRollback(storageRoot, options.dryRun);
  }
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
