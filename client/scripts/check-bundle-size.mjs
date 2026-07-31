import { readFile, readdir, stat } from 'node:fs/promises';
const assetsDirectory = new URL('../dist/assets/', import.meta.url);
const [indexHtml, headersFile] = await Promise.all([
  readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../dist/_headers', import.meta.url), 'utf8'),
]);
const normalizedHeaders = headersFile.replace(/\r\n/g, '\n');
const entryCacheRule = [
  '/assets/app.js',
  '  ! Cache-Control',
  '  Cache-Control: no-cache, must-revalidate',
].join('\n');

if (!indexHtml.includes('src="/assets/app.js"')) {
  throw new Error('Production entry must use the stable /assets/app.js path');
}
if (!normalizedHeaders.includes(entryCacheRule)) {
  throw new Error('/assets/app.js must be revalidated after every deployment');
}
const maxChunkBytes = 300 * 1024;
const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith('.js'));
const sizes = await Promise.all(files.map(async (file) => ({
  file,
  bytes: (await stat(new URL(file, assetsDirectory))).size,
})));
sizes.sort((left, right) => right.bytes - left.bytes);
const oversized = sizes.filter((item) => item.bytes > maxChunkBytes);
const largest = sizes[0];

if (largest) {
  console.log(`Largest JavaScript chunk: ${largest.file} (${(largest.bytes / 1024).toFixed(2)} KiB)`);
}
if (oversized.length > 0) {
  for (const item of oversized) {
    console.error(`Bundle chunk exceeds 300 KiB: ${item.file} (${(item.bytes / 1024).toFixed(2)} KiB)`);
  }
  process.exit(1);
}
