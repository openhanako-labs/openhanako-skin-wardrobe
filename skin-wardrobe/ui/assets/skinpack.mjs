/**
 * skinpack.mjs — SKINPACK 信封的读取、校验与补全。
 * 规范见 ../docs/SKINPACK.md。变量层校验一律交给宿主的
 * validateCustomThemeDefinition（经 hana.themes.custom.getSchema 间接实现），
 * 本模块不复制那 61 条规则。
 */

export const SCHEMA_ID = "hana-skinpack/1";

/** 决定「长相」与「可读性」的 8 项，缺一不算皮肤（规范 §5）。 */
export const REQUIRED_CORE = [
  "--bg", "--bg-card", "--bg-glass", "--sidebar-bg",
  "--text", "--text-muted", "--border", "--accent",
];

/** 建议明示：继承会串味，但不拦（规范 §5）。 */
export const RECOMMENDED = [
  "--accent-hover", "--accent-light", "--link", "--link-hover",
  "--green", "--coral", "--danger",
];

/** 缺失时由固定默认补足的几何/排版项（宿主深色底实测不含这 7 项）。 */
export const GEOMETRY_DEFAULTS = {
  "--radius-input": 8,
  "--radius-card": 12,
  "--radius-chat-card": 12,
  "--radius-chat-surface": 14,
  "--font-ui": ["Segoe UI", "Microsoft YaHei UI", "sans-serif"],
  "--font-serif": ["Noto Serif SC", "serif"],
  "--font-mono": ["Cascadia Code", "Consolas", "monospace"],
};

/** rgba(r,g,b[,a]) → #RRGGBBAA；不是 rgba 写法则原样返回 */
function rgbaToHex(v) {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i.exec(v);
  if (!m) return v;
  const hx = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const a = m[4] === undefined ? 255 : Math.round(parseFloat(m[4]) * 255);
  return ('#' + hx(+m[1]) + hx(+m[2]) + hx(+m[3]) + (a === 255 ? '' : hx(a))).toUpperCase();
}

/**
 * 把宿主调色板 CSS 解析成可用的底表：
 *  1. 只留词表内变量（midnight 实测有 10 项在外，不去会让宿主直接拒定义）
 *  2. rgba() → #RRGGBBAA（定义只认 hex；实测 16 项需转）
 *  3. var(--x) 解引用一轮（实测 --tab-slider-bg 是引用写法）
 * 解不出的项丢弃并列入 skipped，不写脏值。
 */
export function parsePaletteCss(css, vocabulary) {
  const allowed = vocabulary && vocabulary.length ? new Set(vocabulary) : null;
  const raw = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const name = m[1];
    if (allowed && !allowed.has(name)) continue;
    if (!(name in raw)) raw[name] = m[2].trim();
  }

  const out = {};
  const skipped = [];
  const resolve = (value, depth) => {
    const ref = /^var\((--[a-z0-9-]+)\)$/i.exec(value);
    if (!ref) return value;
    if (depth > 4) return null;
    const next = raw[ref[1]];
    if (!next) return null;
    return resolve(next, depth + 1);
  };

  for (const name of Object.keys(raw)) {
    let value = resolve(raw[name], 0);
    if (value === null) { skipped.push({ name, raw: raw[name], reason: 'unresolved var()' }); continue; }
    if (value.startsWith('#')) value = normalizeHex(value);
    else if (/^rgba?\(/i.test(value)) value = rgbaToHex(value);
    if (!/^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/i.test(value)) {
      skipped.push({ name, raw: raw[name], reason: 'not a hex color' });
      continue;
    }
    out[name] = value;
  }
  return { vars: out, skipped };
}

function normalizeHex(hex) {
  const body = hex.slice(1);
  if (body.length === 3) return "#" + body.split("").map((c) => c + c).join("");
  if (body.length === 4) {
    const [r, g, b, a] = body.split("");
    return "#" + r + r + g + g + b + b + a + a;
  }
  return hex.toUpperCase();
}

/**
 * 读取并静态校验一个信封。返回 { ok, errors, warnings, pack }。
 * 变量层的完整性不在这里判（交给宿主）。
 */
