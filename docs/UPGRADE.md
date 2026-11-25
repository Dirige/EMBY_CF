# 已有部署升级、备份与回滚

适用于本次两版重构。仓库推送只更新 GitHub，不会自动部署 Cloudflare，也不会把所有相似域名切到同一 Worker。

## 升级前清单

1. 访问每个实际入口的 `/health`，记录版本；核对所属 Cloudflare 账户、Worker、主域与用户子域 Route。名称都叫 `fd` 不代表是同一账户／部署。
2. 保存旧 Worker 版本 ID 和原代码。个人版用 `personal/worker.js`，多人版用根目录 `worker.js`，不要交叉。
3. 通过可信 Cloudflare 通道导出**完整 D1**，备份所有原表／索引／用户／密码哈希／邀请码／设置。备份含私密信息，不提交 GitHub。
4. 记录 DB ID、所有文本与 Secret 绑定、兼容日期／flags、usage model、Smart Placement、Observability、Cron、域名与 Route。`keep_vars` 不是“保存所有配置”的开关。
5. 可选 VPS 另行备份二进制、完整配置、TLS 与服务定义，不在更新 Worker 时顺手改共享 VPS 或中断播放。
6. 阅读实际功能差异：[多人版同步清单](MULTI-SYNC-CHECKLIST.md)、[自动回退](AUTO-RELAY-FAILOVER.md)、[通知与认证安全](WEB-NOTIFICATIONS-SECURITY.md)。

## 更新代码

### Cloudflare 网页（少量站点推荐）

在**现有目标 Worker**编辑代码，仅替换对应的生成文件，保留所有原绑定、域名和配置。创建版本后核对绑定及运行时再切流量；不要另建同名库来“解决升级”。

### CLI（先完整同步配置）

本地 `npm ci && npm run check && npm run package:workers`。将模板复制为被忽略的 `wrangler.local.<edition>.toml`，逐项填写当前实际配置。不要直接拿占位示例 `deploy` 覆盖已有 Worker，特别是 D1、Secret、Cron、flags 和 Smart Placement。

可使用 Wrangler 的版本上传＋独立部署流程；具体命令先查看本机版本的 `versions upload --help` / `versions deploy --help`。**上传版本也可能影响“最新版本设置”的显示或默认值，必须比较配置，不能只验证版本号。** 使用 Cloudflare API 的发布工具也应显式继承绑定、运行时和智能放置；任何差异先停止切流量，不以重写全站设置掩盖。

生产配置、原数据库快照和部署 OAuth 永不进入本仓库。GitHub 检查工作流不持有这些 Secrets，也不会自动部署。

## 数据兼容边界

- 两版数据库独立。旧密码不会为升级被重置，未改密旧会话继续兼容。
- 多人版只增加必要的兼容列／索引与私有表／触发器；旧 `user_routes(user_id,prefix)` 保留 id、user_id、历史字段；编辑采用 UPDATE，不删后重建。
- 原用户、邀请码、DNS、优选域名和历史表保留；历史 `admin_routes` 不会因升级自动变成活跃公开线路。
- 内置管理员新密码、普通用户会话 epoch、TG 密文不在一般配置导出中；不要把导出 JSON 当作完整还原。
- 原始 `/http(s)://...` 路径默认关闭，改用登记线路；仅确有需要时显式启用并设置目标白名单，不能恢复公共代理。
- 个人版旧 `image` 线路按自动解释；已有 `on/off` 保留。多人版不新增逐线路模式，也不复制个人版中继地址／密钥。

## 更新后核查

- 主入口和每类用户 Host `/health` 显示预期版本；首页／后台可打开，未登录管理／用户 API 仍 401。
- D1 ID、绑定、密码、用户、邀请码、线路、DNS、Cron、智能放置、flags 和配置原值保留；不输出 Secret 作为比较结果。
- 用真实账号人工验证登录、起播、拖动、长播、字幕、WebSocket 及实际通知；合成测试和公共接口 200 不等于真实播放验收通过。
- 记录版本 ID、构建哈希、回滚目标及验证结果，避免只记录“部署成功”。不制造真实故障或修改用户线路来演示回退。

## 回滚

代码回滚仅切换旧版本，**不恢复数据库、不删除新列／私有表／触发器**。先核对当前绑定与回滚目标，保留新备份。

旧版可能忽略网页内置管理员新密码、账号 epoch 和加密 TG：若上线后用户已经改密或配置通知，直接回滚可能恢复旧认证／通知行为。须先评估并安排安全恢复，不把“旧代码能运行”当作安全回滚完成。

个人版／多人版实际发布与回滚记录分别见 [PERSONAL-PUBLIC-ACCEPTANCE.md](PERSONAL-PUBLIC-ACCEPTANCE.md) 和 [MULTI-PUBLIC-ACCEPTANCE.md](MULTI-PUBLIC-ACCEPTANCE.md)。这些是特定部署的历史记录，不是让其他人使用其中的域名、数据库 ID 或配置。
