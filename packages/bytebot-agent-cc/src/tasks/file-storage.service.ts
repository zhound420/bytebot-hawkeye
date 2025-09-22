import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, promises as fsPromises } from 'fs';
import { join, parse, relative, resolve } from 'path';
import { once } from 'events';
import { finished } from 'stream/promises';

const DEFAULT_STORAGE_DIR = resolve('/var', 'bytebot', 'uploads');
const DEFAULT_DESKTOP_DIR = '/home/user/Desktop';

interface PersistedFileMetadata {
  absolutePath: string;
  relativePath: string;
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly storageRoot: string;
  readonly provider = 'filesystem';

  constructor(private readonly configService: ConfigService) {
    const configuredRoot = this.configService.get<string>(
      'BYTEBOT_SHARED_STORAGE_PATH',
    );
    this.storageRoot = configuredRoot
      ? resolve(configuredRoot)
      : DEFAULT_STORAGE_DIR;
    this.logger.log(`Using shared storage root: ${this.storageRoot}`);
  }

  getStorageRoot(): string {
    return this.storageRoot;
  }

  getDesktopMountPath(): string {
    const configured = this.configService.get<string>(
      'BYTEBOT_DESKTOP_MOUNT_PATH',
    );
    return configured ? resolve(configured) : DEFAULT_DESKTOP_DIR;
  }

  getAbsolutePath(relativePath: string): string {
    return resolve(this.storageRoot, relativePath);
  }

  async persistBase64File(
    taskId: string,
    file: { name: string; base64: string },
  ): Promise<PersistedFileMetadata> {
    const base64Data = this.extractBase64Payload(file.base64);
    const sanitizedName = this.sanitizeFileName(file.name);
    const taskDirectory = join(this.storageRoot, taskId);
    await fsPromises.mkdir(taskDirectory, { recursive: true });
    const destinationPath = await this.generateUniquePath(
      taskDirectory,
      sanitizedName,
    );

    await this.writeBase64ToFile(base64Data, destinationPath);

    const relativePath = relative(this.storageRoot, destinationPath);

    return {
      absolutePath: destinationPath,
      relativePath,
    };
  }

  async copyToDesktop(
    file: { name: string; storagePath: string },
  ): Promise<string> {
    const absoluteSourcePath = this.getAbsolutePath(file.storagePath);
    const desktopMount = this.getDesktopMountPath();
    await fsPromises.mkdir(desktopMount, { recursive: true });
    const destinationPath = await this.generateUniquePath(
      desktopMount,
      this.sanitizeFileName(file.name),
    );

    await fsPromises.copyFile(absoluteSourcePath, destinationPath);

    return destinationPath;
  }

  private sanitizeFileName(filename: string): string {
    const trimmed = filename.trim();
    const basename = trimmed.replace(/\\+/g, '/').split('/').pop() ?? 'file';
    const { name, ext } = parse(basename);
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
    const safeExt = ext.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 25);
    return `${safeName}${safeExt}`;
  }

  private extractBase64Payload(base64: string): string {
    if (base64.includes('base64,')) {
      return base64.slice(base64.indexOf('base64,') + 'base64,'.length);
    }

    return base64;
  }

  private async writeBase64ToFile(data: string, destination: string) {
    const stream = createWriteStream(destination, { mode: 0o600 });

    try {
      const chunkSize = 1024 * 512; // 512KB
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.slice(offset, offset + chunkSize);
        const buffer = Buffer.from(chunk, 'base64');
        if (!stream.write(buffer)) {
          await once(stream, 'drain');
        }
      }
      stream.end();
      await finished(stream);
    } catch (error) {
      stream.destroy();
      await this.safeRemove(destination);
      throw error;
    }
  }

  private async generateUniquePath(
    directory: string,
    filename: string,
  ): Promise<string> {
    let candidate = join(directory, filename);
    const { name, ext } = parse(filename);
    let attempt = 0;

    while (await this.pathExists(candidate)) {
      attempt += 1;
      const nextName = `${name}-${attempt}${ext}`;
      candidate = join(directory, nextName);
    }

    return candidate;
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await fsPromises.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async safeRemove(target: string) {
    try {
      await fsPromises.rm(target, { force: true });
    } catch (error) {
      this.logger.warn(`Failed to cleanup temporary file ${target}: ${error}`);
    }
  }
}
