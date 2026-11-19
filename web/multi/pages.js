import FRONTEND_CLIENT from './frontend.js?text';
import LOGIN_CLIENT from './login.js?text';
import REGISTER_CLIENT from './register.js?text';
import ADMIN_CLIENT from './admin.js?text';
// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { SPEED_TOOLS, safeHttpUrl } from "./../../src/editions/multi/ui/theme.js";
import { envStr, getBaseDomain } from "./../../src/shared/auth/session.js";
import { DYN_PALETTE, PAGE_STYLE, THEME_INIT, THEME_LOGIC } from "./../../src/shared/ui/theme.js";
import { CURRENT_VERSION } from "./../../src/editions/multi/version.js";
import { getStatsHost, getUserDomain } from "./../../src/editions/multi/integrations/zone.js";

function renderTopLinks(env2) {
    const links = [
        { icon: "\u{1F4C8}", label: "\u4F18\u9009\u57DF\u540D\u76D1\u63A7", url: safeHttpUrl(envStr(env2, "MONITOR_URL"), "https://yx.255432.xyz/") },
        { icon: "\u{1F4AC}", label: "Telegram \u7FA4\u7EC4", url: safeHttpUrl(envStr(env2, "TG_GROUP_URL"), "https://t.me/+7cbXthaBajszNjI1") }
    ];
    return '<div class="linkbar">' + links.map((l) => '<a href="' + l.url + '" target="_blank" rel="noopener">' + l.icon + " " + l.label + "</a>").join("") + "</div>";
}

function buildFrontendHtml(env2) {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>Emby \u53CD\u5411\u4EE3\u7406</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3AC}</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="admin-bg" aria-hidden="true"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">EMBY<span style="color:var(--accent)">\xB7</span>PROXY</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <a href="/admin" class="btn btn-sm">\u7BA1\u7406\u540E\u53F0</a>
    </div>
  </div>

  ${renderTopLinks(env2)}

  <div class="card hero">
    <div class="hero-kicker">REVERSE&nbsp;PROXY&nbsp;\xB7&nbsp;EDGE&nbsp;NETWORK</div>
    <h1>Emby <em>\u53CD\u5411\u4EE3\u7406</em></h1>
    <p>\u7248\u672C ${CURRENT_VERSION} \xB7 \u652F\u6301\u522B\u540D\u5FEB\u6377\u5165\u53E3\u4E0E\u4F18\u9009\u57DF\u540D\u81EA\u52A8\u6D4B\u901F \xB7 \u8FB9\u7F18\u8282\u70B9\u667A\u80FD\u52A0\u901F</p>
    <div class="term">
      <div class="term-bar"><i></i><i></i><i></i><span>~/emby-proxy \u2014 usage</span></div>
      <div class="term-body">
        <div><span class="p">$</span>https://<span class="hl">\u4F60\u7684\u57DF\u540D</span>/\u522B\u540D</div>
        <div><span class="p">$</span>https://<span class="hl">\u4F60\u7684\u57DF\u540D</span>/https://emby.example.com:8096</div>
        <div class="dim"># \u6DFB\u52A0\u670D\u52A1\u540E\u8BF7\u52A1\u5FC5\u624B\u52A8\u6D4B\u8BD5 \xB7 \u6076\u610F\u5237\u63A5\u53E3\u5C06\u5C01\u7981 IP</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="sec-title">\u5F53\u524D\u8FB9\u7F18\u8282\u70B9 <span class="chip">EDGE</span></div>
    <div id="edge-loading" class="muted"><span class="spin"></span>\u6B63\u5728\u63A2\u6D4B...</div>
    <div id="edge-info" class="edge-box" style="display:none"></div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F18\u9009\u57DF\u540D\u6D4B\u901F <span class="chip">LATENCY</span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm" id="btn-retest">\u91CD\u65B0\u6D4B\u901F</button>
      <span id="speed-status" class="muted"></span>
    </div>
    <div id="domain-table-wrap"><p class="muted"><span class="spin"></span>\u6B63\u5728\u6D4B\u901F...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F7F\u7528\u7EDF\u8BA1 <span class="chip">CF&nbsp;ANALYTICS</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>\u4ECA\u65E5\u8BF7\u6C42</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u6D41\u91CF</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u8BBF\u95EE</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
      </div>
      <div id="hourly-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
    </div>
  </div>
