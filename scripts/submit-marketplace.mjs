/**
 * scripts/submit-marketplace.mjs —— 向 hana-marketplace 提交收录 PR
 * 流程：读上游两个 JSON → 插入 skin-wardrobe 条目 → PUT 更新 fork → gh pr create
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const gh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const UP = 'liliMozi/hana-marketplace';
const FORK = 'Yuexiye/hana-marketplace';

const fetchJson = (repo, path) => {
  const raw = gh(`gh api repos/${repo}/contents/${path} --jq .content`);
  return JSON.parse(Buffer.from(String(raw).replace(/\s/g, ''), 'base64').toString('utf8'));
};
const fetchSha = (repo, path) => String(gh(`gh api repos/${repo}/contents/${path} --jq .sha`)).trim();

const readme = [
  '# 衣橱 · 皮肤库（Skin Wardrobe）',
  '',
  '> 导入、预览、应用 SKINPACK 皮肤包；工作台从零做新皮肤，启用后由 agent 贴入宿主。',
  '',
  '## 功能',
  '',
  '- **皮肤墙**：搜索 / 分组 / 标签 / 收藏置顶，卡片带真实封面预览',
  '- **工作台**：背景图（自动压缩至 1920px）、四色派生配色、五套明暗预设、圆角 / 描边 / 毛玻璃滑杆、字体栈、终端 ANSI 16 色',
  '- **内置主题**：安装即预装「DeepSeek · 深海女仆」「Claude · 橙色几何」两款成品',
  '- **封面生成**：canvas 渲染缩小版界面骨架，随包保存为卡片封面',
  '- **一键回滚**：停用 / 删除即从宿主还原',
  '',
  '## 用法',
  '',
  '1. 在卡片里导入 `.skinpack.json`，或用工作台新建（内置主题可直接启用）',
  '2. 点「启用」生成待办',
  '3. 对 agent 说「执行衣橱待办」，agent 改宿主注册表并贴入 CSS',
  '4. 重启 Hana，新主题出现在 设置 → 界面',
  '',
  '## 说明',
  '',
  '- 皮肤包为单文件 JSON（图片 data URI 内联），格式见仓库 docs/SKINPACK-v2.md',
  '- App 管数据、agent 管宿主：宿主改动全部由 agent 侧脚本执行，写盘前过 node --check 语法闸',
].join('\n');

const SHA256 = '2ea9796b383eac3453b55c58fe41c3d5224416065e05c7f7dc5affb01584c896';

console.log('1) 读上游 registry.json');
const reg = fetchJson(UP, 'registry.json');
reg.entries = reg.entries.filter((e) => e.id !== 'skin-wardrobe');
reg.entries.push({ kind: 'app', id: 'skin-wardrobe', repository: 'openhanako-labs/openhanako-skin-wardrobe', publisher: 'Yuexiye' });

console.log('2) 读上游 approvals.json');
const apr = fetchJson(UP, 'approvals.json');
apr.approvals = apr.approvals.filter((a) => a.id !== 'skin-wardrobe');
apr.approvals.push({ kind: 'app', id: 'skin-wardrobe', tag: 'v0.6.3', sha256: SHA256, readme });

console.log('3) 更新 fork 的两个文件');
const put = (repo, path, content, sha, commitMsg) => {
  // 请求体走文件（--input），避免 base64 塞不进命令行
  const bodyFile = process.env.TEMP + '\\gh-put-' + Date.now() + '.json';
  writeFileSync(bodyFile, JSON.stringify({
    message: commitMsg,
    content: Buffer.from(content).toString('base64'),
    sha,
  }), 'utf8');
  const out = gh(`gh api -X PUT repos/${repo}/contents/${path} --input "${bodyFile}" --jq .commit.sha`);
  return String(out).trim();
};
put(FORK, 'registry.json', JSON.stringify(reg, null, 2) + '\n', fetchSha(FORK, 'registry.json'), 'chore: register app skin-wardrobe v0.6.3');
put(FORK, 'approvals.json', JSON.stringify(apr, null, 2) + '\n', fetchSha(FORK, 'approvals.json'), 'chore: register app skin-wardrobe v0.6.3');
console.log('   fork 已更新');

console.log('4) 同步 fork 分支后创建 PR');
// fork 可能落后上游，先同步 main
try { gh(`gh repo sync ${FORK} --source ${UP}`); console.log('   fork 已同步上游'); } catch (e) { console.log('   sync 跳过（可能已最新）'); }

const body = [
  '## 基本信息',
  '',
  '- **扩展**：衣橱 · 皮肤库（Skin Wardrobe）',
  '- **类型 / ID**：app / `skin-wardrobe`',
  '- **发布者**：Yuexiye',
  '- **用途**：第三方皮肤管理器 —— 导入、预览、应用 SKINPACK 皮肤包；工作台从零做新皮肤（背景图 / 派生配色 / 预设 / 圆角 / 毛玻璃 / 字体 / 终端色）；内置两款预装主题',
  '- **作者仓库**：openhanako-labs/openhanako-skin-wardrobe',
  '- **Release**：https://github.com/openhanako-labs/openhanako-skin-wardrobe/releases/tag/v0.6.3（附件 `app-skin-wardrobe-0.6.3.entry.json` + `app-skin-wardrobe-0.6.3.zip`）',
  '',
  '## 图标预览',
  '',
  '米色底铺满 + 粗线纯衣架 + 暗铜横杆（与 org 内陪看 / 图库 / 邮件同一色系）：',
  '',
  '![icon](https://github.com/openhanako-labs/openhanako-skin-wardrobe/releases/download/v0.6.3/app-skin-wardrobe-0.6.3.zip)',
  '',
  '（正文不加载远程图，图标以 entry.json 内 data URI 为准——安装后与应用列表所见一致）',
  '',
  '## 截图说明',
  '',
  '- **皮肤墙**：卡片网格（封面 / 星标 / 明暗角标 / 标签 / 四层圆点 / 启停钮），顶栏搜索 + 分组 chips + 只看收藏',
  '- **工作台**：内置主题、背景图上传（自动压缩）、遮罩与位置、四色 + 五套预设、圆角 / 描边 / 毛玻璃三滑杆、字体栈与终端 16 色折叠区',
  '- **封面生成**：canvas 绘制缩小版界面骨架（侧栏 + 气泡 + 输入框），随包保存为卡片封面',
  '',
  '## 自测报告',
  '',
  '- **Hana 版本**：1.2.1-beta（win32-x64）',
  '- **操作系统**：Windows 10（19045）',
  '- **测试 Release**：v0.6.3（本 PR 登记的包）',
  '- **步骤与结果**：安装 zip → 打开卡片（内置主题自动预装）→ 工作台新建皮肤（背景图 + 配色）→ 点「启用」→ agent 执行 → 重启 Hana → 设置 → 界面出现新主题且全部生效',
  '- **已知限制**：启用 / 停用后需重启 Hana 生效；取景框动效层在路线图（v0.7）',
].join('\n');

fs.writeFileSync('dist/pr-body.md', body, 'utf8');
console.log('   PR 正文已写 dist/pr-body.md');
console.log('\n下一步：gh pr create --repo liliMozi/hana-marketplace --head Yuexiye:main');
