import { userDb } from './clients.ts';
import { json } from './http.ts';

export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: json(401, { code: 'CC_NOT_SIGNED_IN', message: 'Sign in to continue.' }),
      user: null,
      userDb: null,
    };
  }
  const client = userDb(authHeader);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    return {
      error: json(401, { code: 'CC_NOT_SIGNED_IN', message: 'Sign in to continue.' }),
      user: null,
      userDb: null,
    };
  }
  return { error: null, user, userDb: client };
}

// Compares every byte whatever the input, so the time taken says nothing about the secret.
function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) {
    diff |= x[i] ^ (y[i % y.length] ?? 0);
  }
  return diff === 0;
}

export function requireInternal(req: Request): Response | null {
  const secret = req.headers.get('x-internal-secret');
  const expected = Deno.env.get('INTERNAL_SECRET');
  if (!secret || !expected || !timingSafeEqual(secret, expected)) {
    return json(401, { code: 'CC_FORBIDDEN', message: 'Invalid internal secret.' });
  }
  return null;
}
