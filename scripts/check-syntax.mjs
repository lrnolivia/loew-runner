import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
// node --check takes one file; shell globs previously left subsequent files unchecked.
for (const folder of ['src','scripts','dashboard']) {
  for (const file of await fs.readdir(folder)) {
    if (!/\.(mjs|js)$/.test(file)) continue;
    const check=spawnSync(process.execPath,['--check',`${folder}/${file}`],{stdio:'inherit'});
    if(check.status!==0)process.exit(check.status || 1);
  }
}
