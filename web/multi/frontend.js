var TAG = { fast:'极快', good:'良好', slow:'较慢', timeout:'超时' };
var CLS = { fast:'tag-fast', good:'tag-good', slow:'tag-slow', timeout:'tag-timeout' };

async function loadEdge() {
  try {
    const r = await fetch('/api/edge-info');
    const d = await r.json();
    document.getElementById('edge-loading').style.display = 'none';
    const box = document.getElementById('edge-info');
    box.style.display = 'grid';
    box.innerHTML = [
      ['客户端 IP', d.clientIp],
      ['接入 POP', d.entryColo],
      ['国家/地区', d.entryCountry + (d.entryCity ? ' / '+d.entryCity : '')],
      ['边缘出口 IP', d.edgeIp],
      ['落地 COLO', d.egressColo],
    ].map(function(kv){ return '<div class="edge-item"><strong>'+kv[0]+'</strong><span>'+(kv[1]||'—')+'</span></div>'; }).join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '加载失败'; }
}

function renderDomainTable(results, best) {
  const wrap = document.getElementById('domain-table-wrap');
  if (!results.length) { wrap.innerHTML = '<p class="muted">无数据</p>'; return; }
  let html = '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="min-width:520px"><thead><tr><th>#</th><th>名称</th><th>域名</th><th>延迟</th><th>状态</th></tr></thead><tbody>';
  results.forEach((r, i) => {
    const host = r.host || r.domain;
    const isBest = best && best.domain === r.domain;
    const pct = r.latency >= 0 ? Math.max(5, Math.min(100, Math.round(r.latency / 3))) : 0;
    html += '<tr class="'+(isBest?'best':'')+'"><td class="mono" style="color:var(--text-faint)">'+(i+1)+'</td>'
      + '<td style="white-space:nowrap">'+ (r.name||'—') + (isBest?' <span class="tag tag-best">BEST</span>':'') +'</td>'
      + '<td><code style="font-size:12px">'+host+'</code></td>'
      + '<td><div class="lat"><div class="lat-bar"><i style="width:'+pct+'%"></i></div><span>'+(r.latency>=0?r.latency+' ms':'—')+'</span></div></td>'
      + '<td><span class="tag '+CLS[r.status||'timeout']+'">'+(TAG[r.status]||'—')+'</span></td></tr>';
  });
  wrap.innerHTML = html + '</tbody></table></div>';
}



function finalizeResults(rows) {
  rows.forEach(r => { if (r.latency >= 0) r.status = r.latency < 100 ? 'fast' : r.latency < 300 ? 'good' : 'slow'; else r.status = 'timeout'; });
  rows.sort((a,b) => { if (a.latency<0) return 1; if (b.latency<0) return -1; return a.latency-b.latency; });
  return rows;
}

async function getOptimizedDomains() {
  try {
    const r = await fetch('/api/domains/list');
    const d = await r.json();
    if (d.success) return d.domains;
  } catch (_) {}
  return [];
}

async function runDomainSpeed(force) {
  const st = document.getElementById('speed-status');
  const wrap = document.getElementById('domain-table-wrap');
  st.textContent = '正在测速...';
  wrap.innerHTML = '<p class="muted"><span class="spin"></span>正在测试您本地网络到各优选域名的延迟...</p>';

  const domains = await getOptimizedDomains();
  const clientResults = await speedTestDomains(domains, function(d, n) { st.textContent = '正在测速 ' + d + '/' + n + '（在您本机浏览器中进行，每个域名测 4 次取中位数）'; });
  finalizeResults(clientResults);
  const clientOk = clientResults.filter(r => r.latency >= 0).length;
  const best = clientResults.find(r => r.latency >= 0);
  renderDomainTable(clientResults, best);

  if (clientOk > 0) {
    st.textContent = '测速完成 · ' + clientOk + ' 个可用 · 推荐: ' + (best ? best.domain : '无');
  } else {
    st.textContent = '测速失败，请检查网络或稍后重试';
  }
}

async function loadStats() {
  try {
    const r = await fetch('/stats');
    const d = await r.json();
    if (d.error) { document.getElementById('stats-loading').textContent = d.error; return; }
    document.getElementById('stats-loading').style.display = 'none';
    document.getElementById('stats-body').style.display = 'block';
    document.getElementById('st-req').textContent = d.data.todayRequests ?? 0;
    document.getElementById('st-req-sub').textContent = '来源: ' + (d.data.source || 'CF 数据不可用');
    document.getElementById('st-traffic').textContent = d.data.todayTraffic || '0 B';
    document.getElementById('st-traffic-sub').textContent = '来源: ' + (d.data.source || 'CF 数据不可用') + ' · CF 边缘出站';
    document.getElementById('st-uv').textContent = d.data.todayVisits ?? 0;
    document.getElementById('st-uv-sub').textContent = '来源: CF 独立访问';
    const cfInfo = d.data.cfStatus || '';
    const envInfo = d.data.envInfo || {};
    document.getElementById('st-updated').textContent = '更新时间 ' + (d.data.lastUpdated||'') + ' · ' + cfInfo
      + (envInfo.statsHost ? ' · 统计域名 ' + envInfo.statsHost : '')
      + (envInfo.zoneId ? ' · Zone ' + envInfo.zoneId.slice(0, 8) + '…' : '')
      + (d.data.cfError ? ' (' + d.data.cfError + ')' : '');
    const hourly = d.data.hourlySeries || [];
    if (hourly.length) {
      const max = Math.max(1, ...hourly.map(h=>h.total));
      let hhtml = '<div class="chart">';
      hourly.forEach(h=>{
        const ht = Math.max(2, Math.round((h.total/max)*68));
        const label = h.label || '';
        hhtml += '<div class="chart-col" title="'+label+' · '+h.total+' 次"><i style="height:'+ht+'px"></i><b>'+label.slice(0,2)+'</b></div>';
      });
      hhtml += '</div><p class="muted" style="font-size:11px;margin-top:6px">今日 24 小时请求分布（上海时区）</p>';
      document.getElementById('hourly-chart').innerHTML = hhtml;
    }
  } catch(e) { document.getElementById('stats-loading').textContent = '统计加载失败'; }
}

document.getElementById('btn-retest').onclick = () => runDomainSpeed(true);
loadEdge();
runDomainSpeed(false);
loadStats();
