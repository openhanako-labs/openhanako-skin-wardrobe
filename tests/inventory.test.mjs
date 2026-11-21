/**
 * tests/inventory.test.mjs — 主题清单（跨 App 服务 list-themes 的数据层）单测。
 *
 * 覆盖：单套/双套拆分、名字、明暗、强调色与底色、enabled 的三种状态
 * （true / false / null=读不到宿主）、current 只落一条、坏包不拖累整张表。
 * 不启动宿主，直接 import assets/lib/inventory.js（纯函数，零 IO）。
 *
 * 用法：node tests/inventory.test.mjs
 */
import { buildThemeInventory } from '../skin-wardrobe/assets/lib/inventory.js';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const singlePack = (packId, name, appearance, colors) => ({
  packId,
  pack: { packId, names: { zh: name }, theme: { appearance, colors } },
});

const dualPack = (packId, name, darkColors, lightColors) => ({
  packId,
  pack: {
    packId,
    names: { zh: name },
    theme: {
      variants: [
        { appearance: 'dark', colors: darkColors },
        { appearance: 'light', colors: lightColors },
      ],
    },
  },
});

const colors = (bg, accent) => ({ '--bg': bg, '--bg-card': bg, '--text': '#EDEDED', '--accent': accent });

/* 1. 单套包 */
{
  const inv = buildThemeInventory({
    packs: [singlePack('demo', '示例皮肤', 'dark', colors('#141313', '#cd5b85'))],
    hostThemeIds: new Set(['hana-demo']),
    currentTheme: 'hana-demo',
  });
  check('单套：一条', inv.themes.length === 1, String(inv.themes.length));
  const t = inv.themes[0];
  check('单套：id 不带后缀', t.id === 'hana-demo', t.id);
  check('单套：名字取包里的中文名', t.name === '示例皮肤', t.name);
  check('单套：明暗', t.appearance === 'dark', t.appearance);
  check('单套：强调色', t.accent === '#cd5b85', t.accent);
  check('单套：底色', t.bg === '#141313', t.bg);
  check('单套：已装（注册表里有）', t.enabled === true, String(t.enabled));
  check('单套：标为当前主题', t.current === true, String(t.current));
  check('单套：带整套配色', t.colors && t.colors['--accent'] === '#cd5b85', t.colors && t.colors['--accent']);
}

/* 2. 双套包拆两条 */
{
  const inv = buildThemeInventory({
    packs: [dualPack('dual', '双生', colors('#101010', '#111111'), colors('#fafafa', '#222222'))],
    hostThemeIds: new Set(['hana-dual-dark']),
    currentTheme: null,
  });
  check('双套：拆成两条', inv.themes.length === 2, String(inv.themes.length));
  const ids = inv.themes.map((t) => t.id).sort();
  check('双套：id 带 -dark/-light', ids.join(',') === 'hana-dual-dark,hana-dual-light', ids.join(','));
  const light = inv.themes.find((t) => t.id === 'hana-dual-light');
  check('双套：名字带明暗后缀', light.name === '双生 · 亮色', light.name);
  check('双套：light 的 enabled=false（注册表里没有）', light.enabled === false, String(light.enabled));
  const dark = inv.themes.find((t) => t.id === 'hana-dual-dark');
  check('双套：dark 的 enabled=true', dark.enabled === true, String(dark.enabled));
  check('双套：current 只落一条或零条', inv.themes.filter((t) => t.current).length === 0);
}

/* 3. 读不到宿主：enabled 必须是 null，不能谎报「没装」 */
{
  const inv = buildThemeInventory({
    packs: [singlePack('demo', '示例皮肤', 'light', colors('#ffffff', '#333333'))],
    hostThemeIds: null,
    currentTheme: null,
  });
  check('读不到注册表：enabled 为 null', inv.themes[0].enabled === null, String(inv.themes[0].enabled));
  check('读不到注册表：current 为 null', inv.current === null, String(inv.current));
}

/* 4. 坏包不拖累整张表 */
{
  const inv = buildThemeInventory({
    packs: [
      singlePack('ok1', '好的', 'dark', colors('#111111', '#222222')),
      { packId: 'broken', pack: null },
      singlePack('ok2', '也好', 'light', colors('#fafafa', '#333333')),
    ],
    hostThemeIds: new Set(),
    currentTheme: null,
  });
  check('坏包被跳过，其余照常', inv.themes.length === 2, String(inv.themes.length));
  check('缺配色的包不会产出半套', inv.themes.every((t) => t.accent && t.bg), '');
}

/* 5. 排序稳定：按 packId 再按 id */
{
  const inv = buildThemeInventory({
    packs: [
      singlePack('zeta', 'Z', 'dark', colors('#111111', '#222222')),
      singlePack('alpha', 'A', 'dark', colors('#111111', '#222222')),
    ],
    hostThemeIds: null,
    currentTheme: null,
  });
  check('排序：按 packId 升序', inv.themes[0].packId === 'alpha', inv.themes[0].packId);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
