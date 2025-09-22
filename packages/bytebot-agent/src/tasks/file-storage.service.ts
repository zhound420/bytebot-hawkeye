import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TaskFileDto } from './dto/create-task.dto';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);

  async persistTaskFiles(
    prisma: Prisma.TransactionClient,
    taskId: string,
    files?: TaskFileDto[],
  ): Promise<string> {
    if (!files || files.length === 0) {
      return '';
    }

    this.logger.debug(
      `Saving ${files.length} file(s) for task ID: ${taskId}`,
    );

    const descriptions: string[] = [];

    for (const file of files) {
      const base64Data = file.base64.includes('base64,')
        ? file.base64.split('base64,')[1]
        : file.base64;

      await prisma.file.create({
        data: {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: base64Data,
          taskId,
        },
      });

      descriptions.push(`\nFile ${file.name} written to desktop.`);
    }

    this.logger.debug(`Files saved successfully for task ID: ${taskId}`);

    return `\n${descriptions.join('')}`;
  }
}
