# 多轮个人版修复 → 多人版同步清单（2026-11-24）

范围：对照个人版此前的重构、`.3/.4` 页面更新、`.5/.6` 网页安全与中继修复、`.7` 备注保密和 `.8` 自动回退，补齐本地多人版后发布到独立 Worker `fd`。不是只同步本次 401/403/451 修复，也不是把个人版整份配置复制过去。

多人版 `v6.8.11-multi-refactor.3` 已 100% 发布。版本 ID、构建哈希与回滚信息以 `MULTI-PUBLIC-ACCEPTANCE.md` 为准；个人版保持已发布 `.8`，本轮不再上传个人版。

## 差异核对

| 个人版轮次／修复 | 多人版处理 | 验证位置 |
| --- | --- | --- |
| 初始播放优先重构 | 两版已经共用有界请求体、取消、预算、逐跳跳转、私有缓存隔离、Range/HEAD/206/416、WebSocket 和进度隔离；保留多人版独立推流映射 | `tests/transport-safety.test.mjs`、`runtime-proxy.test.mjs`、`redirect-safety.test.mjs`、`progress-isolation.test.mjs`、`websocket-http.test.mjs` |
| `.3/.4` 毛玻璃后台、每日壁纸、主题与短屏手机 | 已在多人版本地同步，本次一并发布；管理员／普通用户视图仍分开，不删除用户、邀请、配额、DNS 和推流表单 | `tests/browser/console.spec.mjs`、`tests/wallpaper.test.mjs` |
| `.5/.6` 网页 TG 保存／测试／停用 | 补齐管理员网页功能；Token 不回显、不记日志、不进入配置导出；明确停用或解密失败不回退旧机器人；普通用户无通知设置权限 | `src/editions/multi/config/notifications.js`、`tests/multi-notifications.test.mjs`、`multi-security.test.mjs` |
| `.5/.6` 密码修改和旧会话撤销 | 内置管理员、数据库管理员和普通用户只改自己的密码；旧用户哈希与未改密旧 Cookie 兼容；按账号 epoch 撤销跨实例会话，登录验证与签发使用同一凭据快照；条件更新使用 `RETURNING id` 避免 D1 触发器计数误报冲突 | `src/editions/multi/auth/`、`config/private-store.js`、`tests/multi-security.test.mjs` |
| `.6` 中继健康 JSON 误截断、假成功和错误回显 | 完整、有界解析健康 JSON，要求 HTTP 成功且 `ok: true`；后台不显示部分密钥或原始异常；中继密钥不导出 | `src/editions/multi/admin/api.js`、`tests/multi-security.test.mjs` |
| `.7` 线路备注告警保密 | 异常／恢复优先安全备注，含地址／凭据时整条回退为 HMAC 编号；编号按用户及发行版隔离；健康状态、日报、TG 与 Webhook 均不发送源站／入口／原始错误 | `src/editions/multi/maintenance.js`、`integrations/alert-privacy.js`、`tests/alert-privacy.test.mjs`、`multi-security.test.mjs` |
| `.8` 安全自动 VPS 回退 | GET/HEAD 对连接故障、401/403/451 和原多人版网关错误尝试一次 VPS；白名单登录／PlaybackInfo POST 仅在明确 401/403/451、完整有界可重放请求体时重试；成功后实例内优先 VPS 2 分钟，只有只读请求探测恢复 | `src/editions/multi/relay/`、`proxy/pipeline.js`、`tests/multi-relay-failover.test.mjs`、`multi-runtime-relay.test.mjs` |
| `.8` 成功回退后的签名跳转路径 | 多人版独立 302／PlaybackInfo 推流映射继续走同用户 VPS 偏好；签名编码、重复 query、Range、Referer 与跨域凭据策略保留，不改成个人版推流逻辑 | `src/editions/multi/proxy/stream-targets.js`、`tests/multi-runtime-relay.test.mjs` |
| 代理 X-Frame-Options | 补齐 SAMEORIGIN／DENY／关闭；只影响代理响应，管理页始终 SAMEORIGIN | `src/editions/multi/http/responses.js`、`tests/multi-security.test.mjs`、`tests/browser/multi-security.spec.mjs` |
| 多人版独有：预检归属与统计范围 | 诊断／导入预检不能覆盖其他管理员的线路；用户统计只匹配显式 Host，不扩展兄弟用户、主域名或账号总量；缺维度／未匹配／查询达到上限时拒绝汇总，不重试无 Host 维度的总量查询 | `src/editions/multi/admin/api.js`、`integrations/analytics.js`、`tests/multi-stats-isolation.test.mjs` |
| 多人版独有：真实旧 D1 兼容 | 仅增加需要的列、索引和私有表／触发器；保留原表、id、user_id、历史字段、邀请码、DNS 与优选域名；旧线路编辑改用 UPDATE，`admin_routes` 保留但不激活 | `storage/legacy.js`、`users/routes.js`、`tests/multi-legacy.test.mjs`、`scripts/accept-multi-snapshot.mjs` |

