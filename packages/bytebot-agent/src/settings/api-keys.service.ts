import { Injectable } from '@nestjs/common';
import { ApiKeyName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfiguredKeyNames(): Promise<ApiKeyName[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: {
        revokedAt: null,
      },
      select: {
        name: true,
        value: true,
      },
    });

    return keys
      .filter((key) => Boolean(key.value))
      .map((key) => key.name);
  }
}
