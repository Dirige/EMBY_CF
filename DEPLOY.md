> [!NOTE]
> 这是一份为**完全零基础**的新手准备的超详细部署教程。请像完成任务清单一样，一步一步跟着操作！

# 🚀 Emby 代理服务 部署教程

---

## 📋 准备工作

在开始之前，我们需要准备好以下两样东西：

- [ ] **一个 Cloudflare 账号**（免费注册，用于运行我们的代码）
- [ ] **一个你自己的域名**（需要将域名的 DNS 服务器托管到 Cloudflare）

---

## 第一步：注册 Cloudflare 账号 ☁️

Cloudflare 是一个全球知名的免费 CDN 和代码托管平台，我们的代理服务就运行在它上面。

1. 🌐 打开浏览器，访问注册页面：<https://dash.cloudflare.com/sign-up>
2. ✉️ 输入你的**邮箱（Email）**和**密码（Password）**
3. ✅ 点击 **注册（Create Account）**
4. 📬 登录你的邮箱，找到 Cloudflare 发来的验证邮件，点击链接完成验证

---

## 第二步：添加域名到 Cloudflare 🌍

你需要把自己的域名交给 Cloudflare 管理，这样才能给代理服务分配网址。

1. 🔑 登录 **Cloudflare 控制台（Dashboard）**
2. ➕ 在左侧菜单点击 **添加站点（Add Site）**
3. 📝 输入你的域名（例如：`example.com`），然后点击继续（如果没有域名可以去注册一个免费的二级域名，注册地址：https://my.dnshe.com/index.php?m=domain_hub&view=tools&invite_code=3F9YSLFPW2JH   ）
4. 🆓 页面会让你选择套餐，请把网页往下拉，选择 **免费（Free）** 套餐，然后点击 **继续（Continue）**
5. ⏭️ Cloudflare 会扫描你现有的 DNS 记录，直接点击 **继续（Continue）**
6. 🔄 **最重要的一步：** 页面会显示两条 Cloudflare 提供的 **名称服务器（Nameservers，简称 NS）**（通常长这样：`xxx.ns.cloudflare.com`）
7. 🖥️ 登录你购买域名的网站（比如阿里云、腾讯云、Namesilo 等）的后台，找到"修改 DNS 服务器"的地方，把原来的 NS 替换成 Cloudflare 提供的这两条
8. ✅ 替换完成后，回到 Cloudflare 页面，点击 **完成，检查名称服务器（Done, check nameservers）**
9. ⏳ 等待生效（通常需要几分钟到几个小时，Cloudflare 会发邮件通知你生效成功）

---

## 第三步：获取必要信息 🔑

我们需要获取必要的信息，以便后续部署使用。

### 1️⃣ 获取 Account ID

1. 在 Cloudflare 控制台，点击你刚刚添加成功的**域名**
2. 在右侧的 **概览（Overview）** 页面，往下滚动
3. 找到 **账户 ID（Account ID）**，点击旁边的 **复制（Copy）** 按钮
4. 📋 把它保存到电脑的记事本里，后面要用

### 2️⃣ 创建 API Token（可选，用于 DNS 一键配置功能）

> [!TIP]
> 如果不需要"一键替换 DNS"功能，可以跳过此步骤。

1. 👤 点击右上角的**用户头像**，在下拉菜单中点击 **我的个人资料（My Profile）**
2. 🔑 在左侧菜单点击 **API 令牌（API Tokens）**
3. ➕ 点击蓝色的 **创建令牌（Create Token）** 按钮
4. 📜 拉到最下方，找到"自定义令牌（Custom token）"，点击右侧的 **开始使用（Get started）**
5. 📛 **令牌名称（Token name）**：随便填，比如 `emby-proxy-token`
6. 🔐 **权限（Permissions）** 部分，需要添加以下 **4** 个权限（点击"添加更多（Add more）"来增加行）：

   | 选择范围 | 选择项目 | 选择权限 |
   | :--- | :--- | :--- |
   | 账户（Account） | Workers脚本 | 编辑（Edit） |
   | 账户（Account） | D1 | 编辑（Edit） |
   | 区域（Zone） | 区域设置 | 读取（Read） |
   | 区域（Zone） | DNS | 编辑（Edit） |

7. ✨ 点击页面底部的 **继续以显示摘要（Continue to summary）**
8. 🎯 点击 **创建令牌（Create Token）**
9. ⚠️ **重要：** 页面会显示一串很长的字符，这就是你的 API Token。**立刻复制并保存到记事本**（离开页面后就再也看不到了！）

---

## 第四步：部署代理服务 🛠️

我们提供两种部署方式，**推荐新手使用方式一**。如果你熟悉 GitHub，也可以选择方式二。

---

### 方式一：手动部署（推荐新手 👶）

