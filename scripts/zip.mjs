import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const EXCLUDES = new Set(['.well-known', '.nojekyll', 'bundle-report.html', 'dist.zip']);

const robotsPath = join(distDir, 'robots.txt');
const robotsTxt = readFileSync(robotsPath, 'utf-8');
writeFileSync(robotsPath, robotsTxt.replace(/^Disallow:\s*$/m, 'Disallow: /'));

function addToZip(zip, dir, base) {
  for (const entry of readdirSync(dir)) {
    if (dir === base && EXCLUDES.has(entry)) continue;
    const fullPath = join(dir, entry);
    const relPath = relative(base, fullPath).split('\\').join('/');
    if (statSync(fullPath).isDirectory()) {
      addToZip(zip, fullPath, base);
    } else {
      zip.file(relPath, readFileSync(fullPath));
    }
  }
}

const zip = new JSZip();
addToZip(zip, distDir, distDir);

const buf = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
});
writeFileSync(join(distDir, 'dist.zip'), buf);
