/**
 * =================================================================================
 *              Cloudflare Worker 通用 Emby 反向代理脚本 (带 D1 统计版)
 * =================================================================================
 *
 * 版本: 2.5
 * 更新日志:
 * - 集成 D1 数据库统计功能
 * - 统计播放次数与获取链接次数
 * - 统计日期强制使用北京时间 (UTC+8)
 * - 集成前端页面
 *
 */

const MANUAL_REDIRECT_DOMAINS = [
    'ap-cn01.emby.bangumi.ca',
    'ap-cn02.emby.bangumi.ca',
    'ap-cn03.emby.bangumi.ca',
    'quark.cn', //夸克网盘
    'mini189.cn', //天翼云盘
    '189.cn', //天翼云盘
    'ctyunxs.cn', //天翼云盘
    'telecomjs.com', //天翼云盘
    'xunlei.com', //迅雷云盘
    '115.com', //115
    '115cdn.com', //115
    '115cdn.net', //115
    'uc.cn', //uc
    'aliyundrive.com', //阿里
    'aliyundrive.net', //阿里
    'voicehub.top', //阿里
    'xiaoya.pro', //小雅
];


// 被封锁的EMBY，走美西
const DOMAIN_PROXY_RULES = {
  // 格式：'域名后缀': '反代服务器地址'
  'biliblili.uk': 'example.com',
};

const JP_COLOS = ['NRT', 'KIX', 'FUK', 'OKA'];

