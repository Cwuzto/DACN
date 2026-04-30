const fs = require('fs'); const path = require('path'); const iconv = require('iconv-lite');
const cp1258 = Buffer.alloc(256); for(let i=0; i<256; i++) cp1258[i] = i;
const cp1258Str = iconv.decode(cp1258, 'win1258');
const reverseMap = new Map();
for(let i=0; i<256; i++) {
  const char = cp1258Str[i];
  if (char === '\uFFFD') { reverseMap.set(String.fromCharCode(i), i); }
  else { reverseMap.set(char, i); }
}
function fixString(str) {
  const bytes = [];
  for(let i=0; i<str.length; i++) {
    const char = str[i];
    if (char.charCodeAt(0) < 128) bytes.push(char.charCodeAt(0));
    else {
      if (reverseMap.has(char)) bytes.push(reverseMap.get(char));
      else return str; // Cannot fix
    }
  }
  try {
     return Buffer.from(bytes).toString('utf8');
  } catch(e) { return str; }
}

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
            walk(file);
        } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.md')) {
            const content = fs.readFileSync(file, 'utf8');
            const regex = /([^\x00-\x7F]+)/g;
            let changed = false;
            const newContent = content.replace(regex, (match) => {
               const fixed = fixString(match);
               if (fixed !== match && !fixed.includes('\uFFFD')) {
                   changed = true;
                   return fixed;
               }
               return match;
            });
            if (changed) {
                fs.writeFileSync(file, newContent, 'utf8');
                console.log('Fixed:', file);
            }
        }
    });
}
walk('d:/DACN/frontend/src');
walk('d:/DACN/backend/src');
walk('d:/DACN/.docs');
