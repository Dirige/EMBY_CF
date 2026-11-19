function pingOnce(url, timeout) {
  return new Promise(function(resolve) {
    var t0 = performance.now(), settled = false;
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function() { if (ctrl) ctrl.abort(); fin(-1); }, timeout);
    function fin(ms) { if (settled) return; settled = true; clearTimeout(timer); resolve(ms); }
    var bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now() + Math.random().toString(36).slice(2);
    fetch(url + bust, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function() { fin(Math.round(performance.now() - t0)); })
      .catch(function() { fin(-1); });
  });
}

// 同一域名顺序测多次（后续请求复用连接，反映稳定往返延迟），取中位数；失败过半视为不可用
async function measureDomain(host, samples, timeout) {
  var times = [];
  for (var i = 0; i < samples; i++) {
    var ms = await pingOnce('https://' + host + '/cdn-cgi/trace', timeout);
    if (ms >= 0) times.push(ms);
  }
  if (times.length < Math.ceil(samples / 2)) return -1;
  times.sort(function(a, b) { return a - b; });
  return times[Math.floor(times.length / 2)];
}

async function runPool(items, limit, fn) {
  var out = new Array(items.length), idx = 0;
  async function w() { while (idx < items.length) { var i = idx++; out[i] = await fn(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, w));
  return out;
}

function latencyLabel(ms) { return ms < 0 ? 'timeout' : ms < 100 ? 'fast' : ms < 300 ? 'good' : 'slow'; }

async function speedTestDomains(domains, onProgress) {
  var done = 0;
  var rows = await runPool(domains, 3, async function(d) {
    var ms = await measureDomain(d.domain, 4, 6000);
    done++;
    if (onProgress) onProgress(done, domains.length);
    return { id: d.id, domain: d.domain, name: d.name, host: d.domain, latency: ms, status: latencyLabel(ms), isBuiltin: d.isBuiltin };
  });
  rows.sort(function(a, b) { if (a.latency < 0) return 1; if (b.latency < 0) return -1; return a.latency - b.latency; });
  return rows;
}
