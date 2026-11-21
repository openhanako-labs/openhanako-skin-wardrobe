# 衣橱 · 皮肤库

A Hana v2 app (`manifestVersion: 2`). Kind: `ui`.

The identity icon is declared by `icon` in the manifest and shipped in `assets/`. Keep the source image; Hana creates a display copy during installation. Large images are resized automatically, and small images only receive a clarity recommendation.

## SDK and validate

`index.js` imports the bundled local App SDK and uses `defineApp(async sdk => ...)`. Registration calls wait for the host acknowledgement; retain the returned receipt when later code must dispose a registration explicitly. The scaffold does not install packages or resolve imports from Hana's own `node_modules`.

Every declared card must have `face.image` pointing to a bundled, nonempty PNG/WebP/SVG under `ui/`. For `ui` and `full`, the scaffold copies the explicit `--cover` source into `ui/assets/`. Keep the declaration and file together when editing or packaging; a missing or invalid cover rejects the App. Tool-only Apps do not need a card cover.

## Validate

The scaffold has run static package validation. After editing, build if required, then run these commands from a Hana checkout:

```sh
node scripts/validate-app.mjs --dir /path/to/skin-wardrobe --json
node scripts/validate-app.mjs --dir /path/to/skin-wardrobe --smoke --json
```

Use `--archive /path/to/install.zip --json` to validate the final installation archive. Add `--smoke` when startup execution is part of the task: it starts a backend process and, for declared UI pages, an Electron runner. Static validation alone does not prove runtime behavior. UI packages use path-scoped relative assets and the App UI SDK.

## Startup arguments

This App declares no startup arguments. Add static `contributes.cliFlags` entries only when startup-time configuration is necessary; then start Hana with `hana serve -- --app.<id>.<flag>=<value>`.

## Install

1. Use Hana Builder to import this local directory into an isolated development project.
2. Complete App Manager's review and read the actual installation result.
3. For production installation, give the validated package or local directory to App Manager. The manifest id is `skin-wardrobe`.

## After you edit

Build changed sources, then explicitly reload through Builder or App Manager. Local-directory installs retain their source for reload. New permission requests require review; read the resulting state before continuing. Keep the source project separate from the disposable development environment.

## How the starter tool runs

The starter tool uses the declared name, without an automatic host prefix. The manifest requests `app/tools.expose-to-model`; after approval, enable the App for the intended Agent. Discover the current tool schema before calling it. The Agent's tool discovery mode determines whether the tool is listed directly or found through deferred discovery.

The full contract is in `APPS.md` / `APPS_EN.md`.

## 跨 App 通道与导出接口（自有契约）

### 应用主题：`app:skin-wardrobe/apply-theme`（总线服务）

- 调用：`sdk.bus.requestService('app:skin-wardrobe/apply-theme', { themeId })`
- 前提：本 App 持 `app/services.provide`；调用方 App 需持 `app/services.call`（各自 manifest 声明，宿主默认拒）
- payload `{ themeId }` 必须是宿主注册表里已注册的主题 id（双套带 `-dark`/`-light` 后缀；内置如 `warm-paper`）
- 行为：校验已注册 → 备份 `user/preferences.json` → 写 `appearance.theme` → 立即执行（不进待办队列、不碰注册表）
- 返回 `{ ok, themeId, caller, effectiveAfterRestart: true }`；`caller` 是宿主盖章的调用方 appId，不可伪造，会记入衣橱日志
- **重启 Hana 后生效**（渲染器启动时读偏好）
- 运行时当前主题读取：宿主根元素 `data-theme` 属性（`documentElement.getAttribute('data-theme')`），与 agent 工具 `wardrobe_apply_theme` 同链路

### 主题清单：`app:skin-wardrobe/list-themes`（总线服务）

- 调用：`sdk.bus.requestService('app:skin-wardrobe/list-themes')`，payload 可省略
- 前提同上：本 App 持 `app/services.provide`，调用方持 `app/services.call`
- 返回：

  ```jsonc
  {
    "ok": true,
    "current": "hana-blend-deepseek",        // 宿主当前主题 id，读不到为 null
    "themes": [
      {
        "id": "hana-blend-deepseek",         // 一条一个主题 id（双套包拆成 -dark / -light）
        "packId": "blend-deepseek",
        "name": "DeepSeek · 深海女仆",
        "appearance": "dark",
        "accent": "#cd5b85",                // 画菜单够用的两个色
        "bg": "#141313",
        "colors": { "--bg": "#141313", "…": "…" },  // 整套配色（宿主同名字段），可选
        "enabled": true,                    // 宿主注册表真值；读不到为 null（不是「没装」）
        "current": false
      }
    ]
  }
  ```

- 只读：不写偏好、不碰注册表、不进待办
- 为什么要这个服务：宿主只提供「按 id 取某一张主题表」，不提供「一共有哪些」。唯一知道库存的是衣橱自己

### 主题配置导出：`GET /tokens`（HTTP 路由）

- `?packId=` 按包查；`?themeId=` 按 `data-theme` 的值反查（内置主题返回 `resolved: null`）
- 返回原始配置值（`source: "pack-config"`），非运行时快照；字段只增不改语义，破坏性变更升 `version`

### 边界（设计如此）

- 通道只能切换**已注册**主题；注册/撤销仍走待办队列 → 执行器（备份 + 幂等 + 三处注册表），总线服务绕不过这一层
- App 无法直写宿主偏好文件；唯一写入路径是本执行器，全部动作有备份可回滚
