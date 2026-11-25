# 交接说明 · Emby 反代重构与发布

> 最后更新：2026-11-25
> 分支：`refactor/playback-first`
> 基线：`Dirige/EMBY_CF` 提交 `4e0357e`（个人版 v6.4.9 / 多人版 v6.8.11-multi）
> 状态：**两版已按用户授权分别发布；GitHub 整理、验证与推送状态见 `docs/GITHUB-PUBLISH.md`，原工作区与历史保留。**

## 0. 当前状态与继续工作边界

- **2026-11-25 GitHub／教程整理**：用户授权同步两版到 `Dirige/EMBY_CF` 并提供个人版图文稿。最新生成代码回到 `worker.js`／`personal/worker.js` 下载路径，原始回归基线移至 `tests/baselines/`；新增两版图文、38 张本地脱敏插图、两份图片内嵌离线 HTML、升级指南和 `relay/` 加固源码。`npm run package:workers`／`npm run docs:build` 可复现。最终 345 自动／22 浏览器／14 中继 race 回归通过，依赖审计零漏洞，运行代码哈希不变。仅同步 GitHub，不改任何生产部署；推送及最终状态见 `docs/GITHUB-PUBLISH.md`。
- **个人版**：`v6.4.9-refactor.8`，Worker `emby-personal-refactor`，版本 `7c045fde-6c5e-4458-9634-cfaa333fbcef`，100%，入口 `https://proxy.255432.de5.net`；回滚 `.7`／`436d96b8-33be-458d-ae0d-4e5546f47454`。本轮多人版同步时仅重建核对哈希，没有重新上传个人版。不要尝试旧网页密码，也不要改变「守候」的 `on` 或「非越」的 `auto`。
- **多人版**：`v6.8.11-multi-refactor.3`，Worker `fd`，版本 `82eb4768-8589-438b-beb5-a230bc560299`，100%，入口 `https://fd.255432.de5.net`；原／回滚版本 `79de3cb9-518a-4823-83f0-03ebc2b7ecf0`。完整多轮同步范围见 `docs/MULTI-SYNC-CHECKLIST.md`，发布／回滚安全边界见 `docs/MULTI-PUBLIC-ACCEPTANCE.md`。
- **最终检查**：`CI=1 npm run check` 通过，339 自动／20 浏览器，零失败／跳过；依赖审计零漏洞。冻结发布包在真实 workerd `2026-11-24`、原 fd 日期／空 flags 下通过 130 项全库隔离检查，出站次数 0。发布后原 22 张表／602 条记录、原列及索引全部保留，未改用户密码、邀请码、DNS 或线路。
- **配置隔离**：fd D1 仍为 `bb606054-6e7b-45f4-ac36-a48216f102a9`，原绑定原样继承；运行时 `2026-10-17`／空 flags／`standard`，Smart Placement 为 `smart`，Cron 为 `0 */15 * * *`。fd 没有中继地址／密钥，不能复制个人版 VPS；多人版仍只有全局中继开关，不加入个人版逐线路三模式。
- **通知与改密**：多人版使用独立 `multi_private`、按账号 epoch；TG 可从至少 32 字节的原 `SESSION_SECRET` 分用途 HKDF 派生，原 fd 绑定已满足，无需新增 Secret。旧哈希／未改密 Cookie 兼容；登录校验／签发使用同一凭据快照。Bot 只做通知，不增加入站管理或接管 webhook。
- **VPS**：本轮配置／证书／服务未改、未重启。当前服务仍是此前个人版 `emby-relay-0.3.2-private`；实际维护源码来自原 `/root/relay-v03` 的独立加固副本，见工作目录 `releases/relay-hardening-20261121`，不要用较旧的项目 `personal/relay.go` 覆盖它。
- **发布与备份**：公开多人版发布包在 `releases/multi-sync-20261124/`，两版 manifest 在 `docs/RELEASE-MANIFEST-20261124.json`。原代码／绑定／完整 D1 和验收报告在受限 `/tmp/opencode/emby-multi-sync-20261124/`，最新快照与确认在 `final-release/`；这些私有文件含秘密，不能公开、打印或提交。
- **仍待用户验收**：真实登录、媒体起播、拖动、长播、字幕、真实 TG 送达。不要把合成流／隔离库／公开健康页验收说成真实播放通过；不制造故障或降低 Cloudflare 安全策略来演示功能。未来生产写操作仍需用户授权。

