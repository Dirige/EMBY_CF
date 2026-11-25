# fd 多轮同步发布包（2026-11-24）

- Worker：`fd`，版本 `v6.8.11-multi-refactor.3`，100% 流量。
- 发布版本 ID：`82eb4768-8589-438b-beb5-a230bc560299`。
- 原／代码回滚版本：`79de3cb9-518a-4823-83f0-03ebc2b7ecf0`。
- `multi.mjs`：400670 字节，SHA-256 `43d58cb8e51948ea9bf8cafa69b01c3301966c2b0aafd14afcd9670d2f707c45`；与上传后和发布后回读代码一致。
- 339 自动、20 浏览器、130 项最新全库隔离检查通过；原 22 表／602 条记录、绑定、运行时、智能放置、Cron 和 DNS 保留。
- `manifest.json` 只含安全的两版发布摘要；`SHA256SUMS` 可校验本目录内容。包内没有原绑定值、用户数据库、Token、密码、证书或私有验收报告。

同步差异见 [MULTI-SYNC-CHECKLIST.md](../../docs/MULTI-SYNC-CHECKLIST.md)，公网复核与回滚安全边界见 [MULTI-PUBLIC-ACCEPTANCE.md](../../docs/MULTI-PUBLIC-ACCEPTANCE.md)。不能直接使用旧部署模板覆盖现有配置。

回滚只切代码，不还原 D1。旧版不理解新增网页内置管理员密码、epoch 或加密 TG；上线后若用户已改密／保存通知，须先评估恢复旧认证与通知行为的影响。真实媒体播放仍由用户验收。
