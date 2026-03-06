# Cloudflare Worker Emby 反向代理

一个功能强大的 Cloudflare Worker 反向代理脚本，专为 Emby 服务器设计，支持 WebSocket 连接和 D1 数据库统计功能。

## 功能特性

- ✅ 支持 Emby 服务器反向代理
- ✅ 支持 WebSocket 连接
- ✅ 智能重定向处理
- ✅ D1 数据库统计功能
- ✅ 集成前端使用指南
- ✅ 支持自定义域名
- ✅ 一键部署到 Cloudflare Workers

## 统计功能

- **播放次数**：记录 `/Sessions/Playing` 接口调用
- **获取链接次数**：记录 `/PlaybackInfo` 接口调用
- **直接访问 `/stats` 端点查看最新的统计数据**
- **数据存储**：按北京时间（UTC+8）按天存储
- **数据展示**：在前端页面实时显示统计数据

## 部署方式

### 方式一：Cloudflare 一键部署

1. Fork 本仓库
2. 配置 Cloudflare API 令牌
3. 配置仓库 Secrets
4. 触发 GitHub Actions 工作流

详细步骤请查看 [DEPLOY.md](DEPLOY.md) 文件。

### 方式二：手动部署

1. 在 Cloudflare 控制台创建 Worker
2. 上传 `worker.js` 代码
3. 配置 D1 数据库（可选）
4. 配置自定义域名（可选）

详细步骤请查看 [DEPLOY.md](DEPLOY.md) 文件。

## 使用方法

访问你的 Worker 域名，将会看到使用指南页面。

反向代理的使用格式：

```
https://你的worker域名/你的emby服务器地址:端口
```

例如：
- `https://example.com/http://emby.com`
- `https://example.comhttps://emby.com:8096`

## 高级配置

1. **重定向白名单**：在 `MANUAL_REDIRECT_DOMAINS` 数组中添加需要直连的域名
2. **域名代理规则**：在 `DOMAIN_PROXY_RULES` 对象中配置被封锁域名的代理服务器
3. **日本节点处理**：`JP_COLOS` 数组定义了日本的 Cloudflare 节点，来自这些节点的流量会应用特殊规则

## 项目结构

```
├── worker.js          # Cloudflare Worker 主脚本
├── DEPLOY.md          # 部署教程
├── README.md          # 项目说明
└── .github/workflows/ # GitHub Actions 工作流
    └── main.yml       # 部署配置
```

## 故障排查

- **无法访问 Worker**：检查 Worker 是否已部署成功，域名是否正确配置
- **代理失败**：检查目标 Emby 服务器是否可访问，防火墙是否允许 Worker 的 IP 访问
- **统计功能不工作**：检查 D1 数据库是否正确绑定，表结构是否创建
- **WebSocket 连接失败**：确保目标 Emby 服务器支持 WebSocket，Worker 配置正确

## 更新日志

- **版本 2.5**：集成 D1 数据库统计功能，优化重定向处理，集成前端页面
- **版本 2.0**：优化性能，修复重定向问题
- **版本 1.0**：初始版本，基础反向代理功能

## 声明

本工具仅用于学习和研究目的，请勿用于非法用途。使用本工具产生的一切后果由使用者自行承担。

## 交流反馈

- **反馈群组**：[https://t.me/Dirige_Proxy](https://t.me/Dirige_Proxy)
- 欢迎加入群组讨论使用问题和功能建议

## 相关服务
- **已部署好可直接食用地址**
- **通用反代地址**：https://fd.dirige.de5.net（可替换为您自己的域名）
- **EMOS 反代域名**：https://emos.dirige.de5.net（可替换为您自己的域名）

## EMOS 反代部署教程

### 功能特性

- ✅ 支持 EMOS 服务器反向代理
- ✅ 支持 WebSocket 连接
- ✅ 延迟检测功能
- ✅ 智能重定向处理
- ✅ 设备信息统计
- ✅ 仅限中国大陆用户访问

### 部署步骤

1. **Fork 本仓库**
2. **修改 emos反代.js 文件**：
   - 修改 `target` 为您的 EMOS 服务器地址
   - 修改 `proxyId` 和 `proxyName` 为您的信息
   - 可根据需要调整 `imageCacheMaxAge` 缓存时间
3. **手动部署到 Cloudflare Workers**：
   - 登录 Cloudflare 控制台
   - 点击 "Workers & Pages"
   - 点击 "Create Application"（创建应用程序） → "Create Worker"(从hello world开始)
   - 为 Worker 取一个名称（必须符合 Cloudflare 的命名要求）
   - 部署完成后，点击 "Edit Code"（部署）
   - 删除默认代码，将 `emos反代.js` 文件中的内容复制粘贴到编辑框
   - 点击 "Save and Deploy"
4. **配置自定义域名**（可选）

### 注意事项

- EMOS 反代默认仅限中国大陆用户访问
- 请确保您的 EMOS 服务器地址正确配置
- Worker 名称必须符合 Cloudflare 的命名要求（小写、字母数字、仅含破折号）
- 可根据需要修改 `MANUAL_REDIRECT_DOMAINS` 数组，添加需要直连的域名

### 使用方法

访问您的 EMOS 反代域名，将会看到延迟检测页面，显示您的网络连接状态。

反向代理的使用格式：

```
https://你的emos反代域名/emby
```

例如：
- `https://emos.example.com/emby`

## 许可证

MIT License
