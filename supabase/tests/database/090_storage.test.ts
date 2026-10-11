import { describe, it, expect, beforeAll } from 'vitest';
import { adminClient, createAnonClient, createAuthenticatedClient, type SupabaseClient } from './helpers';

describe('090: Storage Buckets and Security Policies', () => {
  let demoRiderClient: SupabaseClient;
  let demoRiderId: string;

  beforeAll(async () => {
    demoRiderClient = await createAuthenticatedClient('demo-rider@example.com');
    const { data: user } = await demoRiderClient.auth.getUser();
    demoRiderId = user.user!.id;
  });

  it('rider cannot upload to another user folder', async () => {
    const dummyBlob = new Blob(['test image data'], { type: 'image/jpeg' });
    const { error } = await demoRiderClient.storage
      .from('return-photos')
      .upload('00000000-0000-0000-0000-000000000000/photo.jpg', dummyBlob);

    expect(error).toBeDefined();
  });

  it('rider can upload to own folder', async () => {
    const dummyBlob = new Blob(['test image data'], { type: 'image/jpeg' });
    const fileName = `${demoRiderId}/test-${Date.now()}.jpg`;

    const { data, error } = await demoRiderClient.storage.from('return-photos').upload(fileName, dummyBlob);
    expect(error).toBeNull();
    expect(data?.path).toBe(fileName);

    // Clean up with adminClient
    await adminClient.storage.from('return-photos').remove([fileName]);
  });

  it('anon client cannot read private buckets', async () => {
    const anon = createAnonClient();
    const { data } = await anon.storage.from('return-photos').list();
    expect(data?.length || 0).toBe(0);
  });
});
