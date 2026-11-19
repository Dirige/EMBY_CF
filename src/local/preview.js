// Development-only. This file must never be reachable from production entries.
import { PAGE_STYLE, THEME_INIT } from '../shared/ui/theme.js';
import { SESSION_COOKIE } from '../shared/auth/session.js';
const localNames = new Set(['127.0.0.1', 'localhost', '[::1]']);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export function createLocalPreview({ edition, handler, initDatabase, memberCookie }) {
  let ready;
  // Browser cookies are scoped by host, not port. Keep the two previews separate
  // and never accept an actual production session cookie in the preview.
  const cookieName = `emby_preview_${edition}`;
  function localCookie(cookie) {
    if (!cookie?.startsWith(SESSION_COOKIE + '=')) throw new Error('Preview session cookie missing');
    return cookieName + cookie.slice(SESSION_COOKIE.length).replace(/;\s*Secure\b/gi, '');
  }
  function withPreviewSession(request) {
    const headers = new Headers(request.headers);
    const cookies = String(headers.get('Cookie') || '').split(';').map(part => part.trim());
    const selected = cookies.find(part => part.startsWith(cookieName + '='));
    headers.delete('Cookie');
    if (selected) headers.set('Cookie', SESSION_COOKIE + selected.slice(cookieName.length));
    return new Request(request, { headers });
  }
  function withLocalCookie(response) {
    const cookie = response.headers.get('Set-Cookie');
    if (!cookie) return response;
    const headers = new Headers(response.headers);
    headers.set('Set-Cookie', localCookie(cookie));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  async function seed(env) {
    await initDatabase(env);
    const marker = await env.DB.prepare("SELECT value FROM settings WHERE key = 'local_preview_seed'").first();
    if (marker) return;
    const target = 'https://upstream.test';
    if (edition === 'personal') {
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO routes (prefix,target,remark,cache_img,compat_mode,ip_mode,enabled,use_relay,sort_order) VALUES (?,?,?,?,?,?,?,?,?)').bind('demo', target, '本地测试 · 普通线路', 'on', 'off', 'forward', 1, 'off', 0),
        env.DB.prepare('INSERT OR IGNORE INTO routes (prefix,target,remark,enabled,sort_order) VALUES (?,?,?,?,?)').bind('standby', target, '本地测试 · 暂停的备用线路', 0, 1),
      ]);
    } else {
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO routes (prefix,target,stream_target,remark,enabled,created_by,sort_order) VALUES (?,?,?,?,?,?,?)').bind('demo', target, 'https://media.test', '本地测试 · 分离推流线路', 1, 'admin', 0),
        env.DB.prepare("INSERT OR IGNORE INTO users (id,username,password_hash,salt,role,status,subdomain,route_limit,created_at) VALUES (1,'preview-user','','','user','active','preview-user',20,?)").bind(new Date().toISOString()),
        env.DB.prepare("INSERT OR IGNORE INTO user_routes (owner,prefix,target,remark,enabled) VALUES ('preview-user','private',?,'本地测试 · 用户私有线路',1)").bind(target),
      ]);
    }
    await env.DB.batch([
      env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('health_check','0')"),
      env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('tg_daily_report','0')"),
      env.DB.prepare("INSERT INTO audit_log (ts,action,detail) VALUES (?,'local.preview','本地隔离验收初始化；无生产配置和真实播放数据')").bind(new Date().toISOString()),
      env.DB.prepare("INSERT INTO settings (key,value) VALUES ('local_preview_seed','1')"),
    ]);
  }
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (env.LOCAL_PREVIEW !== '1' || !localNames.has(url.hostname)) return json({ error: 'Local preview requires a loopback host' }, 403);
      ready ||= seed(env).catch(error => { ready = undefined; throw error; });
      await ready;
      if (url.pathname === '/__preview/health') return json({ ok: true, edition, localOnly: true });
      if (url.pathname === '/__preview/login' && request.method === 'POST') {
        if (request.headers.get('Origin') !== url.origin) return json({ error: 'Same-origin preview action required' }, 403);
        if (edition === 'multi' && url.searchParams.get('role') === 'member') {
          return new Response(null, { status: 303, headers: { Location: '/admin', 'Set-Cookie': localCookie(await memberCookie(env)) } });
        }
        const login = new Request(new URL('/admin/api/login', url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: env.ADMIN_TOKEN }) });
        const response = await handler.fetch(login, env, ctx);
        if (response.status !== 200) return json({ error: 'Preview login failed' }, 500);
        const headers = new Headers({ Location: '/admin', 'Cache-Control': 'no-store' });
        headers.set('Set-Cookie', localCookie(response.headers.get('Set-Cookie')));
        return new Response(null, { status: 303, headers });
      }
      if (url.pathname === '/__preview' || url.pathname === '/__preview/') {
        return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emby 重构 · 本地验收</title><script>${THEME_INIT}</script><style>${PAGE_STYLE}</style></head><body><main class="container" style="max-width:720px;padding-top:12vh"><section class="card"><div class="sec-title">LOCAL ACCEPTANCE <span class="chip">${edition.toUpperCase()}</span></div><h1 style="margin-bottom:14px">原来的毛玻璃，全新的结构。</h1><p class="muted">${edition === 'personal' ? '个人版' : '多人版'} · 独立本地数据库 · 无生产凭据 · 外部请求被阻断</p><p style="margin:24px 0">可以验收主题、路由编辑、设置、日志${edition === 'multi' ? '、用户与邀请及普通用户视图' : '和中继表单'}。数据均为明确标注的本地测试数据；不代表真实播放或 Cloudflare 统计。</p><form method="post" action="/__preview/login"><button class="btn btn-solid" type="submit">进入${edition === 'multi' ? '管理员' : '个人版'}工作区</button></form>${edition === 'multi' ? '<form method="post" action="/__preview/login?role=member" style="margin-top:12px"><button class="btn" type="submit">验收普通用户视图</button></form>' : ''}<p class="muted" style="margin-top:26px">请勿填写生产 Token、Cookie、证书或真实媒体地址。</p><a class="btn btn-sm" style="margin-top:18px" href="http://127.0.0.1:${edition === 'personal' ? '4274' : '4273'}/__preview">切换到${edition === 'personal' ? '多人版' : '个人版'} →</a></section></main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
      if (url.pathname === '/bing-wallpaper') {
        // A self-contained local illustration, never a downloaded media/image asset.
        return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#172638"/><stop offset=".5" stop-color="#28494b"/><stop offset="1" stop-color="#322b49"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><path d="M0 720L360 260 650 600 1050 180 1600 740V1000H0Z" fill="#122a38" opacity=".8"/><path d="M0 850L560 470 1000 880 1400 430 1600 660V1000H0Z" fill="#101b2e" opacity=".9"/></svg>', { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' } });
      }
      const response = withLocalCookie(await handler.fetch(withPreviewSession(request), env, ctx));
      if (!response.headers.get('Content-Type')?.includes('text/html')) return response;
      const html = (await response.text()).replace('</body>', `<aside class="local-preview-notice" style="position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:99999;max-width:95vw;padding:8px 16px;border:1px solid var(--accent-line);border-radius:99px;background:var(--surface);backdrop-filter:blur(18px);color:var(--text);font-size:11px;text-align:center">本地重构预览 · 测试数据 · 未部署线上 · <a href="/__preview" style="color:var(--accent)">切换身份</a></aside></body>`);
      const headers = new Headers(response.headers); headers.delete('Content-Length');
      return new Response(html, { status: response.status, headers });
    },
  };
}
