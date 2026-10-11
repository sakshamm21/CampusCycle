/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset'), require('../../packages/shared/src/tailwind-preset.cjs')],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
};
