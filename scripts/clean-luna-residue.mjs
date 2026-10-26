/**
 * clean-luna-residue.mjs —— 清掉 Luna 材质/背景里月满庭的残留色值。
 * 实测只有一处是真实声明（--mat-glow），其余是注释说明；注释也一并对齐。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const base = 'W:/Games/Hanako/Work/projects/hana-skin-app/patch/src';
const dirs = ['material-luna', 'background-luna'];

for (const d of dirs) {
  const dir = join(base, d);
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.css')) continue;
    const p = join(dir, name);
    let t = readFileSync(p, 'utf8');
    const before = {
      hex: (t.match(/#172725/gi) || []).length,
      rgb: (t.match(/23,\s*39,\s*37/g) || []).length,
    };
    if (!before.hex && !before.rgb) continue;

    t = t.replace(/#172725/gi, '#141313');
    t = t.replace(/23,\s*39,\s*37/g, '20, 19, 19');

    writeFileSync(p, t, 'utf8');
    const after = {
      hex: (t.match(/#172725/gi) || []).length,
      rgb: (t.match(/23,\s*39,\s*37/g) || []).length,
    };
    console.log(`${d}/${name}: #172725 ${before.hex}->${after.hex}，rgb ${before.rgb}->${after.rgb}`);
  }
}
