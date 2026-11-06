import { build } from 'vite';
import { cp, readFile, writeFile } from 'node:fs/promises';
await build({ configFile: 'vite.shanhai.config.js' });
await cp('public/shanhai', 'dist-shanhai/shanhai', { recursive: true });
await cp('public/icon.svg', 'dist-shanhai/icon.svg');
const html=(await readFile('dist-shanhai/shanhai.html','utf8')).replace(/<a class="legacy-link"[^>]*>.*?<\/a>/,'');
await writeFile('dist-shanhai/shanhai.html',html);await writeFile('dist-shanhai/index.html',html);
console.log('Built an isolated coastal chapter. No legacy binary artwork was copied.');
