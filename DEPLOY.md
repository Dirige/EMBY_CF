# Cloudflare Worker Emby 反向代理部署教程

## 功能说明

这是一个带有反向代理功能的Cloudflare Worker脚本，具有以下特点：

- 支持Emby服务器反向代理
- 支持WebSocket连接
- 支持重定向处理
- 支持D1数据库统计功能（播放次数和获取链接次数）
- 集成了前端页面，提供使用指南

## 部署方式

### 方式一：GitHub 一键部署

1. **Fork 仓库**：
   - 访问 [GitHub 仓库](https://github.com/yourusername/emby-proxy-worker)（请替换为实际仓库地址）
   - 点击 "Fork" 按钮创建自己的副本

2. **配置 Cloudflare API 令牌**：
   - 登录 Cloudflare 控制台
   - 点击右上角头像 → "My Profile" → "API Tokens"
   - 点击 "Create Token"
   - 选择 "Edit Cloudflare Workers"
   - 按照提示创建 API 令牌并保存

3. **配置仓库 Secrets**：
   - 在你的 GitHub 仓库中，点击 "Settings" → "Secrets and variables" → "Actions"
   - 点击 "New repository secret"
   - 添加以下 Secrets：
     - `CLOUDFLARE_API_TOKEN`：你的 Cloudflare API 令牌
     - `CLOUDFLARE_ACCOUNT_ID`：你的 Cloudflare 账户 ID（可在 Workers 页面查看）
     - `CLOUDFLARE_WORKER_NAME`：你想要创建的 Worker 名称

4. **触发部署**：
   - 在仓库页面，点击 "Actions"
   - 选择 "Deploy to Cloudflare Workers"
   - 点击 "Run workflow"
   - 等待部署完成

5. **配置 D1 数据库**：
   - 部署完成后，登录 Cloudflare 控制台
   - 按照下方 "方式二" 中的步骤 4 配置 D1 数据库

### 方式二：手动部署

#### 1. 准备工作

1. 注册并登录 [Cloudflare](https://dash.cloudflare.com/) 账号
2. 确保你有一个已验证的域名（可以使用Cloudflare提供的免费子域名）

#### 2. 创建Worker

1. 在Cloudflare控制台中，点击左侧菜单的 "Workers & Pages"
2. 点击 "Create Application" 按钮
3. 选择 "Create Worker"
4. 为你的Worker取一个名称，然后点击 "Deploy"
5. 部署完成后，点击 "Edit Code"

#### 3. 上传代码

1. 删除默认的Worker代码
2. 将 `worker.js` 文件中的所有内容复制粘贴到编辑框中
3. 点击 "Save and Deploy"

#### 4. 配置D1数据库（可选）

如果需要启用统计功能，需要配置D1数据库：

1. 在Cloudflare控制台中，点击左侧菜单的 "Workers & Pages"
2. 点击 "D1"
3. 点击 "Create Database"
4. 为数据库取一个名称，然后点击 "Create"
5. 等待数据库创建完成后，点击数据库名称进入详情页
6. 在 "Query" 标签页中，执行以下SQL语句创建表：

**注意：只复制下面的SQL语句，不要包括```sql和```标记**

```sql
CREATE TABLE IF NOT EXISTS auto_emby_daily_stats (
    date TEXT PRIMARY KEY,
    playing_count INTEGER DEFAULT 0,
    playback_info_count INTEGER DEFAULT 0
);
```

**复制以上SQL语句到Query编辑器中执行**

7. 回到Worker编辑页面，点击 "Settings" 标签
8. 点击 "Variables"
9. 点击 "Add binding"
10. 选择 "D1 Database" 作为绑定类型
11. 变量名称填写为 `DB`
12. 选择你刚刚创建的数据库
13. 点击 "Save"

#### 5. 配置自定义域名（可选）

1. 在Worker编辑页面，点击 "Triggers" 标签
2. 点击 "Add Custom Domain"
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
- `https://auto.embys.dpdns.org/http://emby.com`
- `https://auto.embys.dpdns.org/https://emby.com:8096`

### 高级配置

1. **重定向白名单**：在 `MANUAL_REDIRECT_DOMAINS` 数组中添加需要直连的域名
2. **域名代理规则**：在 `DOMAIN_PROXY_RULES` 对象中配置被封锁域名的代理服务器
3. **日本节点处理**：`JP_COLOS` 数组定义了日本的Cloudflare节点，来自这些节点的流量会应用特殊规则

## 统计功能

当启用D1数据库后，系统会自动统计：
- 播放次数（`/Sessions/Playing` 接口调用）
- 获取链接次数（`/PlaybackInfo` 接口调用）

统计数据按北京时间（UTC+8）按天存储。

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

## 故障排查

### 常见问题

1. **无法访问Worker**：检查Worker是否已部署成功，域名是否正确配置
2. **代理失败**：检查目标Emby服务器是否可访问，防火墙是否允许Worker的IP访问
3. **统计功能不工作**：检查D1数据库是否正确绑定，表结构是否创建
4. **WebSocket连接失败**：确保目标Emby服务器支持WebSocket，Worker配置正确
5. **GitHub部署失败**：检查API令牌权限，确保账户ID正确

### 查看日志

在Worker编辑页面，点击 "Logs" 标签可以查看实时日志，帮助排查问题。

## 更新日志

- **版本 2.5**：集成D1数据库统计功能，优化重定向处理，集成前端页面
- **版本 2.0**：优化性能，修复重定向问题
- **版本 1.0**：初始版本，基础反向代理功能

---

**声明**：本工具仅用于学习和研究目的，请勿用于非法用途。使用本工具产生的一切后果由使用者自行承担。