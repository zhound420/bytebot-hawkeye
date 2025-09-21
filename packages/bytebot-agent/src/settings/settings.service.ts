import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKey } from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApiKeyMetadataMap,
  ApiKeyName,
  SUPPORTED_API_KEYS,
} from './settings.constants';

interface EncryptedValue {
  encrypted: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    let encryptionKey: Buffer;

    try {
      encryptionKey = this.getEncryptionKeyBuffer();
    } catch (error) {
      if (await this.hasPersistedKeys()) {
        this.logger.error(
          'SETTINGS_ENCRYPTION_KEY is not configured. Persisted API keys cannot be loaded.',
        );
      }
      return;
    }

    const storedKeys = await this.prisma.apiKey.findMany();

    for (const record of storedKeys) {
      try {
        const value = this.decryptValue(record, encryptionKey);
        this.configService.set(record.name, value);
      } catch (error) {
        this.logger.error(
          `Failed to decrypt API key ${record.name}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  async getApiKeyMetadata(): Promise<ApiKeyMetadataMap> {
    const records = await this.prisma.apiKey.findMany();
    const recordMap = new Map<ApiKeyName, ApiKey>();

    for (const record of records) {
      if (SUPPORTED_API_KEYS.includes(record.name as ApiKeyName)) {
        recordMap.set(record.name as ApiKeyName, record);
      }
    }

    return SUPPORTED_API_KEYS.reduce<ApiKeyMetadataMap>((acc, key) => {
      const record = recordMap.get(key);

      if (record) {
        acc[key] = {
          configured: true,
          length: record.length,
          lastFour: record.lastFour,
          updatedAt: record.updatedAt.toISOString(),
        };
      } else {
        acc[key] = { configured: false };
      }

      return acc;
    }, {} as ApiKeyMetadataMap);
  }

  async updateApiKeys(
    payload: Partial<Record<ApiKeyName, string>>,
  ): Promise<ApiKeyMetadataMap> {
    const updates: Partial<Record<ApiKeyName, string>> = {};

    for (const key of SUPPORTED_API_KEYS) {
      if (payload[key] !== undefined) {
        updates[key] = payload[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return this.getApiKeyMetadata();
    }

    let encryptionKey: Buffer;
    try {
      encryptionKey = this.getEncryptionKeyBuffer();
    } catch (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException(
        'Encryption key is not configured. Unable to persist API keys.',
      );
    }

    for (const [name, rawValue] of Object.entries(updates) as [
      ApiKeyName,
      string | undefined,
    ][]) {
      if (rawValue === undefined) {
        continue;
      }

      const normalizedValue = rawValue.trim();

      if (!normalizedValue) {
        await this.deleteApiKey(name);
        continue;
      }

      try {
        const encrypted = this.encryptValue(normalizedValue, encryptionKey);
        await this.prisma.apiKey.upsert({
          where: { name },
          create: {
            name,
            encryptedKey: encrypted.encrypted,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            length: normalizedValue.length,
            lastFour: this.getLastFour(normalizedValue),
          },
          update: {
            encryptedKey: encrypted.encrypted,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            length: normalizedValue.length,
            lastFour: this.getLastFour(normalizedValue),
          },
        });
        this.applyConfigValue(name, normalizedValue);
      } catch (error) {
        this.logger.error(
          `Failed to persist API key ${name}: ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Failed to store API keys. Please try again later.',
        );
      }
    }

    return this.getApiKeyMetadata();
  }

  private async deleteApiKey(name: ApiKeyName) {
    try {
      await this.prisma.apiKey.delete({ where: { name } });
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        return;
      }
      throw error;
    } finally {
      this.applyConfigValue(name, undefined);
    }
  }

  private encryptValue(value: string, key: Buffer): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  private decryptValue(record: ApiKey, key: Buffer): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(record.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(record.encryptedKey, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private getEncryptionKeyBuffer(): Buffer {
    const secret = this.configService.get<string>('SETTINGS_ENCRYPTION_KEY');

    if (!secret) {
      throw new Error('SETTINGS_ENCRYPTION_KEY is not configured.');
    }

    return createHash('sha256').update(secret).digest();
  }

  private async hasPersistedKeys(): Promise<boolean> {
    const count = await this.prisma.apiKey.count();
    return count > 0;
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as any).code === 'P2025'
    );
  }

  private getLastFour(value: string): string {
    return value.slice(-4);
  }

  private applyConfigValue(name: ApiKeyName, value: string | undefined) {
    if (value === undefined) {
      delete process.env[name];
      const internalConfig = (this.configService as any).internalConfig;
      if (internalConfig && name in internalConfig) {
        delete internalConfig[name];
      }
      const cache = (this.configService as any).cache;
      if (cache && name in cache) {
        delete cache[name];
      }
      const changes$ = (this.configService as any)._changes$;
      changes$?.next({ path: name, value: undefined });
      return;
    }

    process.env[name] = value;
    const internalConfig = (this.configService as any).internalConfig;
    if (internalConfig) {
      internalConfig[name] = value;
    }
    const cache = (this.configService as any).cache;
    if (cache) {
      cache[name] = value;
    }
    this.configService.set(name, value);
  }
}
