import ADMIN_CLIENT from './admin.js?text';
// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { DYN_PALETTE, PAGE_STYLE, THEME_INIT, THEME_LOGIC } from "./../../src/shared/ui/theme.js";
import { LANDING_CSS, SPEED_TOOLS } from "./../../src/editions/personal/ui/theme.js";
import { CURRENT_VERSION } from "./../../src/editions/personal/version.js";

function buildFrontendHtml(authed, { previewEdition } = {}) {
    const preview = previewEdition === 'personal' || previewEdition === 'multi';
    const multiPreview = previewEdition === 'multi';
    const rightPanel = preview ? `    <h2>快捷入口</h2>
    <p class="lp2-sub">${multiPreview ? '多人版' : '个人版'} · 本地预览</p>
    <form method="post" action="/__preview/login">
      <button class="lp2-cta" type="submit">进入${multiPreview ? '管理员' : '个人版'}工作区 <span>→</span></button>
    </form>
    ${multiPreview ? `<form method="post" action="/__preview/login?role=member" style="margin-top:12px">
      <button class="btn" style="width:100%" type="submit">验收普通用户视图</button>
    </form>` : ''}
    <nav class="lp2-links">
      <a href="http://127.0.0.1:${multiPreview ? '4273' : '4274'}/__preview"><span class="lp2-ico">🎛️</span><span class="lp2-name">切换到${multiPreview ? '个人版' : '多人版'}</span><span class="lp2-arrow">→</span></a>
    </nav>` : authed ? `    <h2>快捷入口</h2>
    <p class="lp2-sub">节点管理 · 优选线路 · 使用统计</p>
    <a class="lp2-cta" href="/admin">进入管理后台 <span>→</span></a>
    <nav class="lp2-links">
      <a href="https://t.me/+7cbXthaBajszNjI1" target="_blank" rel="noopener"><span class="lp2-ico">💬</span><span class="lp2-name">TG 群组</span><span class="lp2-arrow">↗</span></a>
      <a href="https://github.com/Dirige/EMBY_CF" target="_blank" rel="noopener"><span class="lp2-ico">🐙</span><span class="lp2-name">GitHub</span><span class="lp2-arrow">↗</span></a>
      <a href="https://yx.255432.xyz/" target="_blank" rel="noopener"><span class="lp2-ico">🛰️</span><span class="lp2-name">优选域名监测</span><span class="lp2-arrow">↗</span></a>
    </nav>` : `    <h2>管理员登录</h2>
    <p class="lp2-sub">输入登录密码进入控制台</p>
    <input type="password" id="tokenInput" class="lp2-input" placeholder="登录密码" autocomplete="current-password" maxlength="1024" onkeydown="if(event.key==='Enter')lpLogin()">
    <p id="loginErr" class="lp2-err"></p>
    <button class="lp2-cta" id="loginBtn" onclick="lpLogin()">登 录 <span>→</span></button>
    <div class="lp2-mini">
      <a href="https://t.me/+7cbXthaBajszNjI1" target="_blank" rel="noopener">💬 群组</a>
      <a href="https://github.com/Dirige/EMBY_CF" target="_blank" rel="noopener">🐙 GitHub</a>
    </div>`;
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>Emby 反向代理 · 统一入口</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}${LANDING_CSS}</style></head><body class="lp2">
<div class="lp2-bg" aria-hidden="true"><i class="lp2-photo"></i><i class="lp2-veil"></i></div>
<main class="lp2-card">
  <section class="lp2-left">
    <div class="lp2-brand"><i></i>EMBY·PROXY <span>${CURRENT_VERSION}</span></div>
    <div class="lp2-head">
      <h1>Emby <em>边缘代理</em></h1>
      <p>多源站统一入口 · 三态分流 · 边缘加速</p>
    </div>
    <div class="lp2-chips">
      <div><b>Route</b><span>媒体路由</span></div>
      <div><b>Relay</b><span>中继分流</span></div>
      <div><b>Signal</b><span>播放统计</span></div>
    </div>
  </section>
  <section class="lp2-right">
