# 衣橱 · 皮肤库 (Skin Wardrobe)

衣橱 · 皮肤库 —— Hana 的第三方皮肤管理器：导入、预览、应用 SKINPACK 皮肤包；工作台从零做新皮肤。
A skin manager for Hana — import, preview and apply SKINPACK theme packs, or compose new skins from scratch in the built-in workbench.

## 功能 / Features

- **皮肤墙** — 搜索、分组、标签、收藏置顶；每张卡片带真实封面预览
- **工作台** — 从零做皮肤：背景图（自动压缩）、四色派生配色、五套明暗预设、圆角 / 描边 / 毛玻璃滑杆、字体栈、终端 ANSI 16 色
- **内置主题** — 安装即预装成品主题，开箱可用
- **启停链路** — App 管数据（皮肤库存、待办队列），agent 管宿主（改注册表、贴 CSS），职责分离

## SKINPACK v2 格式

一包一主题，四层结构，图片全部 data URI 内联（单文件分发）：

| 层 | 包内存什么 |
|---|---|
| 配色 | 宿主词表变量（核心 8 项必须，其余自由） |
| 背景 | 图片 + 遮罩强度 + 位置 |
| 材质 | 仅参数（tier / rim / blur / edge），CSS 由通用层提供 |
| 取景框 | 内置名或动效文件 |

格式详见 `docs/SKINPACK-v2.md`。

## 安装 / Install

1. 下载 Release 里的 `app-skin-wardrobe-<ver>.zip`
2. Hana → 扩展 → 安装本地包
3. 打开「衣橱 · 皮肤库」卡片

## 架构 / Architecture

```
App (Node child process)          Agent (对话侧)
├─ app-data/skins/    皮肤库存     ├─ patch/registry-ops.mjs   注册表增删
├─ app-data/pending   待办队列 ←── ├─ patch/wardrobe-exec.mjs  执行待办
└─ routes/*           前端 API     └─ 写宿主 themes/*.css + 注册表
```

宿主注册表操作采用字符串级手术（不重序列化压缩 bundle），写盘前过 `node --check` 语法闸。

## License

[AGPL-3.0](LICENSE)
