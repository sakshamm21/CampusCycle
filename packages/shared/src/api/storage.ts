import type { CampusClient } from './client.ts';
import { toAppError } from '../errors.ts';

export async function uploadPhoto(
  db: CampusClient,
  bucket: 'id-cards' | 'return-photos' | 'issue-photos' | 'torq-photos',
  userId: string,
  body: Blob | ArrayBuffer,
  contentType = 'image/jpeg',
): Promise<string> {
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await db.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: false,
  });

  if (error) throw toAppError(error);

  return path;
}
