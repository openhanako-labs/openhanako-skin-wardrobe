/**
 * assets/lib/inventory.js —— 已启用主题清单（纯数据，不碰 sdk）
 *
 * 只为 app:skin-wardrobe/list-themes 服务：把「皮肤库存 + 宿主注册表真值」压成
 * 一张调用方可以直接画菜单的扁平表。一条记录一个主题 id，双套包拆成 -dark / -light 两条。
 *
 * 不读文件系统以外的东西：skinsDir 由调用方给，注册表 id 集合也由调用方给。
 * 这样这段逻辑可以脱离 App 运行时单独跑测试（见 tools 里的用法）。
 *
 * 取色只取两个：--accent 与 --bg。调用方要更多色，仍然走宿主 theme.css；
 * 这里给的是「画菜单和预判明暗」够用的那一小撮。
 */

/** 从一份 colors 表里取强调色与底色。缺失就留空字符串，不编造。 */
function pickColors(colors) {
  const src = colors && typeof colors === "object" ? colors : {};
  const accent = typeof src["--accent"] === "string" ? src["--accent"].trim() : "";
  const bg = typeof src["--bg"] === "string" ? src["--bg"].trim() : "";
  return { accent, bg };
}

/**
 * @param {object} input
 * @param {Array<{ packId: string, pack: any }>} input.packs  已解析的皮肤包
 * @param {Set<string>|null} input.hostThemeIds  宿主注册表里的主题 id；null 表示读不到
 * @param {string|null} input.currentTheme  宿主当前主题 id
 * @returns {{ themes: Array<object>, current: string|null }}
 */
export function buildThemeInventory({ packs, hostThemeIds, currentTheme }) {
  const rows = [];

  for (const { packId, pack } of Array.isArray(packs) ? packs : []) {
    if (!pack || typeof pack !== "object") continue;
    const theme = pack.theme && typeof pack.theme === "object" ? pack.theme : {};
    const displayName = (pack.names && (pack.names.zh || pack.names.en)) || packId;
    const variants = Array.isArray(theme.variants) ? theme.variants : null;
    const darkV = variants ? variants.find((v) => v && v.appearance === "dark") : null;
    const lightV = variants ? variants.find((v) => v && v.appearance === "light") : null;
    const isDual = !!(darkV && lightV);

    // 单套：一个 id，不带后缀（和注册表里插的那条一致）
    const list = isDual
      ? [{ v: darkV, ap: "dark" }, { v: lightV, ap: "light" }].map(({ v, ap }) => ({
        id: `hana-${packId}-${ap}`,
        appearance: ap,
        name: `${displayName} · ${ap === "dark" ? "暗色" : "亮色"}`,
        colors: v.colors,
      }))
      : [{
        id: `hana-${packId}`,
        appearance: theme.appearance === "light" ? "light" : "dark",
        name: displayName,
        colors: theme.colors,
      }];

    for (const item of list) {
      const { accent, bg } = pickColors(item.colors);
      rows.push({
        id: item.id,
        packId,
        name: item.name,
        appearance: item.appearance,
        accent,
        bg,
        // 整份配色也带上（键就是宿主那套变量名）：调用方不必再来取一次 CSS
        colors: item.colors && typeof item.colors === "object" ? { ...item.colors } : {},
        // null = 查不到宿主，调用方别当成「没装」
        enabled: hostThemeIds ? hostThemeIds.has(item.id) : null,
        current: !!currentTheme && currentTheme === item.id,
      });
    }
  }

  rows.sort((a, b) => a.packId.localeCompare(b.packId) || a.id.localeCompare(b.id));
  return { themes: rows, current: currentTheme || null };
}