</div>
<script>${THEME_LOGIC}
${SPEED_TOOLS}
${FRONTEND_CLIENT}<\/script></body></html>`;
}

function buildLoginHtml() {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>\u767B\u5F55</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F510}</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="admin-bg" aria-hidden="true"></div>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:26px">
      <div class="hero-kicker" style="margin-bottom:10px">MULTI&nbsp;USER&nbsp;ACCESS</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">\u767B\u5F55</h1>
      <p class="muted" style="margin-top:8px">\u666E\u901A\u7528\u6237\u8F93\u5165\u7528\u6237\u540D + \u5BC6\u7801\uFF1B\u7BA1\u7406\u5458\u7528\u6237\u540D\u586B admin\uFF08\u6216\u7559\u7A7A\uFF09\u5E76\u4F7F\u7528\u7BA1\u7406\u5BC6\u94A5</p>
    </div>
    <form onsubmit="login();return false">
      <input id="usernameInput" placeholder="\u7528\u6237\u540D\uFF08\u7BA1\u7406\u5458\u586B admin \u6216\u7559\u7A7A\uFF09" autocomplete="username" autocapitalize="off" style="margin-bottom:10px">
      <input type="password" id="passwordInput" placeholder="\u5BC6\u7801 / \u7BA1\u7406\u5BC6\u94A5" autocomplete="current-password" style="margin-bottom:10px">
      <p id="loginErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:6px 0;text-align:center"></p>
      <button class="btn btn-solid" style="width:100%;padding:12px" id="loginBtn" type="submit">\u767B \u5F55</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
      \u6CA1\u6709\u8D26\u53F7\uFF1F<a href="/register" style="color:var(--accent)">\u4F7F\u7528\u9080\u8BF7\u7801\u6CE8\u518C</a>
    </p>
  </div>
</div>
<script>${THEME_LOGIC}
${LOGIN_CLIENT}<\/script></body></html>`;
}

function buildRegisterHtml(env2) {
    const userDomain = (typeof getUserDomain === "function" ? getUserDomain(env2) : "") || "";
    const entryExample = userDomain ? "\u7528\u6237\u540D." + userDomain : "\u7528\u6237\u540D.\u6839\u57DF\u540D";
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>\u6CE8\u518C</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3AB}</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="admin-bg" aria-hidden="true"></div>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:22px">
      <div class="hero-kicker" style="margin-bottom:10px">INVITE&nbsp;ONLY</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">\u6CE8\u518C\u8D26\u53F7</h1>
      <p class="muted" style="margin-top:8px">\u6CE8\u518C\u540E\u81EA\u52A8\u83B7\u5F97\u72EC\u7ACB\u5B50\u57DF\u540D\uFF0C\u5E76\u81EA\u52A8\u521B\u5EFA <code>${entryExample}</code> \u7684 DNS \u8BB0\u5F55</p>
    </div>
    <form onsubmit="register();return false">
      <input id="regInvite" placeholder="\u9080\u8BF7\u7801" autocapitalize="characters" style="margin-bottom:10px">
      <input id="regUsername" placeholder="\u7528\u6237\u540D\uFF083-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD/\u6570\u5B57/-\uFF09" autocomplete="username" autocapitalize="off" style="margin-bottom:10px">
      <p class="form-hint" style="margin:-4px 0 10px;text-align:left">\u7528\u6237\u540D\u540C\u65F6\u4F5C\u4E3A DNS \u524D\u7F00\uFF0C\u4E0D\u80FD\u4EE5 - \u5F00\u5934\u6216\u7ED3\u5C3E</p>
      <input type="password" id="regPassword" placeholder="\u5BC6\u7801\uFF08\u81F3\u5C11 6 \u4F4D\uFF09" autocomplete="new-password" style="margin-bottom:10px">
      <input type="password" id="regPassword2" placeholder="\u786E\u8BA4\u5BC6\u7801" autocomplete="new-password" style="margin-bottom:10px">
      <p id="regErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:6px 0;text-align:center"></p>
      <button class="btn btn-solid" style="width:100%;padding:12px" id="regBtn" type="submit">\u6CE8 \u518C</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
      \u5DF2\u6709\u8D26\u53F7\uFF1F<a href="/admin" style="color:var(--accent)">\u8FD4\u56DE\u767B\u5F55</a>
    </p>
  </div>
