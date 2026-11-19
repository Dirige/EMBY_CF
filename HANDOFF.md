# 交接说明 · Emby 反代重构（本地验收）

> 最后更新：2026-11-19
> 分支：`refactor/local-acceptance`
> 基线：`Dirige/EMBY_CF` 提交 `4e0357e`（个人版 v6.4.9 / 多人版 v6.8.11-multi）
> 状态：**只在本地开发与验收，未推送、未部署、未改生产配置。**

## 0. 一句话进度

共享核心与两套发行版的模块化拆分已经完成，构建与 42 项协议/基线回归测试通过；本地双实例预览可登录、可操作。剩下的是在新机器上补跑浏览器 E2E 和人工验收，然后才讨论发布。多人版功能按你的决定暂时冻结在 v6.8.11-multi 的行为上。

## 1. 项目结构

```text
src/
  shared/                 两版共享：HTTP、代理管线、网盘规则、会话、统计、主题、页面组装
  editions/personal/      个人版专属：入口、单用户设置、中继、管理 API
  editions/multi/         多人版专属：用户/邀请、子域名、推流映射、配额、管理 API
  personal.js             个人版构建入口
  multi.js                多人版构建入口
  local/                  仅本地预览：隔离 Cookie、测试数据种子、双实例入口
web/
  shared/                 共享毛玻璃样式、主题、工作区标签页
  personal/               个人版原有页面与样式
  multi/                  多人版页面
scripts/
  build.mjs               esbuild 打包，产出 dist/*.mjs + manifest.json
  preview.mjs             Miniflare 双实例、loopback HTTP、外网阻断
  fixtures.mjs            合成上游响应（Range/206/PlaybackInfo），不连真实媒体
tests/
  proxy.test.mjs          42 项协议与基线回归
  browser/console.spec.mjs Playwright 验收（新机器补跑）
docs/
  RESEARCH.md             参考项目、借鉴边界、备份位置
  MODULES.json            原 295 个声明 → 54 个领域模块的映射
  EXTRACTION.json         迁移清单
```

工作方式：源码是构建输入，单文件 Worker 是产物。不要直接改 `dist/` 或线上 bundle 文本；改 `src/`、`web/` 后重新构建。

## 2. 新机器环境

要求 **Node.js >= 22.14**（旧机器用 `/opt/node-v22.14.0-linux-x64/bin/node`；系统 Node 18 缺少 `process.getBuiltinModule`，测试会失败）。

```bash
node -v          # 必须 v22.14+
npm ci
```

Playwright 浏览器只在跑浏览器验收时需要：

```bash
npx playwright install --with-deps chromium
```

Linux 若缺系统库，可先装 Playwright 依赖；旧机器因内存不足（<1 GB、swap 高）无法启动 Chromium，不是页面逻辑失败。

## 3. 构建与自动测试

```bash
npm run build
npm test
```

预期：

- `personal: 218905 bytes`，sha256 `9a3b56e9e3751a81…`
- `multi: 330175 bytes`，sha256 `5368c12ef79eb9ea…`
- `# tests 42`、`# pass 42`、`# fail 0`

完整哈希以 `dist/manifest.json` 为准。构建产物不提交，重新生成即可。构建已做路径无关处理：同样的源码在不同目录、不同机器上会得到相同哈希（`scripts/build.mjs` 使用相对虚拟模块 id）。

浏览器验收：

```bash
npm run test:browser
```

它会自动启动预览（`playwright.config.mjs` 的 `webServer`），串行跑两版主题、路由编辑、设置、移动端和多人版普通用户权限。旧机器没跑完，**新机器第一次务必看结果**。注意：普通用户访问 `/admin/api/users` 的预期已按线上基线改为 `401`（入口统一拦截，不是 403）。

## 4. 本地验收

```bash
npm run preview
```

- 个人版：<http://127.0.0.1:4273/__preview>
- 多人版：<http://127.0.0.1:4274/__preview>

预览页有「进入工作区」按钮；多人版另有「验收普通用户视图」。不需要输入密码，预览入口会用内存中的随机 `ADMIN_TOKEN` 建立会话。

隔离规则：

- 只接受 loopback Host；其他 Host 返回 403。
- 两版使用独立 D1：`.local/d1/personal`、`.local/d1/multi`。
- 两版 Cookie 分别为 `emby_preview_personal`、`emby_preview_multi`，转发给业务代码前才还原为生产 Cookie 名；预览不会接受真实生产 Session。
- 除 `/bing-wallpaper` 本地插画外，外部请求全部由 `scripts/fixtures.mjs` 返回合成响应，不访问真实 Emby、网盘或 Cloudflare。
- 想重置测试数据：停止预览后删除 `.local/`，下次启动会重新种子。

### 人工验收清单

| 项目 | 个人版 | 多人版 | 通过标准 |
| --- | --- | --- | --- |
| 毛玻璃主题 | 是 | 是 | 半透明卡片、背景模糊、青色强调，和原个人版一致 |
| 深/浅色切换 | 是 | 是 | 顶栏主题按钮循环，刷新后保持 |
| 移动端 | 是 | 是 | 390×844 下无横向滚动，按钮可点 |
| 路由列表 | 是 | 是 | 能看到「本地测试 · 普通线路」「暂停的备用线路」 |
| 新增/编辑/删除路由 | 是 | 是 | 弹窗可保存，列表立即更新；取消不写入 |
| 设置弹窗 | 是 | 是 | 打开、修改、保存、取消均正常 |
| 日志/审计 | 是 | 是 | 能看到 `local.preview` 初始化记录 |
| 中继表单 | 是 | 是 | 可填写、测试按钮走合成响应，不连真实 VPS |
| 用户/邀请/配额 | — | 是 | 管理端可见；普通用户看不到用户列表与设置 |
| 普通用户视图 | — | 是 | 只看到自己的 `private` 路由，看不到 `demo` 分离推流线路 |
| 权限接口 | — | 是 | 普通用户 `/admin/api/users` 返回 401，`/api/user/routes` 返回 200 |
| 预览隔离 | 是 | 是 | 个人版 Cookie 放到多人版不构成登录；跨域 POST 登录 403 |

