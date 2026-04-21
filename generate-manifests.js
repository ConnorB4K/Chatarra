/**
 * CHATARRA — Manifest Generator
 * Scans sticker and audio folders and generates manifest.json files.
 * Run: node generate-manifests.js
 */

const fs = require('fs');
const path = require('path');

function generateManifest(dir, extensions) {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(fullPath)
    .filter(f => {
      const ext = path.extname(f).toLowerCase();
      return extensions.includes(ext) && f !== 'manifest.json' && f !== 'placeholder.txt';
    })
    .sort();

  const manifestPath = path.join(fullPath, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2));
  console.log(`Generated ${manifestPath} (${files.length} files)`);
}

generateManifest('assets/stickers', ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg']);
generateManifest('assets/audio', ['.mp3', '.wav', '.ogg', '.m4a']);

console.log('\nDone! Commit the generated manifest.json files to your repo.');