以下续验／原机器进度主要为 2026-11-19 的历史记录；旧版本、测试数量、旧域名及“未发布／不发布多人版”等表述不能取代本节当前状态。历史性能观察仍见 `docs/OFFLINE-ACCEPTANCE.md`，不承诺公网速度。

### 新机器续验记录（2026-11-19）

- 交接归档 SHA-256 与提供值一致；Git 工作区初始干净，`git fsck` 通过。
- 新机器为 Linux arm64，使用工作目录 `.tools/node-v22.14.0-linux-arm64` 内的独立 Node.js（位于交接包解压目录的上一级）。
- `npm ci`、`npm run build`、`npm test` 完成：构建大小及哈希与交接记录一致，42/42 回归通过。
- 安装 Playwright Chromium 与系统依赖后，`npm run test:browser` **6/6 通过**。
- 修正 E2E 的 `/admin#overview` URL 断言及多人版 `tab` 角色定位；移除旧机器低内存用的单进程 Chromium 参数，避免复用浏览器时退出。业务源码与锁文件未改。
- `npm audit` 报告开发依赖链 `miniflare` / `sharp` / `undici` 共 3 项 high，尚未修复；未执行强制依赖变更。发布前需评估处理。
- 本记录仅完成现有自动浏览器检查，不代表下表全部人工验收已完成，也不代表真实播放验证通过。未推送、未部署、未执行 Cloudflare 写操作。

以下为原交接时的进度记录，关于浏览器未完成的描述以本节续验结果为准。

### 引导页调整（2026-11-19）

- 按用户确认，仅修改不满意的本地引导页，后台样式不动。
- 两版 `/__preview` 复用原版个人版首页模板与样式：壁纸背景、左右分栏、功能标签、原版按钮；保留本地免密登录、普通用户入口与版本切换，不再使用独立验收卡片设计。
- 默认生产首页渲染不变；本地仍使用合成壁纸、不连接真实外部服务。
- 构建成功，42/42 回归、8/8 浏览器用例通过（新增两版引导页桌面/移动布局检查）。个人版构建因模板新增可选参数而变为 220151 bytes / `c1e4a0e499014f97…`，多人版构建未变。

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

## 3. 当前构建与自动测试

```bash
npm run build
npm test
```

预期：

- `personal: 276502 bytes`，sha256 `a4761cb36579184f…`，版本 `.8`
- `multi: 400670 bytes`，sha256 `43d58cb8e51948ea…`，版本 `v6.8.11-multi-refactor.3`
- `# tests 339`、`# pass 339`、`# fail 0`；浏览器 20 项通过

完整构建哈希以 `dist/manifest.json`／`docs/BUILD-MANIFEST.json` 为准。`npm run package:workers` 同步最新 `worker.js`／`personal/worker.js`；历史基线在 `tests/baselines/`，不再是这两个下载文件。构建命令不部署，manifest 中 `deployed: false` 只描述构建动作，线上状态见独立发布 manifest。发布包已另存供回读／回滚核对。构建已做路径无关处理：同样的源码在不同目录、不同机器上会得到相同哈希（`scripts/build.mjs` 使用相对虚拟模块 id）。

浏览器验收：

```bash
npm run test:browser
```

它会自动启动隔离预览（`playwright.config.mjs` 的 `webServer`），串行跑两版主题、路由编辑、设置、移动端、多用户权限及 TG／改密界面；真正加密与认证由 workerd/D1 测试验证。注意：普通用户访问 `/admin/api/users` 的预期为 `401`（入口统一拦截，不是 403）。

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

## 5. 原机器历史完成度（2026-11-19）

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

## 6. 原机器历史发布门槛与基线（2026-11-19）

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
sha256sum -c emby-refactor-handoff-*.tar.gz.sha256
```

解包后先读本文件，再执行第 2、3 节命令。若归档中 `dist/` 不存在，属正常（构建产物未提交），`npm run build` 会生成。
