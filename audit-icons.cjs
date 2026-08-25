// Audit: find files using <Ionicons> or other icon components without importing them
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, 'PalengkeHubFinal-main');
const ICONS = ['Ionicons', 'MaterialIcons', 'Feather', 'FontAwesome', 'MaterialCommunityIcons', 'AntDesign', 'Entypo'];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'android' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // skip the duplicate src/src tree entirely
      if (p.replace(/\\/g, '/').endsWith('/src/src')) continue;
      walk(p, out);
    } else if (/\.jsx?$/.test(e.name)) {
      out.push(p);
    }
  }
}

const files = [];
walk(path.join(root, 'src'), files);
files.push(path.join(root, 'App.js'));

let problems = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const icon of ICONS) {
    const usedRe = new RegExp('<' + icon + '[\\s/>]');
    if (!usedRe.test(src)) continue;
    const importRe = new RegExp("import[^;]*[{\\s]" + icon + "[\\s,}][^;]*from\\s+['\"]@expo/vector-icons['\"]");
    const anyImport = /@expo\/vector-icons/.test(src);
    if (!importRe.test(src)) {
      console.log((anyImport ? 'PARTIAL-IMPORT? ' : 'MISSING IMPORT! ') + path.relative(root, f).replace(/\\/g, '/') + ' -> uses <' + icon + '> but no matching import');
      problems++;
    }
  }
}
console.log(problems === 0 ? 'ALL OK - every icon component has its import' : ('PROBLEMS: ' + problems));