#### 1️⃣ 创建 Worker

1. 回到 Cloudflare 主页，在左侧菜单点击 **计算（Compute）** → **Workers 和 Pages（Workers & Pages）**
2. 点击蓝色的 **创建（Create）** 按钮
3. 选择 **创建 Worker（Create Worker）**
4. 给它起个名字，比如 `emby-proxy`
5. 点击右下角的 **部署（Deploy）**

#### 2️⃣ 粘贴代码

1. 部署完成后，点击 **编辑代码（Edit code）** 按钮
2. 页面左侧会有一个代码编辑区，把里面的默认代码**全部删除**
3. 打开我们项目里的 `worker.js` 文件，复制里面**所有的内容**
4. 粘贴到刚刚清空的 Cloudflare 代码编辑区里
5. 点击右上角的 **保存并部署（Save and deploy）**

#### 3️⃣ 创建 D1 数据库

1. 点击左上角的返回箭头，回到 Cloudflare 的主菜单
2. 在左侧菜单点击 **存储和数据库（Storage & Databases）** → **D1 SQL 数据库（D1 SQL Database）**
3. 点击 **创建数据库（Create database）**
4. 数据库名称填入：`emby-proxy-db`
5. 点击 **创建（Create）**

> [!TIP]
> 🎉 **不需要手动建表！** 程序会在你第一次访问时**自动完成数据库初始化**，省心省力！

#### 4️⃣ 绑定数据库到 Worker

1. 在左侧菜单回到 **计算（Compute）** → **Workers 和 Pages（Workers & Pages）**，点击你刚才创建的 `emby-proxy`
2. 点击顶部的 **设置（Settings）** 选项卡
3. 在左侧子菜单选择 **绑定（Bindings）**
4. 点击右侧的 **添加绑定（Add binding）** 按钮
5. **绑定类型（Binding type）** 选择 **D1 数据库（D1 database）**
6. **变量名称（Variable name）** 填入：`DB`（⚠️ **必须是大写字母 D 和 B**）
7. **D1 数据库（D1 database）** 选择你刚才创建的 `emby-proxy-db`
8. 点击 **保存（Save）**

#### 5️⃣ 配置环境变量

1. 在同一个 **设置（Settings）** 页面下，点击左侧的 **变量和机密（Variables and Secrets）**
2. 点击 **添加（Add）** 按钮，依次添加以下 **2** 个变量（注意大小写，**必须一模一样**）：

   | 变量名称 | 填入值 | 是否加密 |
   | :--- | :--- | :--- |
   | `ADMIN_TOKEN` | 你自己编一个后台登录密钥（比如 `MyP@ss123`） | ✅ 加密 |
   | `BASE_DOMAIN` | 你的域名（比如 `example.com`） | ❌ 不加密 |

3. （可选）如果你需要 DNS 一键配置功能，还需要添加：

   | 变量名称 | 填入值 | 是否加密 |
   | :--- | :--- | :--- |
   | `CF_API_TOKEN` | 第三步获取的 API Token | ✅ 加密 |
   | `CF_ZONE_ID` | 你的 Zone ID（在域名概览页面底部） | ❌ 不加密 |
   | `CF_ACCOUNT_ID` | 你的 Account ID | ❌ 不加密 |
   | `DNS_RECORD_NAME` | DNS 记录名称（默认 `emby`，可不填） | ❌ 不加密 |

4. 添加完成后，点击底部的 **保存并部署（Save and deploy）**

#### 6️⃣ 绑定自定义域名（路由方式）

> [!WARNING]
> ⚠️ 对于 Emby 反向代理场景，必须使用**路由（Route）**方式绑定域名，而不是"添加自定义域（Add Custom Domain）"快捷方式。这样才能确保所有请求都正确经过 Worker 处理。

1. **首先添加 DNS 记录：**
   - 回到 Cloudflare 主页，点击你的**域名**
   - 在左侧菜单点击 **DNS** → **记录（Records）**
   - 点击 **添加记录（Add record）**
   - 类型选择 **CNAME**
   - 名称填写 `emby`（或你想要的子域名前缀）
   - 目标填写你的根域名（如 `example.com`）
   - 代理状态开启（**橙色云朵** ☁️）
   - 点击 **保存（Save）**

2. **然后绑定路由到 Worker：**
   - 回到 **计算（Compute）** → **Workers 和 Pages（Workers & Pages）**，点击你的 Worker
   - 在 **设置（Settings）** 页面下，点击左侧的 **域和路由（Domains & Routes）**
   - 点击右侧的 **添加路由（Add route）**
   - **路由（Route）** 填写 `emby.example.com/*`（替换为你的实际域名和子域名）
   - **Worker** 选择当前 Worker（`emby-proxy`）
   - 点击 **保存（Save）**

