/** @type {import('tailwindcss').Config} */
module.exports = {
  // The theme is chosen in the app (System / Dark / Day), so NativeWind must not follow the media query.
  darkMode: 'class',
  presets: [require('nativewind/preset'), require('../../packages/shared/src/tailwind-preset.cjs')],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
};
