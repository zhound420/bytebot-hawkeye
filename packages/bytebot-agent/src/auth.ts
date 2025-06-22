import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = process.env.AUTH_ENABLED === 'true' ? betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    'http://localhost:9992',
    'http://localhost:9991',
  ],
}) : null;

// @ts-ignore
export type Session = typeof auth extends null ? null : typeof auth.$Infer.Session;
// @ts-ignore
export type User = typeof auth extends null ? null : typeof auth.$Infer.Session.user;