> [!TIP]
> 💡 Cloudflare Dashboard UI 可能在不同版本间有所调整。如果找不到对应菜单项，可以尝试在左侧菜单中搜索相关关键词，或参考 Cloudflare 官方文档获取最新路径。

#### 7️⃣ 开启 Node.js 兼容性

1. 在 **设置（Settings）** 页面下，点击左侧的 **兼容性（Compatibility）**（如果找不到，尝试点击 **运行时（Runtime）** → **兼容性标志（Compatibility flags）**）
2. 找到 **兼容性标志（Compatibility flags）**，点击 **添加兼容性标志（Add compatibility flag）**
3. 输入并选择 `nodejs_compat`
4. 点击底部的 **保存并部署（Save and deploy）**

> [!TIP]
> 💡 **推荐方式：** 由于 Cloudflare Dashboard UI 可能在不同版本间有所调整，如果找不到上述菜单，推荐直接通过修改 `wrangler.toml` 配置文件来添加兼容性标志。在 `wrangler.toml` 中添加以下内容即可：
> ```
> compatibility_flags = ["nodejs_compat"]
> ```
> 这样无论是手动部署还是 GitHub Actions 部署，都能自动生效，无需在 Dashboard 中手动操作。

#### 8️⃣ 关闭机器人攻击模式

> [!WARNING]
> ⚠️ 这一步非常重要！如果不关闭，Emby 播放视频时可能会报错或一直转圈！

Cloudflare Dashboard UI 可能在不同版本间有所调整，请根据你的界面选择对应路径：

**新版 Dashboard：**
1. 回到 Cloudflare 主页，点击你的域名
2. 在左侧菜单点击 **安全性（Security）** → **设置（Settings）**
3. 找到 **筛选 Bot 流量（Bot traffic）** 部分
4. 找到 **Bot Fight Mode**，把它**关闭（Off）**

**旧版 Dashboard：**
1. 回到 Cloudflare 主页，点击你的域名
2. 在左侧菜单点击 **安全性（Security）** → **机器人（Bots）**
3. 找到 **Bot Fight Mode**，选择 **Off**

> [!TIP]
> 💡 如果以上路径都找不到，可以尝试在左侧菜单搜索栏中搜索 "Bot Fight Mode" 来快速定位。

---

### 方式二：GitHub Actions 自动部署 🤖

如果你熟悉 GitHub，可以通过 Actions 自动部署，免去手动操作的麻烦。

#### 1️⃣ Fork 本仓库

1. 打开本项目的 GitHub 页面
2. 点击页面右上角的 **Fork** 按钮
3. 选择你的账号，点击 **Create fork**

#### 2️⃣ 配置 Secrets

1. 在你 Fork 后的仓库页面，点击顶部的 **设置（Settings）**
2. 在左侧菜单展开 **安全项（Secrets and variables）** → 点击 **动作（Actions）**
3. 点击 **新建存储库机密（New repository secret）**，依次添加以下 **4** 个必填机密：

   | Secret 名称 | 说明 | 是否必填 |
   | :--- | :--- | :--- |
   | `CF_API_TOKEN` | 第三步获取的 Cloudflare API Token | ✅ |
   | `CF_ACCOUNT_ID` | 第三步获取的 Cloudflare Account ID | ✅ |
   | `ADMIN_TOKEN` | 你自定义的后台管理密钥 | ✅ |
   | `BASE_DOMAIN` | 你的域名（如 `example.com`） | ✅ |

4. （可选）如果你需要 DNS 一键配置功能，还可以添加以下机密：

   | Secret 名称 | 说明 | 是否必填 |
   | :--- | :--- | :--- |
   | `CF_ZONE_ID` | 你的 Cloudflare Zone ID | ❌ |
   | `CF_WORKER_NAME` | Worker 名称（默认 `emby-proxy`） | ❌ |
   | `DNS_RECORD_NAME` | DNS 记录名称（默认 `emby`） | ❌ |

#### 3️⃣ 创建 D1 数据库

1. 登录 Cloudflare 控制台
2. 在左侧菜单点击 **存储和数据库（Storage & Databases）** → **D1 SQL 数据库（D1 SQL Database）**
3. 点击 **创建数据库（Create database）**，名称填入 `emby-proxy-db`
4. 创建完成后，进入数据库详情页，复制 **数据库 ID（Database ID）**
5. 回到你 Fork 的 GitHub 仓库，打开 `wrangler.toml` 文件
6. 找到 `database_id = ` 这一行，把复制的 Database ID 粘贴到引号里面
7. 提交修改（Commit changes）

> [!TIP]
> 🎉 同样**不需要手动建表**，程序会在第一次访问时自动初始化数据库！

#### 4️⃣ 触发部署

