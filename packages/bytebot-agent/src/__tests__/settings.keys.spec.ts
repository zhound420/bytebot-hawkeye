import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID, webcrypto } from 'crypto';
import * as supertest from 'supertest';
import { SettingsModule } from '../settings/settings.module';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyName, SUPPORTED_API_KEYS } from '../settings/settings.constants';

type ApiKeyRecord = {
  id: string;
  name: ApiKeyName;
  encryptedKey: string;
  iv: string;
  authTag: string;
  length: number;
  lastFour: string;
  createdAt: Date;
  updatedAt: Date;
};

class InMemoryPrismaService {
  private readonly records = new Map<ApiKeyName, ApiKeyRecord>();

  apiKey = {
    findMany: async (): Promise<ApiKeyRecord[]> =>
      Array.from(this.records.values()),
    count: async (): Promise<number> => this.records.size,
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { name: ApiKeyName };
      create: Omit<ApiKeyRecord, 'id' | 'createdAt' | 'updatedAt'>;
      update: Partial<Omit<ApiKeyRecord, 'id' | 'name' | 'createdAt'>>;
    }): Promise<ApiKeyRecord> => {
      const existing = this.records.get(where.name);
      const now = new Date();

      if (existing) {
        const next: ApiKeyRecord = {
          ...existing,
          ...update,
          updatedAt: now,
        } as ApiKeyRecord;
        this.records.set(where.name, next);
        return next;
      }

      const created: ApiKeyRecord = {
        id: randomUUID(),
        name: where.name,
        encryptedKey: create.encryptedKey,
        iv: create.iv,
        authTag: create.authTag,
        length: create.length,
        lastFour: create.lastFour,
        createdAt: now,
        updatedAt: now,
      };

      this.records.set(where.name, created);
      return created;
    },
    delete: async ({
      where,
    }: {
      where: { name: ApiKeyName };
    }): Promise<ApiKeyRecord> => {
      const existing = this.records.get(where.name);
      if (!existing) {
        const error = new Error('Record not found') as Error & {
          code?: string;
        };
        error.code = 'P2025';
        throw error;
      }
      this.records.delete(where.name);
      return existing;
    },
  };

  getRecord(name: ApiKeyName): ApiKeyRecord | undefined {
    return this.records.get(name);
  }
}

describe('SettingsController (integration)', () => {
  let app: INestApplication;
  let prisma: InMemoryPrismaService;
  let configService: ConfigService;

  beforeAll(async () => {
    // Ensure crypto global exists for Nest schedule dependencies during tests
    if (!globalThis.crypto) {
      globalThis.crypto = webcrypto as any;
    }

    process.env.SETTINGS_ENCRYPTION_KEY = 'test-secret-key';

    prisma = new InMemoryPrismaService();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
        }),
        SettingsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    configService = moduleRef.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns metadata for all supported keys when none are configured', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/settings/keys')
      .expect(200);

    expect(response.body).toEqual({
      keys: SUPPORTED_API_KEYS.reduce(
        (acc, key) => ({
          ...acc,
          [key]: { configured: false },
        }),
        {},
      ),
    });
  });

  it('persists provided keys, masks values, and refreshes config service', async () => {
    const payload = {
      ANTHROPIC_API_KEY: 'sk-anthropic-1234567890',
      OPENAI_API_KEY: 'sk-openai-0987654321',
    };

    const postResponse = await supertest(app.getHttpServer())
      .post('/settings/keys')
      .send(payload)
      .expect(200);

    const keys = postResponse.body.keys;

    expect(keys.ANTHROPIC_API_KEY).toMatchObject({
      configured: true,
      length: payload.ANTHROPIC_API_KEY.length,
      lastFour: payload.ANTHROPIC_API_KEY.slice(-4),
    });
    expect(typeof keys.ANTHROPIC_API_KEY.updatedAt).toBe('string');

    expect(keys.OPENAI_API_KEY).toMatchObject({
      configured: true,
      length: payload.OPENAI_API_KEY.length,
      lastFour: payload.OPENAI_API_KEY.slice(-4),
    });

    const storedAnthropic = prisma.getRecord('ANTHROPIC_API_KEY');
    expect(storedAnthropic).toBeDefined();
    expect(storedAnthropic?.encryptedKey).not.toEqual(
      payload.ANTHROPIC_API_KEY,
    );
    expect(storedAnthropic?.lastFour).toBe(payload.ANTHROPIC_API_KEY.slice(-4));

    expect(configService.get('ANTHROPIC_API_KEY')).toBe(
      payload.ANTHROPIC_API_KEY,
    );
    expect(configService.get('OPENAI_API_KEY')).toBe(payload.OPENAI_API_KEY);

    const getResponse = await supertest(app.getHttpServer())
      .get('/settings/keys')
      .expect(200);

    expect(getResponse.body.keys.ANTHROPIC_API_KEY).toMatchObject({
      configured: true,
      lastFour: payload.ANTHROPIC_API_KEY.slice(-4),
    });
  });

  it('updates keys in place and removes secrets when an empty value is provided', async () => {
    const updatedAnthropicKey = 'sk-anthropic-updated-5555';

    await supertest(app.getHttpServer())
      .post('/settings/keys')
      .send({ ANTHROPIC_API_KEY: updatedAnthropicKey })
      .expect(200);

    const record = prisma.getRecord('ANTHROPIC_API_KEY');
    expect(record?.lastFour).toBe(updatedAnthropicKey.slice(-4));
    expect(configService.get('ANTHROPIC_API_KEY')).toBe(updatedAnthropicKey);

    await supertest(app.getHttpServer())
      .post('/settings/keys')
      .send({ OPENAI_API_KEY: '' })
      .expect(200);

    expect(prisma.getRecord('OPENAI_API_KEY')).toBeUndefined();
    expect(configService.get('OPENAI_API_KEY')).toBeUndefined();
  });
});
