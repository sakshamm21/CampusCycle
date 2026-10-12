import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { en } from '@campuscycle/shared';

/**
 * Shares the ride receipt (04 R15). Native: a 1080 px wide PNG of the pass and receipt.
 * Web: the share sheet when the browser has one, else the text goes to the clipboard.
 */
export async function shareReceipt(
  block: RefObject<View | null>,
  text: string,
): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text });
        return 'shared';
      }
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
    const uri = await captureRef(block, { format: 'png', width: 1080, result: 'tmpfile' });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: en.r15.share });
    return 'shared';
  } catch (e) {
    // Closing the share sheet rejects too; neither case needs a message.
    console.warn('[share] not shared', e);
    return 'failed';
  }
}
