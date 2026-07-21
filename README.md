# Emby 反向代理 Worker

<p align="center">
  <strong>基于 Cloudflare Worker 的 Emby 反向代理，支持别名管理、自动测速、多线路故障转移、DNS一键配置</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Emby-Media%20Server-52B54B?logo=emby&logoColor=white" alt="Emby">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License">
</p>

---

## ✨ 核心特性

| 特性 | 说明 |
|:----:|------|
| 🎯 别名管理 | 通过短路径 `/别名` 快捷访问 Emby 服务，支持多线路配置 |
| ⚡ 自动测速 | 边缘节点和本地网络双重测速，自动排序选择最优域名 |
| 🔄 DNS一键配置 | 测速完成后一键将最优域名配置到 Cloudflare DNS 记录 |
| 🔄 故障转移 | 线路不可用时自动切换到下一条（502/503/504 自动 failover） |
| 📊 使用统计 | 记录播放次数、链接获取次数，支持按天查看 |
| 🌐 优选域名管理 | 内置优选域名列表，支持添加自定义域名，内置域名可编辑删除 |
| 🛡️ 安全防护 | 管理后台密码保护、PikPak 域名自动重定向、恶意请求拦截 |
| 🎨 现代化 UI | 深蓝渐变风格管理后台，卡片式路由管理 |
| 💾 D1 数据库 | 数据持久化存储，自动建表，无需手动初始化 |
| 🔌 WebSocket 支持 | 完整支持 WebSocket 代理，满足实时通信需求 |
| 🌍 全球加速 | 利用 Cloudflare 全球边缘节点，就近访问加速 |

---

## 🚀 快速开始

两种部署方式任选其一：

- 👉 [手动部署教程](./DEPLOY.md#方式一手动部署推荐新手) — 适合新手，全程网页操作
- 👉 [GitHub Actions 自动部署](./DEPLOY.md#方式二github-actions-自动部署) — 适合开发者，Fork 即用

---

## 📖 使用方式

### 🔗 直接代理

```
https://emby.example.com/https://emby.example.com:8096
```

### 🏷️ 别名代理（推荐）

1. 登录管理后台 `/admin`
2. 添加路由：路径 `myemby`，目标 `https://emby.example.com:8096`
3. 访问 `https://emby.example.com/myemby`

### 🛤️ 多线路配置

目标地址填写多个 URL（逗号分隔）：

```
https://emby1.example.com:8096,https://emby2.example.com:8096
```

系统会自动测速并选择延迟最低的线路。

### 🌐 优选域名测速与 DNS 一键配置

1. 进入管理后台的"优选域名管理"区域
2. 点击"开始测速"，系统会自动测试所有优选域名的延迟
3. 测速完成后，点击"一键替换 DNS"
4. 选择 Cloudflare Zone，输入 DNS 名称
5. 点击"替换"，最优域名自动配置到 DNS 记录

---

## 📁 项目结构

```
├── worker.js          # 主 Worker 脚本
├── wrangler.toml      # Wrangler 配置文件
├── DEPLOY.md          # 详细部署教程
├── .github/
│   └── workflows/
│       └── deploy.yml # GitHub Actions 自动部署
└── .gitignore
```

---

## ⚙️ 环境变量

| 变量名 | 必填 | 说明 |
|--------|:----:|------|
| `ADMIN_TOKEN` | ✅ | 管理后台登录密钥 |
| `BASE_DOMAIN` | ✅ | 你的域名（如 `example.com`） |
| `CF_API_TOKEN` | ❌ | Cloudflare API Token（用于 DNS 一键配置） |
| `CF_ZONE_ID` | ❌ | Cloudflare Zone ID（用于 DNS 一键配置） |
| `CF_ACCOUNT_ID` | ❌ | Cloudflare Account ID（用于获取 Zone 列表） |
| `DNS_RECORD_NAME` | ❌ | DNS 记录名称（默认: `emby`） |

### 获取 Cloudflare API Token

1. 登录 Cloudflare Dashboard
2. 右上角头像 → 我的个人资料 → API 令牌
3. 创建令牌，权限配置：
   - **Account - Workers Scripts - Edit**
   - **Account - D1 - Edit**
   - **Zone - Zone Settings - Read**
   - **Zone - DNS - Edit**

---

## 🔗 访问地址

| 页面 | 地址 |
|------|------|
| 🏠 首页 | `https://emby.example.com/` |
| 🔐 管理后台 | `https://emby.example.com/admin` |
| 📊 统计 | `https://emby.example.com/stats` |
| 💚 健康检查 | `https://emby.example.com/health` |

---

## 📝 更新日志

### v3.3-enhanced (2026-05)

- 🌐 新增优选域名管理功能，内置域名可编辑删除
- ⚡ 边缘节点 + 本地网络双重测速
- 🔄 DNS 一键配置功能，测速完成后自动替换 DNS 记录
- 🎨 合并优选域名列表和测速结果为统一表格
- 💾 自动建表，D1 数据库初始化
- 🔌 完整 WebSocket 代理支持
- 🛡️ 增强安全防护，支持 PikPak 域名自动重定向
- 📊 改进使用统计，支持按天查看播放和链接获取次数

---

## 📄 许可证

MIT License