${rightPanel}
    <p class="lp2-foot">${preview ? '仅本地测试 · 未部署线上 · 请勿填写真实凭据' : '每日壁纸来自 Bing · 请妥善使用'}</p>
  </section>
</main>
<script>${THEME_LOGIC}
${authed ? "" : `async function lpLogin() {
  var t = document.getElementById('tokenInput').value;
  var err = document.getElementById('loginErr');
  var btn = document.getElementById('loginBtn');
  err.textContent = '';
  if (!t) { err.textContent = '请输入密钥'; return; }
  btn.disabled = true; btn.style.opacity = '.6';
  try {
    var r = await fetch('/admin/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) });
    var d = await r.json();
    if (d.ok) { location.href = '/admin'; return; }
    err.textContent = d.error || '登录失败';
  } catch (e) { err.textContent = '请求失败: ' + e.message; }
  btn.disabled = false; btn.style.opacity = '';
}`}
<\/script></body></html>`;
}

function buildAdminHtml() {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>管理后台</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎛️</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div id="toast"></div>
<div class="admin-bg" aria-hidden="true"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">ADMIN<span style="color:var(--accent)">·</span>CONSOLE</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <button class="btn btn-sm" id="btnDailyReport" onclick="sendReport(this)">发送日报</button>
      <a href="/" class="btn btn-sm">首页</a>
      <button class="btn btn-sm" onclick="openSettings()">设置</button>
      <button class="btn btn-sm btn-danger" onclick="logout()">退出</button>
    </div>
  </div>

  <nav class="tabbar" id="tabbar">
    <button class="tab-btn active" data-tab="overview" onclick="switchTab('overview')">📊 概览</button>
    <button class="tab-btn" data-tab="routes" onclick="switchTab('routes')">🚦 路由<span class="tab-badge" id="tabRouteCount"></span></button>
    <button class="tab-btn" data-tab="domains" onclick="switchTab('domains')">🌐 优选</button>
    <button class="tab-btn" data-tab="logs" onclick="switchTab('logs')">📜 日志</button>
  </nav>

  <div id="tab-overview" class="tab-pane">
    <div class="card">
      <div class="sec-title">使用统计 <span class="chip">CF&nbsp;ANALYTICS</span></div>
      <div id="stats-loading" class="muted"><span class="spin"></span>加载中...</div>
      <div id="stats-body" style="display:none">
        <div class="stat-row">
          <div class="stat-card"><div>今日请求</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
          <div class="stat-card"><div>今日流量</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
          <div class="stat-card"><div>今日访问</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
        </div>
        <div class="stat-row">
          <div class="stat-card"><div>中继今日请求</div><div class="stat-val" id="st-relay-req">—</div><div class="stat-sub" id="st-relay-req-sub">来源: VPS 中继</div></div>
          <div class="stat-card"><div>中继今日流量</div><div class="stat-val" id="st-relay-traffic">—</div><div class="stat-sub" id="st-relay-traffic-sub">↑源站拉取 ↓发回客户端</div></div>
        </div>
        <div id="hourly-chart"></div>
        <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
      </div>
    </div>
    <div class="card">
      <div class="sec-title">当前边缘节点 <span class="chip">EDGE</span></div>
      <div id="edge-loading" class="muted"><span class="spin"></span>正在探测...</div>
      <div id="edge-info" class="edge-box" style="display:none"></div>
    </div>
  </div>

  <div id="tab-routes" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">路由管理 <span class="chip" id="routeCount"></span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm btn-solid" onclick="openRouteModal()">添加路由</button>
      <button class="btn btn-sm" onclick="location.href='/admin/api/export'">导出配置</button>
      <button class="btn btn-sm" onclick="document.getElementById('importFile').click()">导入配置</button>
      <input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importConfig(this)">
      <div class="search-box">
        <input type="text" id="routeSearch" placeholder="搜索备注或路径..." oninput="filterRoutes()">
      </div>
    </div>
    <div class="dns-quick">
      <span class="dns-quick-tag">DNS</span>
      <input id="dnsQuickName" placeholder="记录名（留空 = BASE_DOMAIN）">
      <span class="dns-quick-arrow">→</span>
      <input id="dnsQuickTarget" placeholder="目标域名或 IP（可以直接改）">
      <button class="btn btn-sm btn-solid" id="dnsQuickSave" onclick="quickSaveDNS(this)">保存</button>
      <button class="btn btn-sm" onclick="loadQuickDNS()">刷新</button>
    </div>
    <p class="muted" id="dnsQuickMeta" style="margin:-2px 0 14px;font-size:12px">DNS 记录加载中...</p>
    <div id="routeList" class="route-grid"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">VPS 反代中继 <span class="chip" id="relayChip" style="margin-left:8px">—</span></div>
    <p class="form-hint" style="margin-bottom:14px">线路选「开」直接走 VPS；选「自动」则 Worker 优先，遇到连接故障或 IP／地区拦截时尝试 VPS，成功后短期优先 VPS；选「关」不使用 VPS。</p>
    <div class="form-group">
      <label>中继地址（含端口）</label>
      <input id="relayUrl" placeholder="例如 http://1.2.3.4:2087 或 https://relay.xxx.com:2087">
      <p class="form-hint">未下发证书时用 http，下发证书后改 https。端口须与 VPS 服务端口一致（当前 <span id="relayPortHint">2087</span>）</p>
    </div>
    <div class="form-group">
      <label>中继密钥</label>
      <input id="relaySecret" autocomplete="off" placeholder="">
      <p class="form-hint">首次填 VPS 服务端配置里的一次性引导密钥；之后可随时换新密钥，保存时自动推送到 VPS</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="relayEnabled"> 启用 VPS 中继（总开关）
      </label>
    </div>
    <details class="adv-box">
      <summary>🔐 TLS 证书（可选 · 高级）</summary>
      <label style="margin-top:12px">TLS 证书 (PEM，可选)</label>
      <textarea id="relayCert" rows="4" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12px" placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"></textarea>
      <label style="margin-top:12px">私钥 (PEM，可选)</label>
      <textarea id="relayKey" rows="4" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12px" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"></textarea>
      <p class="form-hint">留空则只推送密钥不动证书；两项都填则推送证书并自动重启 VPS 证书服务。想让 Worker→VPS 这段加密，推荐在 VPS 上用 Let's Encrypt 自动签（需要时我可以给一键脚本），CF 小云朵解决不了这段的加密</p>
    </details>
    <div class="toolbar">
      <button class="btn btn-sm btn-solid" onclick="saveRelay(this)">保存并下发到 VPS</button>
      <button class="btn btn-sm" onclick="testRelay(this)">测试连通</button>
      <span id="relayStatus" class="form-hint"></span>
    </div>
    <div id="relayStats" class="relay-stats" title="点击刷新">📊 中继流量：加载中...</div>
  </div>

  </div>

  <div id="tab-domains" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">优选域名 <span class="chip">CDN</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="openDomainModal()">添加域名</button>
      <button class="btn btn-sm" onclick="testDomains()">重新测速</button>
      <span id="domain-status" class="muted"></span>
    </div>
    <div id="domainList" class="domain-list"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>
  </div>

  <div id="tab-logs" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">操作日志 <span class="chip">AUDIT</span></div>
    <div class="toolbar" style="margin-bottom:16px"><button class="btn btn-sm" onclick="loadAudit()">刷新</button></div>
    <div id="auditList" class="muted">点击刷新查看最近 100 条操作</div>
  </div>
  </div>
</div>

<div id="modalRoute" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="routeModalTitle">添加路由</h2>
      <p class="modal-desc">创建路由后可通过 /路径 快捷访问目标服务</p>
    </div>
    <input type="hidden" id="oldPrefix">
    <div class="form-group">
      <label>备注名</label>
      <input id="routeRemark" placeholder="例如：我的 Emby 服务器">
      <p class="form-hint">异常与恢复通知优先显示备注；请只填写可公开的服名，不要放地址或密钥。空备注、疑似敏感内容或超过 64 字符时使用通知编号。</p>
    </div>
    <div class="form-group">
      <label>路径 (prefix)</label>
      <input id="routePrefix" placeholder="myemby">
      <p class="form-hint">访问路径: https://你的域名/<span id="prefixPreview">myemby</span></p>
    </div>
    <div class="form-group">
      <label>目标地址 (target)</label>
      <textarea id="routeTarget" rows="3" placeholder="https://emby.example.com:8096&#10;https://emby-backup.example.com:8096"></textarea>
      <p class="form-hint">一行一个地址（也支持逗号分隔），按顺序故障转移</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="routeCache" checked> 启用图片/静态资源缓存
      </label>
      <label class="checkbox-label" style="margin-top:12px">
        <input type="checkbox" id="routeCompat"> 兼容模式
      </label>
      <p class="form-hint">兼容模式适用于部分无法正常播放的 Emby 服务器，开启后不重写媒体流地址，由客户端直连源站播放</p>
      <label style="margin-top:12px">VPS 反代分流模式</label>
      <select id="routeRelayMode" style="margin-top:6px">
        <option value="auto" selected>自动 — Worker 优先，失败切 VPS</option>
        <option value="on">开 — 直接走 VPS</option>
        <option value="off">关 — 只走 Worker</option>
      </select>
      <p class="form-hint">自动：GET/HEAD 遇到 401/403/451、连接失败、超时或指定网关错误时尝试一次 VPS；登录和 PlaybackInfo 的小型 POST 仅在明确收到 401/403/451 时重试。回退成功后优先 VPS 2 分钟，再由只读请求探测直连恢复；下载慢不会中途重发视频。「开」要求全局中继已启用并配置，否则报错，不会改走 Worker。</p>
    </div>
    <div class="form-group">
      <label>客户端 IP</label>
      <select id="routeIpMode">
        <option value="forward">默认模式（透传客户端 IP）</option>
        <option value="strip">不透传 IP（不发送 X-Forwarded-For / X-Real-IP）</option>
        <option value="disable">彻底隐藏（剥离所有客户端身份头）</option>
      </select>
      <p class="form-hint">反代目标也是 Cloudflare 站点时建议选「彻底隐藏」，源站将只能看到 Worker 出口 IP</p>
    </div>
    <div class="form-group">
      <label>自定义请求头（可选）</label>
      <textarea id="routeHeaders" rows="3" placeholder="User-Agent: Emby/4.8&#10;Origin: https://example.com"></textarea>
      <p class="form-hint">每行一个 Name: Value，会覆盖转发给上游的同名请求头，可用于应对防盗链</p>
    </div>
    <div class="form-group">
      <label>IP 白名单（可选）</label>
      <input id="routeIpAllow" placeholder="留空表示不限制，例如 1.2.3.4, 10.0.0.0/8">
      <label style="margin-top:12px">IP 黑名单（可选）</label>
      <input id="routeIpBlock" placeholder="例如 5.6.7.8">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalRoute')">取消</button>
      <button class="btn btn-solid" onclick="saveRoute()">保存</button>
    </div>
  </div>
</div>

<div id="modalDomain" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="domainModalTitle">添加优选域名</h2>
      <p class="modal-desc">添加您自己的优选域名</p>
    </div>
    <input type="hidden" id="domainId">
    <div class="form-group">
      <label>名称</label>
      <input id="domainName" placeholder="例如：我的优选域名">
    </div>
    <div class="form-group">
      <label>域名</label>
      <input id="domainUrl" type="url" placeholder="https://example.com">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalDomain')">取消</button>
      <button class="btn btn-solid" onclick="saveDomain()">保存</button>
    </div>
  </div>
</div>


<div id="modalSettings" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">系统设置</h2>
      <p class="modal-desc">定时任务需要在 Cloudflare 控制台为 Worker 添加 Cron 触发器（如 */10 * * * *）</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setHealth"> 启用线路健康检查（连续 2 次失败告警，恢复时再通知）</label>
      <p class="form-hint" id="notifyHint"></p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setDailyReport" checked> 每天 23:00（北京时间）自动发送 Telegram 日报</label>
      <p class="form-hint">需要给 Worker 配置 Cron 触发器，例如 <code>0 15 * * *</code>；也可以随时点顶部的「发送日报」手动发送</p>
    </div>
    <div class="form-group">
      <h3>通知 · Telegram</h3>
      <label class="checkbox-label"><input type="checkbox" id="setRouteAlerts" checked> 发送线路异常与恢复通知</label>
      <p class="form-hint">告警优先显示安全的线路备注，不发送线路地址、入口或原始错误；备注为空或疑似含地址、凭据时回退到线路卡片上的通知编号。</p>
      <label for="tgBotToken">Bot Token</label>
      <input id="tgBotToken" type="password" autocomplete="new-password" maxlength="256" placeholder="填写新 Token；留空保持不变">
      <label for="tgChatId">Chat ID</label>
      <input id="tgChatId" inputmode="text" maxlength="21" placeholder="数字 ID；群组通常为负数">
      <p class="form-hint" id="tgConfigStatus"></p>
      <p class="form-hint" id="tgLastStatus"></p>
      <div class="modal-actions">
        <button class="btn" id="btnSaveTelegram" onclick="saveTelegram(this)">保存 TG 配置</button>
        <button class="btn" id="btnTestTelegram" onclick="testTelegramConfig(this)">测试发送</button>
        <button class="btn btn-danger" onclick="clearTelegram(this)">清除并停用 TG</button>
      </div>
      <p class="form-hint">TG 配置单独保存；测试使用已保存配置。Token 加密存储，不回显、不导出。清除后不会回退使用环境变量。</p>
    </div>
    <div class="form-group">
      <h3>安全 · 修改登录密码</h3>
      <label for="currentPassword">当前密码</label>
      <input id="currentPassword" type="password" autocomplete="current-password" maxlength="1024">
      <label for="newPassword">新密码（12–128 个字符）</label>
      <input id="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128">
      <label for="confirmPassword">确认新密码</label>
      <input id="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128">
      <p class="form-hint">修改后所有旧会话失效，需用新密码重新登录。忘记密码只能由 Cloudflare 管理员执行恢复，旧管理密钥不会作为第二个登录密码。</p>
      <button class="btn" id="btnChangePassword" onclick="updatePassword(this)">修改密码并退出</button>
    </div>
    <div class="form-group">
      <label>每 IP 每分钟请求上限（0 = 不限制）</label>
      <input id="setRate" type="number" min="0" placeholder="0">
      <p class="form-hint">仅限制 API 类请求，不影响图片和视频流</p>
    </div>
    <div class="form-group">
      <label>X-Frame-Options 响应头（代理内容是否允许被 iframe 嵌入）</label>
      <select id="setXfo">
        <option value="">SAMEORIGIN（默认，仅同源可嵌入）</option>
        <option value="deny">DENY（完全禁止嵌入）</option>
        <option value="off">不发送（允许任意站点 iframe 嵌入）</option>
      </select>
      <p class="form-hint">只影响反代出去的媒体内容；管理后台始终为 SAMEORIGIN</p>
    </div>
    <div class="form-group">
      <label>额外的手动重定向域名（逗号分隔）</label>
      <input id="setManual" placeholder="例如 example-cdn.com, other.net">
      <label style="margin-top:12px">域名映射规则（JSON，日本机房使用）</label>
      <textarea id="setRules" rows="2" placeholder='{"example.com":"1.2.3.4"}'></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="runNow()">立即健康检查</button>
      <button class="btn" onclick="closeModal('modalSettings')">取消</button>
      <button class="btn btn-solid" onclick="saveSettings()">保存</button>
    </div>
  </div>
</div>

<script>${THEME_LOGIC}
${SPEED_TOOLS}
${ADMIN_CLIENT}<\/script></body></html>`;
}

export { buildFrontendHtml, buildAdminHtml };
