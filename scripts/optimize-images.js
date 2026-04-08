const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.resolve(__dirname, '../public');
const optimizedDir = path.resolve(__dirname, '../public/optimized');

if (!fs.existsSync(optimizedDir)) {
  fs.mkdirSync(optimizedDir);
}

fs.readdir(imagesDir, (err, files) => {
  if (err) {
    console.error('Error reading images directory:', err);
    return;
  }

  files.forEach(file => {
    const filePath = path.join(imagesDir, file);
    const outputFilePath = path.join(optimizedDir, file);
    const ext = path.extname(file).toLowerCase();

    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      sharp(filePath)
        .resize({ width: 1200, withoutEnlargement: true })
        .toFormat('webp', { quality: 80 })
        .toFile(outputFilePath, (err, info) => {
          if (err) {
            console.error(`Error optimizing ${file}:`, err);
          } else {
            console.log(`Optimized ${file}:`, info);
          }
        });
    }
  });
});