</div>
<script>${THEME_LOGIC}
${REGISTER_CLIENT}<\/script></body></html>`;
}

function buildAdminHtml(session, env2) {
    const isAdmin2 = Boolean(session && session.isAdmin);
    const username = String(session && session.username || "user").replace(/[^a-z0-9_-]/gi, "") || "user";
    const roleLabel = isAdmin2 ? "ADMIN" : "USER";
    const consoleName = isAdmin2 ? "ADMIN" : "USER";
    const effectiveMainHost = env2 ? getStatsHost(env2) || getBaseDomain(env2) || "" : "";
    const effectiveUserDomain = env2 ? getUserDomain(env2) || getBaseDomain(env2) || "" : "";
    const reportBtn = isAdmin2 ? '<button class="btn btn-sm" id="btnDailyReport" onclick="sendReport(this)">\u53D1\u9001\u65E5\u62A5</button>' : "";
    const settingsBtn = isAdmin2 ? '<button class="btn btn-sm" onclick="openSettings()">\u8BBE\u7F6E</button>' : "";
    const passwordBtn = isAdmin2 ? "" : '<button class="btn btn-sm" onclick="changePassword()">\u6539\u5BC6\u7801</button>';
    const routeToolbar = isAdmin2 ? `<button class="btn btn-sm btn-solid" onclick="openRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button><button class="btn btn-sm" onclick="location.href='/admin/api/export'">\u5BFC\u51FA\u914D\u7F6E</button><button class="btn btn-sm" onclick="document.getElementById('importFile').click()">\u5BFC\u5165\u914D\u7F6E</button><input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importConfig(this)">` : '<button class="btn btn-sm btn-solid" onclick="openRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button><span class="muted" id="routeLimitHint"></span>';
    const dnsQuick = isAdmin2 ? `
    <div class="dns-quick">
      <span class="dns-quick-tag">DNS</span>
      <input id="dnsQuickName" placeholder="\u8BB0\u5F55\u540D\uFF08\u7559\u7A7A = BASE_DOMAIN\uFF09">
      <span class="dns-quick-arrow">\u2192</span>
      <input id="dnsQuickTarget" placeholder="\u76EE\u6807\u57DF\u540D\u6216 IP\uFF08\u53EF\u4EE5\u76F4\u63A5\u6539\uFF09">
      <button class="btn btn-sm btn-solid" id="dnsQuickSave" onclick="quickSaveDNS(this)">\u4FDD\u5B58</button>
      <button class="btn btn-sm" onclick="loadQuickDNS()">\u5237\u65B0</button>
    </div>
    <p class="muted" id="dnsQuickMeta" style="margin:-2px 0 14px;font-size:12px">DNS \u8BB0\u5F55\u52A0\u8F7D\u4E2D...</p>` : "";
    const statsCard = `
  <div class="card">
    <div class="sec-title">\u4F7F\u7528\u7EDF\u8BA1 <span class="chip" id="statsChip">CF</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>\u4ECA\u65E5\u8BF7\u6C42</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u6D41\u91CF</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u8BBF\u95EE</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
      </div>
      <div id="hourly-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
    </div>
  </div>`;
    const userEntryCard = isAdmin2 ? "" : `
  <div class="card">
    <div class="sec-title">\u6211\u7684\u5165\u53E3 <span class="chip">ENTRY</span></div>
    <div class="edge-box">
      <div class="edge-item"><strong>\u7528\u6237\u540D</strong><span id="entryUser">${username}</span></div>
      <div class="edge-item"><strong>\u5165\u53E3\u57DF\u540D</strong><span id="entryHost">\u52A0\u8F7D\u4E2D...</span></div>
      <div class="edge-item"><strong>\u8DEF\u7531\u6570\u91CF</strong><span id="entryRoutes">\u2014</span></div>
      <div class="edge-item"><strong>DNS \u72B6\u6001</strong><span id="entryDns">\u52A0\u8F7D\u4E2D...</span></div>
    </div>
    <p class="muted" style="margin-top:12px;font-size:12px" id="entryHint"></p>
    <div class="form-group" style="margin-top:12px">
      <label>DNS \u8BB0\u5F55\u503C\uFF08CNAME \u76EE\u6807\uFF0C\u53EF\u586B IP \u6216\u57DF\u540D\uFF09</label>
      <div class="toolbar" style="flex-wrap:nowrap">
        <input id="entryDnsValue" placeholder="\u4F8B\u5982 youxuan.cf.090227.xyz \u6216 1.2.3.4" style="flex:1 1 auto;min-width:0">
        <button class="btn btn-sm btn-solid" style="flex:0 0 auto" onclick="saveUserDNS(this)">\u4FDD\u5B58 DNS \u503C</button>
      </div>
      <p class="form-hint">\u4FDD\u5B58\u65F6\u4F1A\u5148\u5220\u9664\u540C\u540D\u65E7\u8BB0\u5F55\u518D\u91CD\u65B0\u521B\u5EFA\uFF0C\u907F\u514D\u7C7B\u578B\u51B2\u7A81\uFF1B\u65B0\u8BB0\u5F55\u9ED8\u8BA4\u5173\u95ED\u5C0F\u9EC4\u4E91\u3002\u82E5\u72B6\u6001\u663E\u793A\u300C\u5DF2\u4EE3\u7406\u300D\uFF0C\u4FDD\u5B58\u4E00\u6B21\u5373\u53EF\u6539\u4E3A\u4EC5 DNS\u3002</p>
    </div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-sm" onclick="ensureUserDNS(this)">\u91CD\u65B0\u521B\u5EFA DNS</button>
      <button class="btn btn-sm" onclick="loadUserEntry()">\u5237\u65B0</button>
      <a class="btn btn-sm" id="entryUrl" href="#" target="_blank" rel="noopener">\u6253\u5F00\u5165\u53E3</a>
    </div>
    <p class="muted" style="margin-top:10px;font-size:12px">\u8BBF\u95EE\u65B9\u5F0F\uFF1A<code>https://\u5165\u53E3\u57DF\u540D/\u8DEF\u7531\u524D\u7F00</code></p>
  </div>`;
    const adminCards = isAdmin2 ? `
  <div class="card">
    <div class="sec-title">\u7528\u6237\u7BA1\u7406 <span class="chip" id="userCount"></span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm btn-solid" onclick="openUserModal()">\u6DFB\u52A0\u7528\u6237</button>
      <button class="btn btn-sm" onclick="loadUsers()">\u5237\u65B0</button>
    </div>
    <div id="userList" class="muted">\u52A0\u8F7D\u4E2D...</div>
  </div>

  <div class="card">
    <div class="sec-title">\u9080\u8BF7\u7801 <span class="chip">INVITE</span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm btn-solid" onclick="openInviteModal()">\u751F\u6210\u9080\u8BF7\u7801</button>
      <button class="btn btn-sm btn-danger" onclick="clearInvites()">\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801</button>
      <button class="btn btn-sm" onclick="loadInvites()">\u5237\u65B0</button>
    </div>
    <div id="inviteList" class="muted">\u52A0\u8F7D\u4E2D...</div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F18\u9009\u57DF\u540D\u7BA1\u7406 <span class="chip">CDN</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="openDomainModal()">\u6DFB\u52A0\u57DF\u540D</button>
      <button class="btn btn-sm" onclick="testDomains()">\u624B\u52A8\u6D4B\u901F</button>
      <span id="domain-status" class="muted"></span>
    </div>
    <div id="domainList" class="domain-list"><p class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">\u64CD\u4F5C\u65E5\u5FD7 <span class="chip">AUDIT</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="loadAudit()">\u5237\u65B0</button>
      <button class="btn btn-sm btn-danger" onclick="resetStats()">\u6E05\u7A7A\u7EDF\u8BA1</button>
    </div>
    <div id="auditList" class="muted">\u70B9\u51FB\u5237\u65B0\u67E5\u770B\u6700\u8FD1 100 \u6761\u64CD\u4F5C</div>
  </div>` : "";
    const adminModals = isAdmin2 ? `
