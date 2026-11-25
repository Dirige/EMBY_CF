// Presentation only. Every write/probe still passes the edition's server auth.
(() => {
  const list = document.getElementById('routeList');
  if (!list) return;
  const edition = document.body.dataset.edition;
  const admin = edition === 'personal' || typeof IS_ADMIN !== 'undefined' && IS_ADMIN;
  const selected = new Set();
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const main = document.querySelector('.container');
  const navigation = main.querySelector('.tabbar');
  const updateActiveTab = () => { document.body.dataset.consoleTab = navigation?.querySelector('.tab-btn.active')?.dataset.tab || 'overview'; };
  navigation?.addEventListener('click', () => requestAnimationFrame(updateActiveTab));
  updateActiveTab();

  const tools = element('div', '', 'console-route-tools');
  const filter = element('select');
  filter.setAttribute('aria-label', '线路状态筛选');
  for (const [value, text] of [['all', '全部线路'], ['enabled', '仅已启用'], ['disabled', '仅已停用']]) {
    const option = element('option', text); option.value = value; filter.append(option);
  }
  const selectionCount = element('span', '已选 0 条', 'muted');
  const bulk = [];
  tools.append(filter, selectionCount);
  if (admin) {
    for (const [enabled, label] of [[true, '启用所选'], [false, '停用所选']]) {
      const button = element('button', label, 'btn btn-sm');
      button.disabled = true;
      button.onclick = async () => {
        const prefixes = [...selected];
        if (!prefixes.length || !confirm(`确认${enabled ? '启用' : '停用'} ${prefixes.length} 条线路？`)) return;
        bulk.forEach(item => { item.disabled = true; });
        let succeeded = 0;
        try {
          for (const prefix of prefixes) {
            const response = await fetch('/admin/api/routes/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, enabled }) });
            if (!response.ok) throw new Error('部分操作未完成，请刷新核对');
            succeeded++;
          }
          selected.clear();
          showToast(`已更新 ${succeeded} 条线路`);
        } catch { showToast(`已更新 ${succeeded} 条；其余未完成，请核对`); }
        finally { await loadRoutes(); update(); }
      };
      bulk.push(button); tools.append(button);
    }
  }
  list.before(tools);
  const applyFilter = () => {
    const query = (document.getElementById('routeSearch')?.value || '').toLowerCase();
    for (const card of list.querySelectorAll('.route-item')) {
      const enabled = card.dataset.consoleEnabled === 'true';
      card.style.display = (!query || (card.dataset.search || '').includes(query)) && (filter.value === 'all' || enabled === (filter.value === 'enabled')) ? '' : 'none';
    }
  };
  filter.onchange = applyFilter;
  document.getElementById('routeSearch')?.addEventListener('input', applyFilter);

  const dialog = element('dialog', '', 'console-diagnostic');
  dialog.setAttribute('aria-label', '线路诊断');
  const close = element('button', '关闭', 'btn btn-sm');
  close.onclick = () => dialog.close();
  const diagnosticBody = element('div');
  diagnosticBody.setAttribute('aria-live', 'polite');
  dialog.append(close, diagnosticBody);
  document.body.append(dialog);
  let diagnosing = false;
  async function diagnose(prefix, button) {
    if (diagnosing) return;
    diagnosing = true; button.disabled = true;
    diagnosticBody.replaceChildren(element('h2', '线路诊断'), element('p', '正在检查源站的 Emby/Jellyfin API…', 'muted'));
    dialog.showModal();
    try {
      const response = await fetch('/admin/api/routes/diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix }) });
      if (!response.ok) throw new Error('诊断未完成，请检查权限或稍后重试');
      const data = await response.json();
      diagnosticBody.replaceChildren(element('h2', `线路 /${data.prefix}`));
      diagnosticBody.append(element('p', `本次探测：Worker 直连源站${data.enabled ? '' : ' · 此线路已停用'}`, 'muted'));
      const results = element('div', '', 'diagnostic-results');
      for (const result of data.results) {
        const row = element('section', '', 'diagnostic-row');
        const labels = { verified: 'API 正常', 'endpoint-unavailable': '未验证：公开 API 路径不可用', authentication: '探测受限：源站拒绝访问', upstream: '探测失败：源站服务错误', 'unexpected-response': '未验证：不是有效的服务信息', 'connection-or-redirect': '探测失败：连接或跳转异常', cancelled: '探测已取消' };
        row.append(element('strong', `源站 ${result.target}`), element('span', labels[result.stage] || '探测失败：HTTP 响应异常', result.ok ? 'diagnostic-ok' : 'diagnostic-warning'));
        if (result.status) row.append(element('p', `HTTP ${result.status} · 响应头 ${result.headerMs} ms · 跳转 ${result.redirects} 次`, 'muted'));
        results.append(row);
      }
      diagnosticBody.append(results, element('p', data.notice, 'form-hint'));
    } catch { diagnosticBody.append(element('p', '诊断未完成，请检查权限、线路配置或稍后重试。', 'diagnostic-warning')); }
    finally { diagnosing = false; button.disabled = false; }
  }
  const dataRoutes = () => typeof allRoutes !== 'undefined' && Array.isArray(allRoutes) ? allRoutes : [];
  function update() {
    const routes = dataRoutes();
    for (const prefix of selected) if (!routes.some(route => route.prefix === prefix)) selected.delete(prefix);
    for (const card of list.querySelectorAll('.route-item')) {
      const original = card.querySelector('button[data-prefix]');
      if (!original) continue;
      const prefix = original.dataset.prefix;
      const route = routes.find(item => item.prefix === prefix);
      card.dataset.consoleEnabled = String(route?.enabled !== 0);
      if (card.querySelector('[data-console-added]')) continue;
      const controls = element('div', '', 'console-card-controls');
      controls.dataset.consoleAdded = '1';
      if (admin) {
        card.querySelector('button[data-act="test"]')?.remove();
        const label = element('label', '', 'console-select');
        const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(prefix);
        checkbox.setAttribute('aria-label', `选择线路 ${prefix}`);
        checkbox.onchange = () => { checkbox.checked ? selected.add(prefix) : selected.delete(prefix); refreshSelection(); };
        label.append(checkbox, document.createTextNode('选择')); controls.append(label);
        const diagnostic = element('button', '链路诊断', 'btn btn-sm');
        diagnostic.onclick = () => diagnose(prefix, diagnostic); controls.append(diagnostic);
      }
      const clone = element('button', '复制为新线路', 'btn btn-sm');
      clone.onclick = () => {
        editRoute(prefix);
        document.getElementById('oldPrefix').value = '';
        for (const id of ['routeId', 'routeSource']) { const field = document.getElementById(id); if (field) field.value = ''; }
        let next = (prefix.slice(0, 52) + '-copy');
        let index = 2;
        while (routes.some(item => item.prefix === next)) next = prefix.slice(0, 50) + '-copy-' + index++;
        document.getElementById('routePrefix').value = next;
        document.getElementById('routeRemark').value = (route?.remark || prefix) + ' · 副本';
        document.getElementById('routeModalTitle').textContent = '复制为新线路';
        document.getElementById('prefixPreview').textContent = next;
      };
      controls.append(clone); card.append(controls);
    }
    refreshSelection(); applyFilter();
  }
  function refreshSelection() {
    selectionCount.textContent = `已选 ${selected.size} 条`;
    bulk.forEach(button => { button.disabled = !selected.size; });
  }
  // Only childList changes from the edition renderer need enhancement.
  new MutationObserver(records => { if (records.some(record => record.target === list)) update(); }).observe(list, { childList: true });
  update();

})();
