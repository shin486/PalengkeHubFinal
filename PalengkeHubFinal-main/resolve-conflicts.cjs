// Resolves git merge conflict markers by keeping the "Updated upstream" side.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const SKIP_DIRS = new Set(['node_modules', '.expo', 'dist', 'build', '.git', 'src.zip']);

let count = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!['.js', '.jsx', '.ts', '.tsx', '.json', '.mjs', '.cjs'].includes(ext)) continue;
      let content = fs.readFileSync(full, 'utf8');
      if (!content.includes('<<<<<<<')) continue;
      // Detect dominant line ending
      const crlf = content.includes('\r\n');
      const lines = content.split(/\r?\n/);
      const out = [];
      let state = 'keep'; // keep | theirs
      for (const line of lines) {
        if (/^<<<<<<< /.test(line) || line === '<<<<<<<') { state = 'ours'; continue; }
        if (/^=======$/.test(line)) { state = 'theirs'; continue; }
        if (/^>>>>>>> /.test(line) || line === '>>>>>>>') { state = 'keep'; continue; }
        if (state === 'theirs') continue;
        out.push(line);
      }
      const resolved = out.join(crlf ? '\r\n' : '\n');
      fs.writeFileSync(full, resolved, 'utf8');
      count++;
      console.log('resolved:', path.relative(ROOT, full));
    }
  }
}

walk(ROOT);
console.log(`\nTotal files resolved: ${count}`);