<div id="modalDomain" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="domainModalTitle">\u6DFB\u52A0\u4F18\u9009\u57DF\u540D</h2>
      <p class="modal-desc">\u6DFB\u52A0\u60A8\u81EA\u5DF1\u7684\u4F18\u9009\u57DF\u540D</p>
    </div>
    <input type="hidden" id="domainId">
    <div class="form-group">
      <label>\u540D\u79F0</label>
      <input id="domainName" placeholder="\u4F8B\u5982\uFF1A\u6211\u7684\u4F18\u9009\u57DF\u540D">
    </div>
    <div class="form-group">
      <label>\u57DF\u540D</label>
      <input id="domainUrl" type="url" placeholder="https://example.com">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalDomain')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveDomain()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalSettings" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">\u7CFB\u7EDF\u8BBE\u7F6E</h2>
      <p class="modal-desc">\u5B9A\u65F6\u4EFB\u52A1\u9700\u8981\u5728 Cloudflare \u63A7\u5236\u53F0\u4E3A Worker \u6DFB\u52A0 Cron \u89E6\u53D1\u5668\uFF08\u5982 */10 * * * *\uFF09</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setHealth"> \u542F\u7528\u7EBF\u8DEF\u5065\u5EB7\u68C0\u67E5\uFF08\u8FDE\u7EED 2 \u6B21\u5931\u8D25\u544A\u8B66\uFF0C\u6062\u590D\u65F6\u518D\u901A\u77E5\uFF09</label>
      <p class="form-hint" id="notifyHint"></p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setDailyReport" checked> \u6BCF\u5929 23:00\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09\u81EA\u52A8\u53D1\u9001 Telegram \u65E5\u62A5</label>
      <p class="form-hint">\u9700\u8981\u7ED9 Worker \u914D\u7F6E Cron \u89E6\u53D1\u5668\uFF0C\u4F8B\u5982 <code>0 15 * * *</code>\uFF1B\u4E5F\u53EF\u4EE5\u968F\u65F6\u70B9\u9876\u90E8\u7684\u300C\u53D1\u9001\u65E5\u62A5\u300D\u624B\u52A8\u53D1\u9001</p>
    </div>
    <div class="form-group">
      <label>\u6BCF IP \u6BCF\u5206\u949F\u8BF7\u6C42\u4E0A\u9650\uFF080 = \u4E0D\u9650\u5236\uFF09</label>
      <input id="setRate" type="number" min="0" placeholder="0">
      <p class="form-hint">\u4EC5\u9650\u5236 API \u7C7B\u8BF7\u6C42\uFF0C\u4E0D\u5F71\u54CD\u56FE\u7247\u548C\u89C6\u9891\u6D41</p>
    </div>
    <div class="form-group">
      <label>\u989D\u5916\u7684\u624B\u52A8\u91CD\u5B9A\u5411\u57DF\u540D\uFF08\u9017\u53F7\u5206\u9694\uFF09</label>
      <input id="setManual" placeholder="\u4F8B\u5982 example-cdn.com, other.net">
      <label style="margin-top:12px">\u57DF\u540D\u6620\u5C04\u89C4\u5219\uFF08JSON\uFF0C\u65E5\u672C\u673A\u623F\u4F7F\u7528\uFF09</label>
      <textarea id="setRules" rows="2" placeholder='{"example.com":"1.2.3.4"}'></textarea>
    </div>
    <div class="form-group">
      <label>\u591A\u4EBA\u7248\u8BF4\u660E</label>
      <p class="form-hint">\u7528\u6237\u901A\u8FC7 <code>\u7528\u6237\u540D.\u7528\u6237\u57DF\u540D</code> \u8BBF\u95EE\u81EA\u5DF1\u7684\u8DEF\u7531\uFF1B\u9700\u8981\u5728 Cloudflare \u7ED9 Worker \u6DFB\u52A0\u8DEF\u7531 <code>*.${effectiveUserDomain || "\u7528\u6237\u57DF\u540D"}/*</code>\uFF08\u6216 <code>*/*</code>\uFF09\u3002</p>
      <p class="form-hint">\u5F53\u524D Worker \u5165\u53E3\uFF1A<code>${effectiveMainHost || "\u672A\u914D\u7F6E"}</code>\uFF1B\u7528\u6237\u57DF\u540D\uFF1A<code>${effectiveUserDomain || "\u672A\u914D\u7F6E"}</code></p>
      <p class="form-hint">\u7528\u6237\u57DF\u540D\u81EA\u52A8\u4ECE\u73B0\u6709\u53D8\u91CF\u63A8\u5BFC\uFF0C\u4E0D\u7ED1\u5B9A\u4EFB\u4F55\u56FA\u5B9A\u57DF\u540D\uFF1A\u9ED8\u8BA4 = <code>BASE_DOMAIN</code>\uFF1B\u5982\u679C <code>BASE_DOMAIN</code> \u672C\u8EAB\u5C31\u662F Worker \u5165\u53E3\uFF08\u5F62\u5982 <code>\u5B50\u57DF\u540D.example.com</code>\uFF09\u4E14 <code>DNS_RECORD_NAME</code> \u4E0E\u90A3\u4E00\u7EA7\u76F8\u540C\uFF0C\u4F1A\u81EA\u52A8\u53BB\u6389\u5B83\uFF0C\u5F97\u5230 <code>example.com</code>\uFF0C\u7528\u6237\u5165\u53E3\u5C31\u662F <code>\u7528\u6237\u540D.example.com</code>\u3002\u9700\u8981\u65F6\u4E5F\u53EF\u7528 <code>USER_DOMAIN</code> \u663E\u5F0F\u6307\u5B9A\u4EFB\u610F\u57DF\u540D\u3002</p>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:14px">
      <label>VPS \u4E2D\u7EE7\uFF08CF \u76F4\u8FDE\u5931\u8D25\u65F6\u81EA\u52A8\u5207\u6362\uFF0C\u8054\u901A\u540E\u6240\u6709\u8DEF\u7531\u81EA\u52A8\u542F\u7528\uFF09</label>
      <input id="setRelayUrl" placeholder="https://relay.example.com:2087" autocapitalize="off">
      <input id="setRelaySecret" type="password" placeholder="\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539\u5BC6\u94A5" autocomplete="new-password" style="margin-top:8px">
      <label class="checkbox-label" style="margin-top:8px"><input type="checkbox" id="setRelayEnabled"> \u542F\u7528\u4E2D\u7EE7\uFF08\u9ED8\u8BA4\u52FE\u9009\uFF1B\u70B9\u300C\u6D4B\u8BD5\u300D\u8054\u901A\u540E\u81EA\u52A8\u5F00\u542F\uFF09</label>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-sm" onclick="testRelay()">\u6D4B\u8BD5\u8FDE\u901A</button>
        <span class="form-hint" id="relayTestResult" style="margin:0"></span>
      </div>
      <div id="relayUsage" class="muted" style="margin-top:10px;font-size:12px;line-height:1.7">VPS \u7EDF\u8BA1\u52A0\u8F7D\u4E2D...</div>
      <p class="form-hint">\u4E2D\u7EE7\u884C\u4E3A\uFF1A\u76F4\u8FDE\u4F18\u5148\uFF0C\u76F4\u8FDE\u5931\u8D25\uFF08\u7F51\u7EDC\u9519\u8BEF/401/403/451\uFF09\u624D\u81EA\u52A8\u8D70 VPS\uFF1BVPS \u6D41\u91CF\u9650\u989D\u8D85\u9650\u65F6\u81EA\u52A8\u56DE\u843D\u76F4\u8FDE\uFF0C\u7528\u6237\u65E0\u611F\u3002\u8986\u76D6\u6240\u6709\u7528\u6237\u8DEF\u7531\u548C <code>/https://\u6E90\u7AD9:\u7AEF\u53E3</code> \u76F4\u8FDE\u4EE3\u7406\u8DEF\u5F84\u3002</p>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="runNow()">\u7ACB\u5373\u5065\u5EB7\u68C0\u67E5</button>
      <button class="btn" onclick="closeModal('modalSettings')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveSettings()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalUser" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="userModalTitle">\u6DFB\u52A0\u7528\u6237</h2>
      <p class="modal-desc">\u7528\u6237\u5C06\u62E5\u6709\u72EC\u7ACB\u7684\u5B50\u57DF\u540D\u548C\u8DEF\u7531\u7A7A\u95F4</p>
    </div>
    <input type="hidden" id="userId">
    <div class="form-group">
      <label>\u7528\u6237\u540D</label>
      <input id="userUsername" placeholder="3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD/\u6570\u5B57/-\uFF08\u540C\u65F6\u4F5C\u4E3A DNS \u8BB0\u5F55\u540D\uFF09" autocapitalize="off">
    </div>
    <div class="form-group">
      <label>\u5BC6\u7801</label>
      <input id="userPassword" type="password" placeholder="\u7F16\u8F91\u65F6\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label>\u5B50\u57DF\u540D</label>
      <input id="userSubdomain" placeholder="\u4F8B\u5982 alice\uFF08\u7559\u7A7A = \u7528\u6237\u540D\uFF09" autocapitalize="off">
      <p class="form-hint">\u6700\u7EC8\u5165\u53E3\uFF1A<code>\u5B50\u57DF\u540D.\u7528\u6237\u57DF\u540D</code>\uFF1B\u521B\u5EFA\u7528\u6237\u65F6\u4F1A\u81EA\u52A8\u5EFA CNAME\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09\uFF0C\u7528\u6237\u53EF\u5728\u300C\u6211\u7684\u5165\u53E3\u300D\u91CC\u4FEE\u6539\u8BB0\u5F55\u503C</p>
    </div>
    <div class="form-group">
      <label>\u89D2\u8272</label>
      <select id="userRole">
        <option value="user">\u666E\u901A\u7528\u6237</option>
        <option value="admin">\u7BA1\u7406\u5458</option>
      </select>
    </div>
    <div class="form-group">
      <label>\u72B6\u6001</label>
      <select id="userStatus">
        <option value="active">\u6B63\u5E38</option>
        <option value="disabled">\u7981\u7528</option>
      </select>
    </div>
    <div class="form-group">
      <label>\u8DEF\u7531\u6570\u91CF\u4E0A\u9650</label>
      <input id="userRouteLimit" type="number" min="1" max="200" value="20">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalUser')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveUser()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalInvite" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">\u751F\u6210\u9080\u8BF7\u7801</h2>
      <p class="modal-desc">\u9080\u8BF7\u7801\u7528\u4E8E\u6CE8\u518C\u65B0\u7528\u6237</p>
    </div>
    <div class="form-group">
      <label>\u9080\u8BF7\u7801\uFF08\u7559\u7A7A\u81EA\u52A8\u751F\u6210\uFF09</label>
      <input id="inviteCode" placeholder="\u4F8B\u5982 WELCOME2026" autocapitalize="characters">
    </div>
    <div class="form-group">
      <label>\u6700\u5927\u4F7F\u7528\u6B21\u6570\uFF080 = \u4E0D\u9650\uFF09</label>
      <input id="inviteMaxUses" type="number" min="0" value="1">
    </div>
    <div class="form-group">
      <label>\u8FC7\u671F\u65E5\u671F\uFF08\u53EF\u9009\uFF09</label>
      <input id="inviteExpires" type="date">
    </div>
    <div class="form-group">
      <label>\u5907\u6CE8</label>
      <input id="inviteNote" placeholder="\u4F8B\u5982\uFF1A\u7ED9\u670B\u53CB">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalInvite')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveInvite()">\u751F\u6210</button>
    </div>
  </div>
