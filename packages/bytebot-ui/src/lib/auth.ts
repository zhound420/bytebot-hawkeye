import { createAuthClient } from 'better-auth/react';

const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';

export const authClient = authEnabled ? createAuthClient() : null;

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient || {
  signIn: () => Promise.resolve(null),
  signUp: () => Promise.resolve(null),
  signOut: () => Promise.resolve(null),
  useSession: () => ({ data: null, isPending: false, error: null }),
  getSession: () => Promise.resolve(null),
};
