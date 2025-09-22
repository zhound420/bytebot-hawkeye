import { Injectable, Logger } from '@nestjs/common';
import { File } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { writeFile as sendWriteFile } from '../agent/agent.computer-use';

interface Base64FileInput {
  name: string;
  base64: string;
  size: number;
  type?: string;
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly desktopDirectory = '/home/user/Desktop';
  private readonly storageDirectory =
    process.env.BYTEBOT_FILE_STORAGE_DIR ||
    path.join(process.cwd(), 'storage', 'task-files');

  async saveTaskFile(
    taskId: string,
    file: Base64FileInput,
  ): Promise<{ storagePath: string; storageProvider: string }> {
    const normalized = this.normalizeBase64Data(file.base64);
    const taskDirectory = path.join(this.storageDirectory, taskId);
    await fs.mkdir(taskDirectory, { recursive: true });

    const destinationPath = path.join(taskDirectory, file.name);
    const buffer = Buffer.from(normalized, 'base64');
    await fs.writeFile(destinationPath, buffer);
    this.logger.debug(
      `Persisted task file ${file.name} for ${taskId} to ${destinationPath}`,
    );

    return { storagePath: destinationPath, storageProvider: 'local' };
  }

  async writeTaskFilesToDesktop(files: File[]): Promise<void> {
    for (const file of files) {
      const destinationPath = path.join(this.desktopDirectory, file.name);
      const base64Data = await this.loadFileData(file);
      if (!base64Data) {
        this.logger.warn(
          `Skipping file ${file.name}; no stored data available to write to desktop`,
        );
        continue;
      }
      await this.writeFileWithFallback(destinationPath, base64Data);
    }
  }

  private async writeFileWithFallback(
    destinationPath: string,
    base64Data: string,
  ): Promise<void> {
    try {
      const result = await sendWriteFile({
        path: destinationPath,
        content: base64Data,
      });

      if (!result.success) {
        throw new Error(result.message ?? 'Unknown error writing file');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown computer use error';
      this.logger.warn(
        `Failed to write file via computer use gateway (${message}). Falling back to local filesystem write.`,
      );
      await this.writeFileLocally(destinationPath, base64Data);
    }
  }

  private async writeFileLocally(
    destinationPath: string,
    base64Data: string,
  ): Promise<void> {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(destinationPath, buffer);
    this.logger.debug(`Wrote file locally to ${destinationPath}`);
  }

  private async loadFileData(file: File): Promise<string | null> {
    const legacyData = (file as unknown as { data?: string }).data;
    if (legacyData) {
      return this.normalizeBase64Data(legacyData);
    }

    if (file.storagePath) {
      try {
        const buffer = await fs.readFile(file.storagePath);
        return buffer.toString('base64');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown filesystem error';
        this.logger.error(
          `Failed to read stored file ${file.storagePath} for ${file.name}: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
        return null;
      }
    }

    return null;
  }

  private normalizeBase64Data(data: string): string {
    if (!data) {
      return '';
    }

    const base64Marker = 'base64,';
    const markerIndex = data.indexOf(base64Marker);

    if (markerIndex === -1) {
      return data;
    }

    return data.substring(markerIndex + base64Marker.length);
  }
}