// 前端页面HTML
const FRONTEND_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Emby 反代工具指南 | 声明</title>
  <link rel="icon" href="/favicon.ico" type="image/webp">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #e1e4e8; margin: 0; padding: 0; background-color: #1a1c22; display: flex; min-height: 100vh; }
    
    /* 整体容器 */
    .container { 
      width: 100%; 
      max-width: 800px; 
      margin: auto; 
      padding: 20px; 
      display: flex; 
      flex-direction: column; 
      gap: 20px; 
    }
    
    /* 内容区域 */
    .content-section { 
      background: #252830; 
      padding: 40px; 
      border-radius: 16px; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
      border-top: 5px solid #0070f3; 
    }
    .content-section h1 { margin-top: 0; color: #0070f3; display: flex; align-items: center; }
    h2 { color: #0070f3; border-bottom: 2px solid #3e4451; padding-bottom: 10px; margin-top: 30px; }
    code { background: rgba(0, 112, 243, 0.1); padding: 4px 8px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 0.9em; color: #61afef; word-break: break-all; border: 1px solid rgba(0, 112, 243, 0.2); }
    .example-box { background: rgba(0, 112, 243, 0.05); border-left: 4px solid #0070f3; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
    .warning { color: #e06c75; font-weight: bold; border: 2px solid rgba(224, 108, 117, 0.3); padding: 20px; border-radius: 12px; margin-top: 40px; background: rgba(224, 108, 117, 0.05); }
    .strong-red { color: #e06c75; font-weight: 900; text-decoration: underline; font-size: 1.1em; }

    .status-tag { display: inline-block; background: #0070f3; color: white; padding: 2px 10px; border-radius: 4px; font-weight: bold; margin-bottom: 10px; }
    .feature-card { background: rgba(0, 112, 243, 0.1); border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #0070f3; }
    .feature-card h3 { color: #0070f3; margin-top: 0; font-size: 1.2em; }
    .feature-card p { margin-bottom: 0; color: #abb2bf; }

    .footer-text { margin-top: 30px; padding-top: 20px; border-top: 1px dashed #3e4451; font-size: 0.9em; }

    /* 统计卡片样式 */
    .stat-card {
      background: rgba(0, 112, 243, 0.1);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      flex: 1;
      margin: 0 10px;
      border: 1px solid rgba(0, 112, 243, 0.2);
    }
    .stat-card:first-child {
      margin-left: 0;
    }
    .stat-card:last-child {
      margin-right: 0;
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #0070f3;
      margin-top: 10px;
    }

    /* 每日统计表格 */
    #daily-stats {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 15px;
      overflow-x: auto;
    }
    .stats-table {
      width: 100%;
      border-collapse: collapse;
    }
    .stats-table th,
    .stats-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .stats-table th {
      background: rgba(0, 112, 243, 0.2);
      font-weight: bold;
      color: #0070f3;
    }
    .stats-table tr:hover {
      background: rgba(0, 112, 243, 0.1);
    }

    @media (max-width: 900px) {
      .container { padding: 10px; }
      .content-section { padding: 20px; }
      .stat-card {
        margin: 5px;
        padding: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    
    <div class="content-section">
      <h1>🚀 使用指南</h1>
      
      <h2>通用格式</h2>
      <div class="example-box">
        <code>https://你的worker域名/你的域名:端口</code><br>
        <code style="display:inline-block; margin-top:8px;">https://你的worker域名/http://你的域名:端口</code><br>
        <code style="display:inline-block; margin-top:8px;">https://你的worker域名/https://你的域名:端口</code>
      </div>

      <h2>HTTP 示例</h2>
      <div class="example-box">
        <code>https://你的worker域名/http://emby.com</code>
      </div>

      <h2>HTTPS 示例</h2>
      <div class="example-box">
        <code>https://你的worker域名/https://emby.com</code>
      </div>

      <div class="warning">
        ⚠️ <strong>严正警告：</strong><br>
        添加服后 <span class="strong-red">务必手动测试</span> 是否可用。禁止未经测试大批量添加，导致服务器报错刷屏、恶意占用资源者，<span class="strong-red">直接封禁 IP，不予通知！</span>
      </div>
    </div>

    <div class="content-section">
      <div class="status-tag">关于本服务</div>
      <h1>🔧 Emby 反向代理</h1>
      <p><strong>服务特点：</strong></p>
      <ul style="list-style-type: disc; padding-left: 20px; color: #abb2bf;">
        <li>高速稳定的反向代理服务</li>
        <li>支持 WebSocket 连接</li>
        <li>智能重定向处理</li>
        <li>详细的使用统计</li>
        <li>全球节点覆盖</li>
      </ul>
      
      <div class="feature-card">
        <h3>📊 统计功能</h3>
        <p>本服务集成了 D1 数据库统计功能，可以记录播放次数和获取链接次数，帮助您了解服务使用情况。</p>
      </div>
      
      <div class="feature-card">
        <h3>🌍 全球节点</h3>
        <p>利用 Cloudflare 全球 CDN 网络，为您提供就近的访问节点，确保最佳的访问速度。</p>
      </div>
      
      <div class="content-section" id="stats-section">
        <h2>📈 使用统计</h2>
        <div id="stats-loading">加载统计数据中...</div>
        <div id="stats-error" style="display: none; color: #e06c75;"></div>
        <div id="stats-content" style="display: none;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div class="stat-card">
              <h3>总播放次数</h3>
              <div id="total-playing" class="stat-value">0</div>
            </div>
            <div class="stat-card">
              <h3>总获取链接次数</h3>
              <div id="total-playback-info" class="stat-value">0</div>
            </div>
          </div>
          <h3>每日统计</h3>
          <div id="daily-stats"></div>
          <div class="footer-text" style="margin-top: 20px;">
            <p>数据更新时间: <span id="last-updated">--</span></p>
            <p>每小时自动更新</p>
          </div>
        </div>
      </div>
      
      <div class="footer-text">
        <p>© 2026 Emby 反向代理服务</p>
        <p>本服务仅用于学习和研究目的</p>
      </div>
    </div>

  </div>
  <script>
    // Cloudflare Insights script removed to avoid errors
    
    // 统计数据相关函数
    async function fetchStats() {
      try {
        const response = await fetch('/stats');
        const data = await response.json();
        
        if (data.error) {
          document.getElementById('stats-loading').style.display = 'none';
          document.getElementById('stats-error').style.display = 'block';
          document.getElementById('stats-content').style.display = 'none';
          document.getElementById('stats-error').textContent = data.error;
          return;
        }
        
        // 更新统计数据
        document.getElementById('total-playing').textContent = data.data.total.playing;
        document.getElementById('total-playback-info').textContent = data.data.total.playbackInfo;
        document.getElementById('last-updated').textContent = data.data.lastUpdated;
        
        // 更新每日统计表格
        const dailyStatsContainer = document.getElementById('daily-stats');
        if (data.data.dailyStats.length > 0) {
          var tableHTML = '<table class="stats-table"><thead><tr><th>日期</th><th>播放次数</th><th>获取链接次数</th></tr></thead><tbody>';
          
          data.data.dailyStats.forEach(function(stat) {
            tableHTML += '<tr><td>' + stat.date + '</td><td>' + stat.playing_count + '</td><td>' + stat.playback_info_count + '</td></tr>';
          });
          
          tableHTML += '</tbody></table>';
          
          dailyStatsContainer.innerHTML = tableHTML;
        } else {
          dailyStatsContainer.innerHTML = '<p>暂无统计数据</p>';
        }
        
        // 显示统计内容
        document.getElementById('stats-loading').style.display = 'none';
        document.getElementById('stats-error').style.display = 'none';
        document.getElementById('stats-content').style.display = 'block';
        
      } catch (error) {
        console.error('获取统计数据失败:', error);
        document.getElementById('stats-loading').style.display = 'none';
        document.getElementById('stats-error').style.display = 'block';
        document.getElementById('stats-content').style.display = 'none';
        document.getElementById('stats-error').textContent = '获取统计数据失败，请稍后再试';
      }
    }
    
    // 初始加载统计数据
    fetchStats();
    
    // 每小时自动更新统计数据
    setInterval(fetchStats, 3600000); // 3600000毫秒 = 1小时
  </script>
</body>
</html>
`;


export default {
  async fetch(request, env, ctx) {
    const workerUrl = new URL(request.url);

    // --- 1. 根路径 ---    
    if (workerUrl.pathname === '/') {
      return new Response(FRONTEND_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
    }
    
    // --- 2. 处理favicon.ico ---    
    if (workerUrl.pathname === '/favicon.ico') {
      // 返回一个空的favicon.ico响应
      return new Response('', {
        headers: {
          'Content-Type': 'image/x-icon'
        }
      });
    }
    
    // --- 3. 处理Cloudflare cdn-cgi路径 ---    
    if (workerUrl.pathname.startsWith('/cdn-cgi/')) {
      // 对于cdn-cgi路径，直接返回404或空响应
      return new Response('Not Found', { status: 404 });
    }
    
    // --- 4. 统计数据端点 ---    
    if (workerUrl.pathname === '/stats') {
      return handleStatsRequest(env);
    }


    // --- 3. 解析目标 URL ---    
    let upstreamUrl;
    try {
        let path = workerUrl.pathname.substring(1);
        
        // 检查路径是否以 / 开头（处理双斜杠情况）
        if (path.startsWith('/')) {
            return new Response('Invalid proxy format. Please use: https://your-worker-domain/your-emby-server:port', { status: 400 });
        }
        
        // 检查是否是直接访问 Sessions/Playing 等路径
        if (path === 'Sessions/Playing' || path.startsWith('Sessions/Playing/') || path === 'PlaybackInfo' || path.startsWith('PlaybackInfo/')) {
            return new Response('Invalid proxy format. Please use: https://your-worker-domain/your-emby-server:port', { status: 400 });
        }
        
        path = path.replace(/^(https?)\/(?!\/)/, '$1://');
        if (!path.startsWith('http')) {
            path = 'https://' + path;
        }
        upstreamUrl = new URL(path);
        upstreamUrl.search = workerUrl.search;
        
        // 检查是否是有效的域名格式
        const hostname = upstreamUrl.hostname;
        if (!hostname || hostname === 'Sessions' || hostname === 'PlaybackInfo') {
            return new Response('Invalid proxy format. Please use: https://your-worker-domain/your-emby-server:port', { status: 400 });
        }
    } catch (e) {
      return new Response('Invalid URL format. Please use: https://your-worker-domain/your-emby-server:port', { status: 400 });
    }


// [优化] --- 判断是否需要走美西 ---


    // 1.流量不是来自日本，直接跳过，根本不用浪费 CPU 去算域名后缀
    const currentEdgeColo = request.cf?.colo;

    if (currentEdgeColo && JP_COLOS.includes(currentEdgeColo)) {
        

        const originalHost = upstreamUrl.host; 
        
        for (const domainSuffix in DOMAIN_PROXY_RULES) {
            if (originalHost.endsWith(domainSuffix)) {
                upstreamUrl.hostname = DOMAIN_PROXY_RULES[domainSuffix];
                break; 
            }
        }
    }
    // [结束] --- 判断是否需要走美西 ---

    // [新增] --- 统计逻辑开始 ---
    // 这里的 upstreamUrl.pathname 才是 Emby 的真实 API 路径
    // 使用 ctx.waitUntil 确保不阻塞后续的反代请求
    if (upstreamUrl.pathname.endsWith('/Sessions/Playing')) {
        ctx.waitUntil(recordStats(env, 'playing'));
    } else if (upstreamUrl.pathname.includes('/PlaybackInfo')) {
        ctx.waitUntil(recordStats(env, 'playback_info'));
    }
    // [新增] --- 统计逻辑结束 ---

    // --- 4. WebSocket ---
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return fetch(upstreamUrl.toString(), request);
    }

    // --- 5. 构造请求头 ---
    const upstreamRequestHeaders = new Headers(request.headers);
    upstreamRequestHeaders.set('Host', upstreamUrl.host);
    upstreamRequestHeaders.delete('Referer'); 
    
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) {
        upstreamRequestHeaders.set('x-forwarded-for', clientIp);
        upstreamRequestHeaders.set('x-real-ip', clientIp);
    }

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: upstreamRequestHeaders,
      body: request.body,
      redirect: 'manual', // 禁止自动跟随，手动处理
    });

    // --- 6. 发起请求 ---
    const upstreamResponse = await fetch(upstreamRequest);

    // --- 7. 处理重定向 (核心修复区域) ---
    const location = upstreamResponse.headers.get('Location');
    if (location && upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      try {
        // [修复 1]: 处理相对路径重定向，基于 upstreamUrl 补全
        const redirectUrl = new URL(location, upstreamUrl);
        
        // 策略 A: 白名单直连
        if (MANUAL_REDIRECT_DOMAINS.some(domain => redirectUrl.hostname.endsWith(domain))) {
          // [优化]: 确保返回给客户端的是绝对路径，防止客户端在 Worker 域名下跳转
          const responseHeaders = new Headers(upstreamResponse.headers);
          responseHeaders.set('Location', redirectUrl.toString());
          return new Response(upstreamResponse.body, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers: responseHeaders
          });
        }
        
        // 策略 B: Worker 内部代理跟随
        const followHeaders = new Headers(upstreamRequestHeaders);
        // [修复 2]: 更新 Host 头
        followHeaders.set('Host', redirectUrl.host);
        
        // [修复 3]: 使用完整的绝对 URL 发起 fetch
        return fetch(redirectUrl.toString(), {
            method: request.method,
            headers: followHeaders,
            body: request.body,
            redirect: 'follow'
        });

      } catch (e) {
        return upstreamResponse;
      }
    }

    // --- 8. 处理常规响应 ---
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.delete('Content-Security-Policy');
    responseHeaders.delete('X-Frame-Options');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

// [新增] --- 统计工具函数 ---
async function recordStats(env, type) {
    try {
        // 使用 Asia/Shanghai 时区生成日期字符串 (YYYY-MM-DD)
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

        // 检查 DB 是否绑定
        if (!env.DB) {
            console.error("D1 数据库未绑定，变量名需为 'DB'");
            return;
        }

        let query = "";
        let params = [];

        if (type === 'playing') {
            // 记录播放次数
            query = `
                INSERT INTO auto_emby_daily_stats (date, playing_count, playback_info_count) 
                VALUES (?, 1, 0) 
                ON CONFLICT(date) DO UPDATE SET playing_count = playing_count + 1
            `;
            params = [today];
        } else if (type === 'playback_info') {
            // 记录获取链接次数
            query = `
                INSERT INTO auto_emby_daily_stats (date, playing_count, playback_info_count) 
                VALUES (?, 0, 1) 
                ON CONFLICT(date) DO UPDATE SET playback_info_count = playback_info_count + 1
            `;
            params = [today];
        }

        if (query) {
            await env.DB.prepare(query).bind(...params).run();
        }

    } catch (e) {
        console.error('统计写入失败:', e);
    }
}

// [新增] --- 处理统计数据请求 ---
async function handleStatsRequest(env) {
    try {
        // 检查 DB 是否绑定
        if (!env.DB) {
            return new Response(JSON.stringify({
                error: "D1 数据库未绑定，变量名需为 'DB'",
                data: null
            }), {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        // 查询所有统计数据
        const statsQuery = `
            SELECT * FROM auto_emby_daily_stats 
            ORDER BY date DESC
        `;
        const statsResult = await env.DB.prepare(statsQuery).all();

        // 查询总计数据
        const totalQuery = `
            SELECT 
                SUM(playing_count) as total_playing, 
                SUM(playback_info_count) as total_playback_info 
            FROM auto_emby_daily_stats
        `;
        const totalResult = await env.DB.prepare(totalQuery).first();

        return new Response(JSON.stringify({
            error: null,
            data: {
                dailyStats: statsResult.results || [],
                total: {
                    playing: totalResult?.total_playing || 0,
                    playbackInfo: totalResult?.total_playback_info || 0
                },
                lastUpdated: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
            }
        }), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

    } catch (e) {
        console.error('统计查询失败:', e);
        return new Response(JSON.stringify({
            error: '统计查询失败: ' + e.message,
            data: null
        }), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
    }
}