export function readPack(json) {
  const errors = [];
  const warnings = [];
  if (!json || typeof json !== "object") {
    return { ok: false, errors: ["不是有效的 JSON 对象"], warnings, pack: null };
  }
  if (json.schema !== SCHEMA_ID) {
    errors.push("schema 应为 \"" + SCHEMA_ID + "\"，实为 " + JSON.stringify(json.schema));
  }
  if (typeof json.packId !== "string" || !json.packId) {
    errors.push("缺少 packId");
  }
  if (typeof json.packVersion !== "string" || !json.packVersion) {
    errors.push("缺少 packVersion");
  }
  if (!Array.isArray(json.themes) || json.themes.length === 0) {
    errors.push("themes 必须是非空数组");
    return { ok: false, errors, warnings, pack: null };
  }

  const patchSets = json.patchSets || {};
  json.themes.forEach((theme, i) => {
    const at = "themes[" + i + "]";
    if (!theme || typeof theme !== "object") { errors.push(at + " 不是对象"); return; }
    if (typeof theme.key !== "string" || !theme.key) errors.push(at + " 缺少 key");
    if (theme.kind === "vars") {
      if (!theme.theme) errors.push(at + " kind=vars 但缺少 theme");
      if (theme.patchRef) warnings.push(at + " kind=vars 不应带 patchRef，已忽略");
    } else if (theme.kind === "patch") {
      if (!theme.patchRef) {
        errors.push(at + " kind=patch 缺少 patchRef（补丁描述在包级，见规范 §4.3）");
      } else if (!patchSets[theme.patchRef]) {
        errors.push(at + " patchRef \"" + theme.patchRef + "\" 在 patchSets 里不存在");
      }
      if (theme.theme) warnings.push(at + " kind=patch 的 theme 不会被使用");
    } else {
      errors.push(at + " kind 必须是 vars 或 patch，实为 " + JSON.stringify(theme.kind));
    }
    if (!theme.losses) errors.push(at + " 缺少 losses（可为空数组，但必须显式写）");
  });

  // patchSets 引用检查：没人用的补丁集是包作者留下的噪音
  const used = new Set(json.themes.map((t) => t.patchRef).filter(Boolean));
  Object.keys(patchSets).forEach((id) => {
    if (!used.has(id)) warnings.push("patchSets." + id + " 没有任何主题引用");
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    pack: errors.length ? null : json,
  };
}

/**
 * 计算一个 vars 主题的完整性：缺哪些核心项、继承多少、总补全结果。
 * baseVariables 来自宿主调色板解析（已过滤到词表）+ 几何默认。
 * vocabulary 给出时，结果只保留词表内变量；词表外的作者变量会被
 * 列入 losses 口径的 outsideVocabulary，由调用方报损，不静默丢。
 */
export function analyzeTheme(theme, baseVariables, vocabulary) {
  const authored = (theme.theme && theme.theme.variables) || {};
  const names = Object.keys(authored);
  const missingCore = REQUIRED_CORE.filter((n) => !(n in authored));
  const missingRecommended = RECOMMENDED.filter((n) => !(n in authored));

  /*
   * 底表分两层：几何默认在最下（宿主调色板实测不含这 7 项），
   * 调色板在上。少了这一层，补全结果会缺 --radius-* 与 --font-*，
   * 交给宿主直接被拒（它要求 61 项齐全）。
   * baseVariables 允许传入 { vars, skipped } 形状。
   */
  const baseVars = baseVariables && baseVariables.vars ? baseVariables.vars : (baseVariables || {});
  const layeredBase = { ...GEOMETRY_DEFAULTS, ...baseVars };

  const filled = {};
  const inherited = [];
  const defaulted = [];
  for (const name of Object.keys(layeredBase)) {
    if (name in authored) { filled[name] = authored[name]; continue; }
    filled[name] = layeredBase[name];
    // 按**实际取自哪一层**分类，不是按名字属于哪一类：
    // 宿主调色板若提供了圆角，那算继承不算默认。
    if (baseVars && name in baseVars) inherited.push(name);
    else defaulted.push(name);
  }
  // 作者写了但底表没有的项，原样带上交给宿主判定
  for (const name of names) {
    if (!(name in filled)) filled[name] = authored[name];
  }

  /*
   * 词表过滤。不在词表里的作者变量不能静默删——规范要求报损（§4.4），
   * 所以另列一份交给 UI 显示。
   */
  const outsideVocabulary = [];
  if (vocabulary && vocabulary.length) {
    const allowed = new Set(vocabulary);
    for (const name of Object.keys(filled)) {
      if (!allowed.has(name)) {
        outsideVocabulary.push(name);
        delete filled[name];
      }
    }
  }

  return {
    authoredCount: names.length,
    inheritedCount: inherited.length,
    defaultedCount: defaulted.length,
    missingCore,
    missingRecommended,
    outsideVocabulary,
    complete: missingCore.length === 0,
    definition: {
      formatVersion: 1,
      name: (theme.theme && theme.theme.name) || theme.key,
      appearance: theme.appearance,
      variables: filled,
    },
  };
}

/** 皮肤包导出：把一个宿主 CustomThemeRecord 反写成信封（规范 §6/§7）。 */
export function exportPack(record, meta) {
  return {
    schema: SCHEMA_ID,
    packId: meta.packId,
    packVersion: meta.packVersion || "1.0.0",
    names: { zh: meta.displayName || record.name },
    source: {
      kind: meta.sourceKind || "original",
      publisher: meta.publisher || "unknown",
      license: meta.license || "unspecified",
    },
    themes: [{
      key: meta.key || "default",
      kind: "vars",
      appearance: record.appearance,
      palette: pickPalette(record.variables),
      base: "host-" + record.appearance,
      theme: {
        formatVersion: 1,
        name: record.name,
        appearance: record.appearance,
        variables: record.variables,
      },
      losses: [],
    }],
  };
}

function pickPalette(v) {
  const out = {};
  const map = { bg: "--bg", panel: "--bg-card", accent: "--accent", text: "--text" };
  for (const k of Object.keys(map)) if (v[map[k]]) out[k] = v[map[k]];
  return out;
}
