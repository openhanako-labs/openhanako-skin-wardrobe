/**
 * scripts/gen-prebuilt.mjs —— 生成预装主题包
 * 从 prebuilt 图 + 预设配色，派生完整 61 变量，产出可直接入库的 pack JSON。
 * 产物：skin-wardrobe/assets/prebuilt/packs/<packId>.skinpack.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRE = join(ROOT, 'skin-wardrobe', 'ui', 'assets', 'prebuilt');

/* ── 与 panel.js 相同的基线与派生 ── */
const BASE_COLORS = {
  '--bg': '#141313', '--bg-card': '#1E1D1E', '--bg-glass': '#1E1D1EEB', '--sidebar-bg': '#191719',
  '--accent': '#CD5B85', '--accent-hover': '#DA84A4', '--accent-light': '#CD5B8526',
  '--link': '#E4A3C3', '--link-hover': '#F0C1D7', '--text': '#F0EFF0', '--text-light': '#D0CAD1',
  '--text-muted': '#AAA2AD', '--hana-text': '#F0EFF0', '--border': '#B896C138', '--shadow': '#00000070',
  '--green': '#9DCCAC', '--coral': '#DFB0A1', '--danger': '#F09AAB',
  '--jian-note-bg': '#262127', '--jian-note-border': '#B896C140',
  '--mood-bg': '#B896C112', '--mood-text': '#C8ACD1', '--mood-border': '#B896C133',
  '--tool-bg': '#B896C10D', '--tool-text': '#C5BDC9', '--user-bg': '#CD5B851F',
  '--drop-overlay-bg': '#141313E8', '--attach-bg': '#FFFFFF0D',
  '--overlay-subtle': '#FFFFFF06', '--overlay-light': '#FFFFFF0D', '--overlay-medium': '#FFFFFF17',
  '--overlay-strong': '#B896C133', '--tab-slider-bg': '#B896C125',
  '--term-bg': '#191719', '--term-fg': '#E5DFE7', '--term-cursor': '#DA84A4', '--term-cursor-accent': '#141313',
  '--term-selection-bg': '#CD5B8540',
  '--term-ansi-black': '#353039', '--term-ansi-red': '#E78FA4', '--term-ansi-green': '#9DCCAC',
  '--term-ansi-yellow': '#DBC295', '--term-ansi-blue': '#A6B9E2', '--term-ansi-magenta': '#C1A0D4',
  '--term-ansi-cyan': '#9CCAD0', '--term-ansi-white': '#D0CAD1',
  '--term-ansi-bright-black': '#AAA2AD', '--term-ansi-bright-red': '#F7B0C0', '--term-ansi-bright-green': '#BAE2C8',
  '--term-ansi-bright-yellow': '#EED9B2', '--term-ansi-bright-blue': '#C2D0F2', '--term-ansi-bright-magenta': '#DAC0EA',
  '--term-ansi-bright-cyan': '#BCE4E9', '--term-ansi-bright-white': '#F5F0F6',
  '--radius-input': '18px', '--radius-card': '18px', '--radius-chat-card': '16px', '--radius-chat-surface': '20px',
  '--font-ui': 'Segoe UI, Microsoft YaHei UI, Microsoft YaHei, sans-serif',
  '--font-serif': 'Noto Serif SC, Source Han Serif SC, serif',
  '--font-mono': 'Cascadia Code, Consolas, monospace',
};
const hex2rgb = (h) => { const m = /^#([0-9a-f]{6})$/i.exec(h || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [20, 19, 19]; };
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (h, amt) => toHex(hex2rgb(h).map((v) => v + (amt > 0 ? (255 - v) * amt : v * amt)));
const luminance = (h) => { const [r, g, b] = hex2rgb(h).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

function deriveColors({ bg, card, accent, text }) {
  const isLight = luminance(bg) > 0.5;
  const out = { ...BASE_COLORS };
  out['--bg'] = bg; out['--sidebar-bg'] = bg; out['--term-bg'] = bg;
  out['--drop-overlay-bg'] = bg.toUpperCase() + 'E8';
  out['--bg-card'] = card; out['--bg-glass'] = card.toUpperCase() + (isLight ? 'F2' : 'EB');
  out['--accent'] = accent;
  out['--accent-hover'] = isLight ? shade(accent, -0.15) : shade(accent, 0.18);
  out['--accent-light'] = accent.toUpperCase() + (isLight ? '1A' : '26');
  out['--link'] = isLight ? shade(accent, -0.12) : shade(accent, 0.28);
  out['--link-hover'] = isLight ? shade(accent, -0.24) : shade(accent, 0.42);
  out['--user-bg'] = accent.toUpperCase() + (isLight ? '14' : '1F');
  out['--tab-slider-bg'] = accent.toUpperCase() + (isLight ? '1A' : '25');
  out['--term-cursor'] = out['--accent-hover'];
  out['--term-selection-bg'] = accent.toUpperCase() + (isLight ? '30' : '40');
  out['--text'] = text; out['--hana-text'] = text;
  out['--text-light'] = isLight ? shade(text, 0.28) : shade(text, -0.12);
  out['--text-muted'] = isLight ? shade(text, 0.46) : shade(text, -0.32);
  out['--term-fg'] = isLight ? shade(text, 0.12) : shade(text, -0.08);
  out['--term-cursor-accent'] = isLight ? card : bg;
  out['--term-ansi-white'] = out['--text-light'];
  out['--term-ansi-bright-black'] = out['--text-muted'];
  out['--border'] = isLight ? 'rgba(0,0,0,0.12)' : '#B896C138';
  out['--overlay-subtle'] = isLight ? '#00000004' : '#FFFFFF06';
  out['--overlay-light'] = isLight ? '#00000008' : '#FFFFFF0D';
  out['--overlay-medium'] = isLight ? '#00000010' : '#FFFFFF17';
  out['--overlay-strong'] = isLight ? '#00000018' : '#B896C133';
  out['--shadow'] = isLight ? '#0000001F' : '#00000070';
  out['--attach-bg'] = isLight ? '#00000006' : '#FFFFFF0D';
  out['--jian-note-bg'] = isLight ? '#F1EDE8' : '#262127';
  out['--jian-note-border'] = isLight ? 'rgba(0,0,0,0.10)' : '#B896C140';
  out['--tool-bg'] = isLight ? '#00000005' : '#B896C10D';
  out['--mood-bg'] = isLight ? '#00000006' : '#B896C112';
  out['--mood-border'] = isLight ? 'rgba(0,0,0,0.10)' : '#B896C133';
  return out;
}

/* ── 内置主题定义 ── */
const ITEMS = [
  {
    packId: 'blend-deepseek',
    name: 'DeepSeek · 深海女仆',
    file: 'blend-deepseek.jpg',
    tags: ['深色', '蓝', '内置'],
    appearance: 'dark',
    preset: { bg: '#1E2624', card: '#26333A', accent: '#31779C', text: '#EAEFF1' },
    panelAlpha: 0.5, cardAlpha: 0.42, position: '50% 42%',
  },
  {
    packId: 'blend-claude',
    name: 'Claude · 橙色几何',
    file: 'blend-claude.jpg',
    tags: ['亮色', '橙', '内置'],
    appearance: 'light',
    preset: { bg: '#F2F0EE', card: '#FFFFFF', accent: '#E85D14', text: '#1C1A18' },
    panelAlpha: 0.35, cardAlpha: 0.3, position: '50% 45%',
  },
];

const outDir = join(ROOT, 'skin-wardrobe', 'assets', 'prebuilt', 'packs');
mkdirSync(outDir, { recursive: true });

for (const item of ITEMS) {
  const imgPath = join(PRE, item.file);
  const b64 = 'data:image/jpeg;base64,' + readFileSync(imgPath).toString('base64');
  const isLight = item.appearance === 'light';
  const colors = deriveColors(item.preset);

  const pack = {
    schema: 'hana-skinpack/2',
    packId: item.packId,
    packVersion: '1.0.0',
    names: { zh: item.name },
    description: '内置主题：' + item.name,
    tags: item.tags,
    group: '内置',
    favorite: false,
    source: { kind: 'original', publisher: 'builtin', license: 'unspecified' },
    theme: {
      key: 'default',
      appearance: item.appearance,
      colors,
      background: {
        asset: b64, fit: 'cover', position: item.position,
        panelAlpha: item.panelAlpha, cardAlpha: item.cardAlpha, tint: null,
      },
      material: {
        tier: 'bold',
        edge: isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.22)',
        rim: 0.26, blur: 26, glowFromBg: true,
      },
      frame: { kind: 'none' },
      shot: b64,
    },
    meta: { madeIn: 'builtin-preinstall', at: new Date().toISOString() },
  };

  const out = join(outDir, item.packId + '.skinpack.json');
  writeFileSync(out, JSON.stringify(pack), 'utf8');
  console.log(`  ${item.packId}  ${(readFileSync(out).length / 1048576).toFixed(2)} MB  (${item.name})`);
}
console.log('完成');