> [!NOTE]
> 如果看到 "Node.js 20 actions are deprecated" 相关警告，GitHub Actions 已自动切换到更新的 Node.js 版本，不影响正常使用。

1. 在仓库顶部点击 **动作（Actions）** 标签
2. 左侧选择 **部署到 Cloudflare Workers**
3. 点击右侧的 **运行工作流（Run workflow）**
4. 等待绿色的打勾 ✔️ 出现，就部署成功了！

---

## 第五步：使用你的代理 🎉

恭喜你，部署完成！下面来学习如何使用。

### 🌐 访问地址

| 页面 | 地址 |
| :--- | :--- |
| 🏠 首页 | `https://emby.你的域名.com/` |
| 🔐 管理后台 | `https://emby.你的域名.com/admin` |
| 📊 统计 | `https://emby.你的域名.com/stats` |

### ➕ 添加路由

1. 访问管理后台 `https://emby.你的域名.com/admin`，输入密钥登录
2. 点击 **「添加路由」**
3. 填写以下信息：

   | 字段 | 填写示例 | 说明 |
   | :--- | :--- | :--- |
   | 备注名 | 我的Emby | 方便自己识别 |
   | 路径 | myemby | 访问时的短路径 |
   | 目标地址 | `https://emby.example.com:8096` | Emby 服务器的真实地址 |

4. 💡 **多线路配置：** 目标地址用英文逗号分隔多个 URL，系统会自动测速选择最优线路

   ```
   https://emby1.example.com:8096,https://emby2.example.com:8096
   ```

5. 保存后即可通过 `/myemby` 访问

### 🌐 优选域名测速与 DNS 一键配置

1. 进入管理后台的"优选域名管理"区域
2. 点击"开始测速"，系统会自动测试所有优选域名的延迟
3. 测速完成后，点击"一键替换 DNS"
4. 选择 Cloudflare Zone，输入 DNS 名称
5. 点击"替换"，最优域名自动配置到 DNS 记录

### 📖 使用示例

- **直接代理：** `https://emby.example.com/https://emby.example.com:8096`
- **别名代理：** `https://emby.example.com/myemby`

---

## ❓ 常见问题 🔧

**Q: 提示 "D1 数据库未绑定"**
> 🔑 检查 Worker Settings → Bindings，变量名**必须是大写** `DB`

**Q: 播放视频报错或一直转圈**
> 🤖 关闭 Cloudflare 的 **Bot Fight Mode**，参考方式一第 8 步（关闭机器人攻击模式）

**Q: 提示 "Error 1001" 或 DNS 解析错误**
> 🌐 检查自定义域名是否正确绑定，DNS 记录（CNAME）是否已生效，路由（Route）是否正确配置到 Worker

**Q: 后台登录密钥错误**
> 🔐 输入的是你设置的**具体密钥**（比如 `MyP@ss123`），不是变量名 `ADMIN_TOKEN`

**Q: 修改代码后没有生效**
> 🚀 每次修改后**必须**点击 **Save and deploy**

**Q: 多线路怎么配置？**
> 🛤️ 目标地址用英文逗号分隔多个 URL，系统会自动测速选最优

**Q: DNS 配置显示"请在环境变量中配置 CF_API_TOKEN"**
> 🔑 确保已正确配置 `CF_API_TOKEN`、`CF_ZONE_ID` 和 `CF_ACCOUNT_ID` 环境变量，并且 API Token 有 Zone 和 DNS 的读写权限

**Q: 优选域名测速一直失败**
> 🌐 检查网络连接，或者优选域名本身不可用。可以尝试手动访问 `https://cf.090227.xyz/cdn-cgi/trace` 查看是否正常

**Q: 如何开启 nodejs_compat 兼容性标志？**
> ⚙️ 手动部署请参考方式一第 7 步（开启 Node.js 兼容性）；GitHub Actions 部署**不会自动开启**，需要在 `wrangler.toml` 配置文件中手动添加 `compatibility_flags = ["nodejs_compat"]`，提交后重新触发部署即可生效

**Q: 支持 WebSocket 连接吗？**
> 🔌 支持！代理服务完整支持 WebSocket 代理，Emby 的实时通信功能（如播放状态同步）可以正常使用

**Q: 如何更新到最新版本？**
> 📥 **手动部署：** 用最新的 `worker.js` 代码替换 Cloudflare 编辑器中的旧代码，点击保存并部署
> 📥 **GitHub Actions：** 同步上游仓库的最新代码，然后在 Actions 页面手动触发一次部署

**Q: 数据存储在哪里？**
> 💾 所有数据存储在 Cloudflare D1 数据库中，程序会在首次访问时自动建表，无需手动初始化

---

> 💖 感谢使用 Emby 代理服务！如有问题，欢迎提交 Issue 反馈。