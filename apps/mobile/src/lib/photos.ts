import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  AppError,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_EDGE_PX,
  uploadPhoto,
  type CampusClient,
} from '@campuscycle/shared';

export interface LocalPhoto {
  uri: string;
  width: number;
  height: number;
}

export type PhotoBucket = Parameters<typeof uploadPhoto>[1];

const UPLOAD_TIMEOUT_MS = 20_000;

/** Long edge down to 1080 px, JPEG quality 0.6 (04 §1.7). */
export async function compressPhoto(photo: LocalPhoto): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const longEdge = Math.max(photo.width, photo.height);
  if (longEdge > PHOTO_MAX_EDGE_PX) {
    context.resize(
      photo.width >= photo.height ? { width: PHOTO_MAX_EDGE_PX } : { height: PHOTO_MAX_EDGE_PX },
    );
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: PHOTO_JPEG_QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
}

/** Uploads an already compressed local file and returns its storage path. */
export async function uploadLocalPhoto(
  db: CampusClient,
  bucket: PhotoBucket,
  userId: string,
  uri: string,
): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError('CC_UPLOAD_FAILED')), UPLOAD_TIMEOUT_MS);
  });
  try {
    const upload = (async () => {
      const body = await (await fetch(uri)).arrayBuffer();
      return uploadPhoto(db, bucket, userId, body);
    })();
    return await Promise.race([upload, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
