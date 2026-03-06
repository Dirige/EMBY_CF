# Cloudflare Worker Emby 反向代理部署教程

## 功能说明

这是一个带有反向代理功能的Cloudflare Worker脚本，具有以下特点：

- 支持Emby服务器反向代理
- 支持WebSocket连接
- 支持重定向处理
- 支持D1数据库统计功能（播放次数和获取链接次数）
- 集成了前端页面，提供使用指南

## 部署方式

#### 1. 准备工作

1. 注册并登录 [Cloudflare](https://dash.cloudflare.com/) 账号
2. 确保你有一个已验证的域名（可以在DNSHE中免费注册一个域名托管到Cloudflare）
3. DNSHE地址：https://my.dnshe.com/index.php?m=domain_hub     请输入我的邀请码（ZPB06CED7F）谢谢

### 方式一：GitHub 一键部署（推荐）

1. **Fork 仓库**：
   - 访问 [GitHub 仓库](https://github.com/Dirige/EMBY_CF)
   - 点击 "Fork"按钮创建自己的副本

2. **获取 Cloudflare API 令牌**：
   - 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
   - 点击右上角头像 → "My Profile"（配置文件）→ "API Tokens"（API令牌）
   - 点击 "Create Token"（创建令牌）
   - 选择模板 "Edit Cloudflare Workers"（编辑CloudflareWorkers）
   - 设置权限后点击 "Create Token"（创建令牌）并保存令牌值

3. **配置仓库 Secrets**：
   - 在你的 GitHub 仓库中，点击 "Settings"（设置）→ "Secrets and variables"（秘密和变量）→ "Actions"（操作）
   - 点击 "New repository secret"（新建仓库密钥）
   - 添加以下 Secrets：
     - `CLOUDFLARE_API_TOKEN`：你的 Cloudflare API 令牌
     - `CLOUDFLARE_ACCOUNT_ID`：你的 Cloudflare 账户 ID（在 Cloudflare "Workers & Pages" 页面右下角）
     - `CLOUDFLARE_WORKER_NAME`：你想要创建的 Worker 名称（小写字母、数字和破折号）

4. **触发部署**：
   - 在仓库页面，点击 "Actions"（操作）标签
   - 选择 "Main Workflow "（主要工作流）
   - 点击 "Run workflow"（运行工作流）
   - 等待部署完成

5. **配置 D1 数据库**：
   - 部署完成后，登录 Cloudflare 控制台
   - 按照下方 "方式二" 中的步骤 3 配置 D1 数据库

### 方式二：手动部署



#### 1. 创建Worker

1. 登录 Cloudflare 控制台，左侧菜单点击 "Workers & Pages"
2. 点击 "Create"（创建应用程序）按钮
3. 选择 "Create Worker"（从hello world开始）
4. 为你的Worker取一个名称（例如：emby-proxy），然后点击 "Deploy"（部署）
5. 部署完成后，点击 "Edit code"（编辑代码）

#### 2. 上传代码

1. 在编辑器中删除默认的Worker代码
2. 将 `worker.js` 文件中的所有内容复制粘贴到编辑框中
3. 点击 "Save and deploy"（保存并部署）

#### 3. 配置D1数据库（可选，用于统计功能）

如果需要启用统计功能，需要配置D1数据库：

1. 在Cloudflare控制台左侧菜单点击 "Storage & databases"（存储和数据库）
2. 点击 "D1"（D1 数据库）
3. 选择 "Create a database"（创建数据库），输入数据库名称
5. 等待数据库创建完成，点击数据库名称进入详情页
6. 换到 "Console"（控制台）标签页，执行以下SQL语句创建表：

```sql
CREATE TABLE IF NOT EXISTS auto_emby_daily_stats (
    date TEXT PRIMARY KEY,
    playing_count INTEGER DEFAULT 0,
    playback_info_count INTEGER DEFAULT 0
);
```

7. 回到Worker编辑页面，点击 "Settings"（设置）标签
8. 在左侧菜单中点击 "Bindings"（绑定）
9. 点击 "Add binding"（添加绑定）
10. 选择绑定类型为 "D1 Database"（D1 数据库）
11. 变量名称填写为 `DB`
12. 选择你刚刚创建的数据库
13. 点击 "Save"（保存）

#### 4. 配置自定义域名（可选）

1. 在Worker编辑页面，点击 "Triggers"（触发器）标签
2. 在 "Custom Domains"（自定义域名）部分点击 "Add Custom Domain"（添加自定义域名）
3. 输入你想使用的域名（例如：emby-proxy.example.com）
4. 按照提示完成DNS配置

## 使用方法

### 基本用法

访问你的Worker域名，将会看到使用指南页面。

反向代理的使用格式：

```
https://你的worker域名/你的emby服务器地址:端口
```

例如：
- `https://example.com/http://emby.com`
- `https://example.com/https://emby.com:8096`

### 高级配置

1. **重定向白名单**：在 `MANUAL_REDIRECT_DOMAINS` 数组中添加需要直连的域名
2. **域名代理规则**：在 `DOMAIN_PROXY_RULES` 对象中配置被封锁域名的代理服务器
3. **日本节点处理**：`JP_COLOS` 数组定义了日本的Cloudflare节点，来自这些节点的流量会应用特殊规则

## 统计功能

当启用D1数据库后，系统会自动统计：
- 播放次数（`/Sessions/Playing` 接口调用）
- 获取链接次数（`/PlaybackInfo` 接口调用）
- 直接访问 /stats 端点查看最新的JSON数据
- 数据存储：按北京时间（UTC+8）按天存储


## GitHub 仓库结构

```
├── worker.js          # Cloudflare Worker 主脚本
├── DEPLOY.md          # 部署教程
├── README.md          # 项目说明
└── .github/workflows/ # GitHub Actions 工作流
    └── deploy.yml     # 部署配置
```

## GitHub Actions 部署配置

在 `.github/workflows/deploy.yml` 文件中配置以下内容：

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Publish to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: publish worker.js --name ${{ secrets.CLOUDFLARE_WORKER_NAME }}
```

## 注意事项

1. 请遵守相关法律法规，不要使用本工具进行违法活动
2. 合理使用资源，避免过度请求导致Cloudflare限制
3. 如遇到问题，请检查Worker日志排查错误
4. 定期备份D1数据库中的统计数据
5. GitHub Actions 部署需要配置正确的 API 令牌和账户 ID
6. Cloudflare 免费账户每天有10万次请求限制，如需更多请求请升级

## 故障排查

### 常见问题

1. **无法访问Worker**：
   - 检查Worker是否已部署成功
   - 检查自定义域名的DNS配置是否正确
   - 确保Worker路由规则已配置

2. **代理失败**：
   - 检查目标Emby服务器是否可访问
   - 确保防火墙允许Worker的IP访问
   - 查看Worker日志了解具体错误信息

3. **统计功能不工作**：
   - 检查D1数据库是否正确绑定
   - 确认数据库表结构是否创建成功
   - 查看Worker日志检查数据库操作错误

4. **WebSocket连接失败**：
   - 确保目标Emby服务器支持WebSocket
   - 检查Worker配置中的WebSocket代理设置
   - 确认没有防火墙或代理阻止WebSocket连接

5. **GitHub部署失败**：
   - 检查API令牌是否有效且权限足够
   - 确保账户ID正确（在Cloudflare控制台左下角查看）
   - 检查Worker名称格式是否符合规则（小写字母、数字、破折号）

### 查看日志

1. **在线查看**：
   - 登录 Cloudflare 控制台
   - 进入Worker详情页
   - 点击 "Logs"（日志）标签查看实时日志

2. **本地查看**（需要安装 Wrangler CLI）：
   ```bash
   wrangler tail --format pretty
   ```

## 更新日志

- **版本 2.5**：集成D1数据库统计功能，优化重定向处理，集成前端页面
- **版本 2.0**：优化性能，修复重定向问题
- **版本 1.0**：初始版本，基础反向代理功能

---

**声明**：本工具仅用于学习和研究目的，请勿用于非法用途。使用本工具产生的一切后果由使用者自行承担。