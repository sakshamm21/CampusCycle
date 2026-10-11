import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createAnonClient,
  createWorld,
  demoSession,
  type SupabaseClient,
  type TestUser,
  type World,
} from './helpers';

const BUCKETS = ['id-cards', 'return-photos', 'issue-photos', 'torq-photos'];
const jpeg = () => new Blob(['not really a jpeg'], { type: 'image/jpeg' });

describe('090: Storage Buckets and Security Policies', () => {
  let world: World;
  let rider: TestUser;
  let other: TestUser;
  let path: string;

  const canRead = async (client: SupabaseClient, bucket = 'return-photos') =>
    (await client.storage.from(bucket).download(path)).error === null;

  beforeAll(async () => {
    world = await createWorld({ riders: 2, bikes: 1 });
    [rider, other] = world.riders;
    path = `${rider.id}/test-${Date.now()}.jpg`;
  });

  afterAll(async () => {
    for (const bucket of BUCKETS) {
      const { data } = await adminClient.storage.from(bucket).list(rider.id);
      if (data?.length)
        await adminClient.storage.from(bucket).remove(data.map((f) => `${rider.id}/${f.name}`));
    }
    await world?.destroy();
  });

  it('lets a rider upload into their own folder of every bucket', async () => {
    for (const bucket of BUCKETS) {
      const { data, error } = await rider.client.storage.from(bucket).upload(path, jpeg());
      expect(error, bucket).toBeNull();
      expect(data?.path, bucket).toBe(path);
    }
  });

  it("refuses an upload into someone else's folder", async () => {
    const theirs = `${other.id}/planted-${Date.now()}.jpg`;
    for (const bucket of BUCKETS) {
      const { error } = await rider.client.storage.from(bucket).upload(theirs, jpeg());
      expect(error, bucket).not.toBeNull();
    }
    const { data } = await adminClient.storage.from('return-photos').list(other.id);
    expect(data).toEqual([]);
  });

  it('refuses a file type the bucket does not allow', async () => {
    const { error } = await rider.client.storage
      .from('return-photos')
      .upload(`${rider.id}/notes.txt`, new Blob(['hello'], { type: 'text/plain' }));
    expect(error).not.toBeNull();
  });

  it('lets the rider and the admins of their college read the photo, and nobody else', async () => {
    expect(await canRead(rider.client)).toBe(true);
    expect(await canRead(world.admin.client)).toBe(true);

    expect(await canRead(other.client)).toBe(false);
    expect(await canRead((await demoSession('admin')).client)).toBe(false);
    expect(await canRead((await demoSession('rider')).client)).toBe(false);
  });

  it('keeps TORQ chat photos private to the rider, even from their admin', async () => {
    expect(await canRead(rider.client, 'torq-photos')).toBe(true);
    expect(await canRead(world.admin.client, 'torq-photos')).toBe(false);
  });

  it('gives anon nothing from any bucket', async () => {
    const anon = createAnonClient();
    for (const bucket of BUCKETS) {
      expect(await canRead(anon, bucket), bucket).toBe(false);
      const { data } = await anon.storage.from(bucket).list(rider.id);
      expect(data ?? [], bucket).toEqual([]);
      const { error } = await anon.storage.from(bucket).upload(`${rider.id}/anon.jpg`, jpeg());
      expect(error, bucket).not.toBeNull();
    }
  });

  it('lets no client replace or delete a stored photo', async () => {
    const replaced = await rider.client.storage.from('return-photos').upload(path, jpeg(), { upsert: true });
    expect(replaced.error).not.toBeNull();

    await rider.client.storage.from('return-photos').remove([path]);
    await world.admin.client.storage.from('return-photos').remove([path]);
    expect(await canRead(rider.client)).toBe(true);
  });
});
