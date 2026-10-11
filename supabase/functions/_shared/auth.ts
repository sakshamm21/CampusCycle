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

export function requireInternal(req: Request): Response | null {
  const secret = req.headers.get('x-internal-secret');
  const expected = Deno.env.get('INTERNAL_SECRET');
  if (!secret || !expected || secret !== expected) {
    return json(401, { code: 'CC_FORBIDDEN', message: 'Invalid internal secret.' });
  }
  return null;
}