</div>` : "";
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>${consoleName} \u63A7\u5236\u53F0</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F39B}\uFE0F</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="admin-bg" aria-hidden="true"></div>
<div id="toast"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">${consoleName}<span style="color:var(--accent)">\xB7</span>CONSOLE</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <span class="meta-tag" title="${roleLabel}">${roleLabel} \xB7 ${username}</span>
      ${reportBtn}
      ${passwordBtn}
      <a href="/" class="btn btn-sm">\u9996\u9875</a>
      ${settingsBtn}
      <button class="btn btn-sm btn-danger" onclick="logout()">\u9000\u51FA</button>
    </div>
  </div>

  ${renderTopLinks(env2)}

  <div class="card">
    <div class="sec-title">${isAdmin2 ? "\u6211\u6DFB\u52A0\u7684\u5168\u5C40\u8DEF\u7531" : "\u6211\u7684\u8DEF\u7531"} <span class="chip" id="routeCount"></span></div>
    <div class="toolbar" style="margin-bottom:16px">
      ${routeToolbar}
      <div class="search-box">
        <input type="text" id="routeSearch" placeholder="\u641C\u7D22\u5907\u6CE8\u6216\u8DEF\u5F84..." oninput="filterRoutes()">
      </div>
    </div>
    ${isAdmin2 ? '<p class="muted" style="margin:-6px 0 14px">\u53EA\u80FD\u770B\u5230\u4F60\u81EA\u5DF1\u6DFB\u52A0\u7684\u8DEF\u7531\uFF1B\u5176\u4ED6\u7BA1\u7406\u5458\u548C\u7528\u6237\u7684\u8DEF\u7531\u4E0D\u4F1A\u663E\u793A\uFF08\u7528\u6237\u8DEF\u7531\u4ECD\u6B63\u5E38\u4EE3\u7406\uFF09\u3002</p>' : ""}
    ${dnsQuick}
    <div id="routeList" class="route-grid"><p class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</p></div>
  </div>

  ${userEntryCard}
  ${statsCard}
  ${adminCards}
</div>

<div id="modalRoute" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="routeModalTitle">\u6DFB\u52A0\u8DEF\u7531</h2>
      <p class="modal-desc">\u521B\u5EFA\u8DEF\u7531\u540E\u53EF\u901A\u8FC7 /\u8DEF\u5F84 \u5FEB\u6377\u8BBF\u95EE\u76EE\u6807\u670D\u52A1</p>
    </div>
    <input type="hidden" id="oldPrefix">
    <input type="hidden" id="routeSource">
    <input type="hidden" id="routeId">
    <div class="form-group">
      <label>\u5907\u6CE8\u540D</label>
      <input id="routeRemark" placeholder="\u4F8B\u5982\uFF1A\u6211\u7684 Emby \u670D\u52A1\u5668">
    </div>
    <div class="form-group">
      <label>\u8DEF\u5F84 (prefix)</label>
      <input id="routePrefix" placeholder="myemby">
      <p class="form-hint">\u8BBF\u95EE\u8DEF\u5F84: https://\u4F60\u7684\u57DF\u540D/<span id="prefixPreview">myemby</span></p>
    </div>
    <div class="form-group">
      <label>\u76EE\u6807\u5730\u5740 (target)</label>
      <textarea id="routeTarget" rows="3" placeholder="https://emby.example.com:8096&#10;https://emby-backup.example.com:8096"></textarea>
      <p class="form-hint">\u4E00\u884C\u4E00\u4E2A\u5730\u5740\uFF08\u4E5F\u652F\u6301\u9017\u53F7\u5206\u9694\uFF09\uFF0C\u6309\u987A\u5E8F\u6545\u969C\u8F6C\u79FB</p>
    </div>
    <div class="form-group">
      <label>推流地址（可选）</label>
      <textarea id="routeStreamTarget" rows="2" placeholder="https://stream.example.com:8096"></textarea>
      <p class="form-hint">用于 Emby 前后端分离：填写源站跳转到的推流服务器地址（可多行），匹配的 302/播放 URL 会改写回本路由并经 Worker 反代。目标地址仍填写界面/API 地址；常规服和网盘直连留空。不会直接往推流地址拼接 Emby 播放路径。</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="routeCache" checked> \u542F\u7528\u56FE\u7247/\u9759\u6001\u8D44\u6E90\u7F13\u5B58
      </label>
      <label class="checkbox-label" style="margin-top:12px">
        <input type="checkbox" id="routeCompat"> \u517C\u5BB9\u6A21\u5F0F
      </label>
      <p class="form-hint">\u517C\u5BB9\u6A21\u5F0F\u9002\u7528\u4E8E\u90E8\u5206\u65E0\u6CD5\u6B63\u5E38\u64AD\u653E\u7684 Emby \u670D\u52A1\u5668\uFF0C\u5F00\u542F\u540E\u4E0D\u91CD\u5199\u5A92\u4F53\u6D41\u5730\u5740\uFF0C\u7531\u5BA2\u6237\u7AEF\u76F4\u8FDE\u6E90\u7AD9\u64AD\u653E</p>
    </div>
    <div class="form-group">
      <label>\u5BA2\u6237\u7AEF IP</label>
      <select id="routeIpMode">
        <option value="forward">\u9ED8\u8BA4\u6A21\u5F0F\uFF08\u900F\u4F20\u5BA2\u6237\u7AEF IP\uFF09</option>
        <option value="strip">\u4E0D\u900F\u4F20 IP\uFF08\u4E0D\u53D1\u9001 X-Forwarded-For / X-Real-IP\uFF09</option>
        <option value="disable">\u5F7B\u5E95\u9690\u85CF\uFF08\u5265\u79BB\u6240\u6709\u5BA2\u6237\u7AEF\u8EAB\u4EFD\u5934\uFF09</option>
      </select>
      <p class="form-hint">\u53CD\u4EE3\u76EE\u6807\u4E5F\u662F Cloudflare \u7AD9\u70B9\u65F6\u5EFA\u8BAE\u9009\u300C\u5F7B\u5E95\u9690\u85CF\u300D\uFF0C\u6E90\u7AD9\u5C06\u53EA\u80FD\u770B\u5230 Worker \u51FA\u53E3 IP</p>
    </div>
    <div class="form-group">
      <label>\u81EA\u5B9A\u4E49\u8BF7\u6C42\u5934\uFF08\u53EF\u9009\uFF09</label>
      <textarea id="routeHeaders" rows="3" placeholder="User-Agent: Emby/4.8&#10;Origin: https://example.com"></textarea>
      <p class="form-hint">\u6BCF\u884C\u4E00\u4E2A Name: Value\uFF0C\u4F1A\u8986\u76D6\u8F6C\u53D1\u7ED9\u4E0A\u6E38\u7684\u540C\u540D\u8BF7\u6C42\u5934\uFF0C\u53EF\u7528\u4E8E\u5E94\u5BF9\u9632\u76D7\u94FE</p>
    </div>
    <div class="form-group">
      <label>IP \u767D\u540D\u5355\uFF08\u53EF\u9009\uFF09</label>
      <input id="routeIpAllow" placeholder="\u7559\u7A7A\u8868\u793A\u4E0D\u9650\u5236\uFF0C\u4F8B\u5982 1.2.3.4, 10.0.0.0/8">
      <label style="margin-top:12px">IP \u9ED1\u540D\u5355\uFF08\u53EF\u9009\uFF09</label>
      <input id="routeIpBlock" placeholder="\u4F8B\u5982 5.6.7.8">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalRoute')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveRoute()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

${adminModals}

<script>window.__EMBY_PAGE__ = ${JSON.stringify({ isAdmin: isAdmin2, username }).replace(/</g, "\\u003c")};
${THEME_LOGIC}
${SPEED_TOOLS}
${ADMIN_CLIENT}<\/script></body></html>`;
}

export { renderTopLinks, buildFrontendHtml, buildLoginHtml, buildRegisterHtml, buildAdminHtml };
