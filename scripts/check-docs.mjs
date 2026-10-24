import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', '.artifacts', 'dist'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.md$/.test(entry.name)) files.push(full);
  }
}
walk(root);
let links = 0;
for (const file of files) {
  const markdown = readFileSync(file, 'utf8');
  const targets = [
    ...Array.from(markdown.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g), match => match[1]),
    ...Array.from(markdown.matchAll(/(?:src|href)="([^"#]+)"/g), match => match[1]),
  ];
  for (const target of targets) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const local = target.split('#')[0];
    if (!local) continue;
    assert.ok(existsSync(path.resolve(path.dirname(file), decodeURIComponent(local))), `${path.relative(root, file)}: broken link ${target}`);
    links += 1;
  }
}
for (const name of readdirSync('docs/media')) {
  assert.ok(statSync(path.join('docs/media', name)).size < 5 * 1024 * 1024, `Keep README media under 5 MiB: ${name}`);
}
console.log(`Checked ${files.length} Markdown files and ${links} local links. README media size limits passed.`);