验收时不要填写真实 Token、Cookie、证书、媒体地址或生产域名。预览数据都带「本地测试」标记，统计未接入时显示 `—` 是预期行为，不伪造速度与流量。

## 5. 当前完成度

已完成：

- 重构前备份：原仓库 bundle、源码压缩包、个人版线上 v6.4.8/v6.4.9 快照、SHA-256 清单（见第 7 节）。
- 用 TypeScript AST 完成声明迁移：295 个声明 → 54 个领域模块，两版共享/专属边界见 `docs/MODULES.json`。
- 修复模块化后的可变绑定问题：`invalidateSettingsCache()`、`clearStatsBuffers()` 替代跨模块赋值。
- 共享组装层、壁纸、工作区样式、多人版标签页控制器。
- 本地预览：双 Miniflare 实例、双 D1、loopback 限制、外网阻断、按版本隔离 Cookie、合成上游。
- 版本号：`v6.4.9-refactor.1`、`v6.8.11-multi-refactor.1`；D1 `SCHEMA_ID` 未变（`proxy-v6.4.8` / `multi-v6.8.5`），未做数据库迁移。
- 42 项自动测试通过：并发 Range、HEAD、206/416、单目标熔断、禁用路由、网盘跳转保真、流式返回、空 Referer、跨域凭据剥离、推流映射、66 条网盘域名一致、页面脚本语法。
- 本地实测：两版健康检查 200、登录 303、`/admin` 200、多人版普通用户权限隔离符合预期。

未完成/有限制：

- **浏览器 E2E 未在旧机器跑完**（Chromium 启不来）。用例已修正为 401，但需要新机器实跑确认。
- 没有验证真实播放、真实起播速度、首帧时间。合成测试只能证明协议与转发行为，不能推导客户端体验。
- 统计没有真实字节/吞吐观测；未接 Cloudflare Analytics 时界面显示 `—`。
- 多人版新功能（例如 v6.8.13 推流方案）按决定搁置，保持 v6.8.11-multi 行为。
- 没有部署 workflow；`.github/workflows/check.yml` 只做 `npm ci` + Playwright + `npm run check`，不含任何部署步骤。

## 6. 发布门槛（验收前不要做）

人工验收通过后，按顺序另行确认：

1. 确认 D1 向后兼容：`SCHEMA_ID` 仍为 `proxy-v6.4.8` / `multi-v6.8.5`，无隐式迁移。
2. 核对两个 Worker 的绑定、路由、环境变量名（不要打印值）。
3. 先在个人版灰度，保留旧回滚版本；观察错误率、登录、Range/206、播放会话。
4. 个人版稳定后再评估多人版；多人版涉及用户与子域名，必须单独确认。
5. 发布前把 `-refactor.1` 版本后缀处理成正式版本号，并更新 README/部署文档。

线上基线（只读记录，便于回滚，不含凭据）：

- 个人版：`v6.4.9`，入口 `https://proxy.255432.xyz`；当前 version `c7a7da03-484b-4c41-96a8-1bed8d7c319b`，旧回滚 version `1c748cb1-353d-45df-824a-942c0b32df71`（`v6.4.8`）。
- 多人版：`v6.8.11-multi`，入口 `https://dirige.dirige.de5.net`；deployment `ef9fb690-81c3-4f41-bf86-eb04e510f2b9`，version `01a91f65-61ba-4c6b-810a-51c6f6eb3524`。

真实运行版本以 deployments 和鉴权后的 admin export 为准，不能只看 Cloudflare 脚本 GET。

## 7. 备份与恢复

原机器备份目录：`/home/ubuntu/emby-backups/20261119T095945Z/`（已随交接包一并提供，放在 `backup/`）。

```bash
cd backup
sha256sum -c SHA256SUMS.txt
git bundle verify EMBY_CF.bundle
git clone EMBY_CF.bundle EMBY_CF-restored
```

`EMBY_CF-source.tar.gz` 是重构前的完整仓库快照；`personal_live_v648.js`、`personal_live_v649.js` 是线上个人版脚本快照，仅用于对照，不要用它们覆盖重构源码。备份不含生产数据库、Token、Cookie 或环境变量。

## 8. 安全边界

- 仓库与交接包内没有密码、登录 Token、Cookie 值、签名值、生产配置或媒体内容。
- 预览只绑定 `127.0.0.1`，外网不可达；上游请求被替换为合成响应。
- 不要在本机执行 `wrangler deploy`、`wrangler secret put` 或任何 Cloudflare 写操作，直到验收通过并单独确认。
- `/home/ubuntu/emby反代` 是另一套 7.0.0 项目，与本重构无关；不要覆盖或混入。
- 任何日志、截图、问题反馈都不要包含真实凭据或媒体地址。

## 9. 交接包校验

归档文件与校验值放在归档同级目录：

```bash
sha256sum -c emby-refactor-handoff-*.tar.zst.sha256
```

解包后先读本文件，再执行第 2、3 节命令。若归档中 `dist/` 不存在，属正常（构建产物未提交），`npm run build` 会生成。
