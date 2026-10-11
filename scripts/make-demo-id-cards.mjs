import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const applicants = [
  { file: 'applicant01.png', name: 'Ishaan Gupta', roll: '240201' },
  { file: 'applicant02.png', name: 'Meera Iyer', roll: '240202' },
  { file: 'applicant03.png', name: 'Kabir Singh', roll: '240203' },
  { file: 'applicant04.png', name: 'Rohit Verma', roll: '240204' }, // card name intentionally Rohit vs typed Rohan
];

const outDir = path.resolve('supabase/seed/assets/id-cards');
fs.mkdirSync(outDir, { recursive: true });

function generateCardSvg(applicant) {
  return `<svg width="1000" height="630" viewBox="0 0 1000 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Card Background -->
  <rect x="0" y="0" width="1000" height="630" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
  
  <!-- Header Bar -->
  <rect x="0" y="0" width="1000" height="70" rx="24" fill="#475569"/>
  <rect x="0" y="46" width="1000" height="24" fill="#475569"/>
  <text x="500" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="2">
    SAMPLE STUDENT ID · NOT A REAL CARD
  </text>
  
  <!-- Sub Header / College Name -->
  <text x="500" y="115" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="800" fill="#0f172a" text-anchor="middle" letter-spacing="1">
    INDIAN INSTITUTE OF TECHNOLOGY KANPUR
  </text>
  <line x1="80" y1="135" x2="920" y2="135" stroke="#e2e8f0" stroke-width="2"/>
  
  <!-- Photo placeholder -->
  <rect x="90" y="170" width="240" height="300" rx="16" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="210" cy="280" r="50" fill="#94a3b8"/>
  <path d="M 130 430 A 80 60 0 0 1 290 430 Z" fill="#94a3b8"/>
  <text x="210" y="490" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="#64748b" text-anchor="middle">STUDENT PHOTO</text>
  
  <!-- Fields -->
  <g transform="translate(390, 190)" font-family="system-ui, -apple-system, sans-serif">
    <!-- Name -->
    <text x="0" y="30" font-size="18" font-weight="600" fill="#64748b" text-transform="uppercase">Name</text>
    <text x="0" y="70" font-size="34" font-weight="800" fill="#0f172a">${applicant.name}</text>
    
    <!-- Roll No -->
    <text x="0" y="125" font-size="18" font-weight="600" fill="#64748b" text-transform="uppercase">Roll No</text>
    <text x="0" y="160" font-size="28" font-weight="700" fill="#1e293b">${applicant.roll}</text>
    
    <!-- Programme -->
    <text x="0" y="215" font-size="18" font-weight="600" fill="#64748b" text-transform="uppercase">Programme</text>
    <text x="0" y="250" font-size="26" font-weight="700" fill="#1e293b">B.Tech</text>
    
    <!-- Institute -->
    <text x="0" y="305" font-size="18" font-weight="600" fill="#64748b" text-transform="uppercase">Institute</text>
    <text x="0" y="340" font-size="26" font-weight="700" fill="#1e293b">IIT Kanpur</text>
  </g>
  
  <!-- Footer Bar -->
  <rect x="0" y="580" width="1000" height="50" rx="0" fill="#f8fafc"/>
  <text x="500" y="612" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#94a3b8" text-anchor="middle">
    ACADEMIC YEAR 2026-2027 · OFFICE OF THE DEAN OF ACADEMIC AFFAIRS
  </text>
  
  <!-- Diagonal Watermark at 12% opacity -->
  <text x="500" y="350" font-family="system-ui, sans-serif" font-size="160" font-weight="900" fill="#000000" opacity="0.12" text-anchor="middle" transform="rotate(-30, 500, 350)">
    SAMPLE
  </text>
</svg>`;
}

async function main() {
  for (const app of applicants) {
    const svg = generateCardSvg(app);
    const dest = path.join(outDir, app.file);
    await sharp(Buffer.from(svg)).png().toFile(dest);
    console.log(`Generated: ${dest}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
