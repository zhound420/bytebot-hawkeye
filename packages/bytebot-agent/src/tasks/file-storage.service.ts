import { Injectable, Logger } from '@nestjs/common';
import { File } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { writeFile as sendWriteFile } from '../agent/agent.computer-use';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly desktopDirectory = '/home/user/Desktop';

  async writeTaskFilesToDesktop(files: File[]): Promise<void> {
    for (const file of files) {
      const destinationPath = path.join(this.desktopDirectory, file.name);
      const base64Data = this.normalizeBase64Data(file.data);
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
