const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// SVG template для іконки MOLVIS
const createSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgb(147,51,234);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(219,39,119);stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">M</text>
</svg>
`;

async function generateIcons() {
  const publicDir = path.join(__dirname, '..', 'public');

  // Створюємо іконки
  const sizes = [192, 512];

  for (const size of sizes) {
    const svg = createSVG(size);
    const pngPath = path.join(publicDir, `icon-${size}x${size}.png`);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(pngPath);

    console.log(`✅ Створено: icon-${size}x${size}.png`);
  }

  console.log('🎉 Всі іконки успішно створено!');
}

generateIcons().catch(console.error);
