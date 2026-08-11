import { promises as fs } from 'node:fs';
import path from 'node:path';

const publicRoot = path.resolve('public');
const output = path.join(publicRoot, 'offline-assets.json');

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    if (absolute === output || entry.name === 'sw.js') return [];
    return [`/${path.relative(publicRoot, absolute).replaceAll('\\', '/')}`];
  }));
  return nested.flat();
}

const assets = (await walk(publicRoot)).sort();
await fs.writeFile(output, `${JSON.stringify({ version: 5, assets }, null, 2)}\n`, 'utf8');
console.log(`Generated offline manifest with ${assets.length} assets.`);
