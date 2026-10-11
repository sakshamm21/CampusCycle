#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'apps', 'mobile', 'assets', 'images');

fs.mkdirSync(outDir, { recursive: true });

const PRIMARY_COLOR = '#FFD23F';
const ON_PRIMARY_COLOR = '#16130A';
const BG_COLOR = '#0B0E13';

// Lucide Bike icon paths
function getBikeSvgContent(color = ON_PRIMARY_COLOR, strokeWidth = 2) {
  return `
    <g fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18.5" cy="17.5" r="3.5"/>
      <circle cx="5.5" cy="17.5" r="3.5"/>
      <circle cx="15" cy="5" r="1"/>
      <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
    </g>
  `;
}

// 1. App Icon (1024x1024): background #0B0E13, centered yellow circle (64% width = 655px), black bike
async function makeAppIcon() {
  const size = 1024;
  const circleD = size * 0.64; // ~655
  const circleR = circleD / 2;
  const center = size / 2;
  const glyphSize = circleD * 0.7; // 70% of circle size ~458

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${BG_COLOR}"/>
      <circle cx="${center}" cy="${center}" r="${circleR}" fill="${PRIMARY_COLOR}"/>
      <g transform="translate(${center - glyphSize / 2}, ${center - glyphSize / 2}) scale(${glyphSize / 24})">
        ${getBikeSvgContent(ON_PRIMARY_COLOR, 2)}
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, 'icon.png'));
  console.warn('[icons] Generated icon.png (1024x1024)');
}

// 2. Adaptive Icon Foreground (1024x1024): transparent bg, circle & glyph at 66% safe zone
async function makeAdaptiveIcon() {
  const size = 1024;
  const circleD = size * 0.44; // Fits comfortably in 66% safe area
  const circleR = circleD / 2;
  const center = size / 2;
  const glyphSize = circleD * 0.7;

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${center}" cy="${center}" r="${circleR}" fill="${PRIMARY_COLOR}"/>
      <g transform="translate(${center - glyphSize / 2}, ${center - glyphSize / 2}) scale(${glyphSize / 24})">
        ${getBikeSvgContent(ON_PRIMARY_COLOR, 2)}
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, 'adaptive-icon.png'));
  console.warn('[icons] Generated adaptive-icon.png (1024x1024)');
}

// 3. Splash (1024x1024): background #0B0E13, 200px mark centered
async function makeSplash() {
  const size = 1024;
  const circleD = 200;
  const circleR = 100;
  const center = size / 2;
  const glyphSize = circleD * 0.7; // 140

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${BG_COLOR}"/>
      <circle cx="${center}" cy="${center}" r="${circleR}" fill="${PRIMARY_COLOR}"/>
      <g transform="translate(${center - glyphSize / 2}, ${center - glyphSize / 2}) scale(${glyphSize / 24})">
        ${getBikeSvgContent(ON_PRIMARY_COLOR, 2)}
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, 'splash.png'));
  console.warn('[icons] Generated splash.png (1024x1024)');
}

// 4. Notification Icon (96x96): white bike glyph on transparent
async function makeNotificationIcon() {
  const size = 96;
  const glyphSize = 72;
  const offset = (size - glyphSize) / 2;

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${offset}, ${offset}) scale(${glyphSize / 24})">
        ${getBikeSvgContent('#FFFFFF', 2)}
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, 'notification-icon.png'));
  console.warn('[icons] Generated notification-icon.png (96x96)');
}

async function main() {
  console.warn('[icons] Generating brand icons and splash...');
  await makeAppIcon();
  await makeAdaptiveIcon();
  await makeSplash();
  await makeNotificationIcon();
  console.warn('[icons] All icons generated successfully.');
}

main().catch((err) => {
  console.error('[icons] Error generating icons:', err);
  process.exit(1);
});
