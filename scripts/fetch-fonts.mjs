#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'apps', 'mobile', 'assets', 'fonts');
const adminOutDir = path.join(rootDir, 'apps', 'admin', 'public', 'fonts');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(adminOutDir, { recursive: true });

const FONTS = [
  { family: 'Archivo:wdth,wght@125,900', file: 'ArchivoExpanded-Black.ttf' },
  { family: 'Archivo:wdth,wght@125,800', file: 'ArchivoExpanded-ExtraBold.ttf' },
  { family: 'Archivo:wdth,wght@75,900', file: 'ArchivoCondensed-Black.ttf' },
  { family: 'Fraunces:ital,wght@1,400', file: 'Fraunces-Italic.ttf' },
  { family: 'Figtree:wght@400', file: 'Figtree-Regular.ttf' },
  { family: 'Figtree:wght@500', file: 'Figtree-Medium.ttf' },
  { family: 'Figtree:wght@600', file: 'Figtree-SemiBold.ttf' },
  { family: 'Figtree:wght@700', file: 'Figtree-Bold.ttf' },
  { family: 'Martian+Mono:wght@400', file: 'MartianMono-Regular.ttf' },
  { family: 'Martian+Mono:wght@500', file: 'MartianMono-Medium.ttf' },
  { family: 'Martian+Mono:wght@700', file: 'MartianMono-Bold.ttf' },
];

// An old Android browser: Google Fonts answers it with one static TrueType file per request.
// (The MSIE 8 agent gets EOT files, which neither Android nor a modern browser can load.)
const USER_AGENT =
  'Mozilla/5.0 (Linux; U; Android 4.0.3; en-us) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30';

// TrueType starts with 00 01 00 00 (or the tag true); OpenType with OTTO.
function isSfnt(buffer) {
  const tag = buffer.subarray(0, 4).toString('latin1');
  return buffer.readUInt32BE(0) === 0x00010000 || tag === 'true' || tag === 'OTTO';
}

async function downloadFont(item) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${item.family}`;
  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!cssRes.ok) {
    throw new Error(`Failed to fetch CSS for ${item.family}: ${cssRes.statusText}`);
  }

  const cssText = await cssRes.text();

  // Find font-face blocks
  const blocks = cssText.split('@font-face');
  let chosenUrl = null;

  for (const block of blocks) {
    if (!block.includes('src:')) continue;
    const urlMatch = block.match(/url\((https:\/\/[^)]+)\)/);
    if (!urlMatch || !urlMatch[1]) continue;

    if (block.includes('U+0000-00FF') || !chosenUrl) {
      chosenUrl = urlMatch[1];
    }
  }

  if (!chosenUrl) {
    throw new Error(`No font URL found in CSS for ${item.family}`);
  }

  const fontRes = await fetch(chosenUrl);
  if (!fontRes.ok) {
    throw new Error(`Failed to download font file from ${chosenUrl}: ${fontRes.statusText}`);
  }

  const arrayBuffer = await fontRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!isSfnt(buffer)) {
    throw new Error(`${item.file}: the download is not a TrueType or OpenType font`);
  }
  const targetPath = path.join(outDir, item.file);
  fs.writeFileSync(targetPath, buffer);
  const adminTargetPath = path.join(adminOutDir, item.file);
  fs.writeFileSync(adminTargetPath, buffer);
  console.warn(`[fonts] Downloaded ${item.file} (${buffer.length} bytes)`);
}

async function main() {
  console.warn('[fonts] Fetching Google Fonts static TTFs for mobile...');
  for (const item of FONTS) {
    await downloadFont(item);
  }
  console.warn('[fonts] All fonts downloaded successfully.');
}

main().catch((err) => {
  console.error('[fonts] Error downloading fonts:', err);
  process.exit(1);
});