## 有意保留的版本差异

- 多人版保留原全局中继开关，不增加个人版逐线路「自动／开／关」三模式。`fd` 没有中继地址／密钥时仍不接入 VPS；不能复制个人版中继配置、证书或密钥。
- 多人版通知使用独立 `multi_private` 和固定用途 AAD。支持独立的 32 字节 Base64 `SETTINGS_ENCRYPTION_KEY`；没有该绑定时可从至少 32 字节的原 `SESSION_SECRET` 做分用途 HKDF 派生，不以 `ADMIN_TOKEN` 作为通知派生根。原 `fd` 绑定满足此条件，无需新增或更改绑定。
- 多人版继续使用原用户 PBKDF2-SHA256 100000 次和 `admin_session` Cookie；不替换为个人版密码 pepper、认证表或全局会话撤销逻辑。
- 用户、角色、停用状态、配额、子域名、邀请码、独立推流与用户 DNS 仍属于多人版。升级不新增用户、不改密码、不重建 DNS、不启用历史孤立线路。
- Bot 只做通知，不加入入站管理或接管既有 webhook。VPS 服务、配置、证书、配额与重启不属于本轮。

## 验收与复现

- 最终 `CI=1 npm run check` 已通过：339 项自动测试、20 项浏览器测试，零失败／跳过；依赖审计零漏洞。最终发布包复验结果见发布记录。
- 使用真实 workerd `2026-11-24`，按 `fd` 的 `compatibility_date = 2026-10-17`、空 flags 验证生产入口，不依赖 `nodejs_compat`。
- 原 `fd` 全库私有副本：初始 22 张业务表／601 条记录、发布前最新 22 张表／602 条记录，两个副本都通过 130 项隔离检查；比较全部原列／值、显式索引、旧会话与跨实例撤销，并测试路由 CRUD、加密 TG 和改密。所有出站请求均被拦截，实际出站次数为 0。发布后再次核对，原 602 条记录全部保留。
- D1 自己维护 `_cf_KV`，它不在 22 张业务表快照中，不能通过 D1 SQL API 重建；验收脚本仅恢复完整业务快照，不删除或改写内部元数据。
- 私有快照与报告只在 `/tmp/opencode/emby-multi-sync-20261124/` 的受限目录保存，不放入仓库、日志输出或公开发布包。

```bash
npm ci
CI=1 npm run check
# 仅在持有受保护的 fd 快照时显式执行；不连接生产 D1。
npm run test:multi:snapshot -- /path/to/private-fd-snapshot dist/multi.mjs
```

合成协议和隔离 D1 检查不等于真实媒体播放通过。公网登录、真实起播、拖动、长播及实际通知送达仍由用户验收；不能因此调整个人版既有线路模式或降低站点安全策略。
