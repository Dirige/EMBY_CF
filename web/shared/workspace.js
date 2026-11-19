// Shared presentation controller. Authorization remains entirely server-side.
(() => {
  const edition = document.body.dataset.edition;
  const topbar = document.querySelector('.topbar');
  if (!topbar || !document.querySelector('#routeList')) return;
  const badge = document.createElement('span');
  badge.className = 'edition-label';
  badge.textContent = edition === 'personal' ? 'PERSONAL · 个人版' : 'MULTI · 多人版';
  topbar.querySelector('.brand')?.append(badge);
  // Personal keeps its existing lazy tab loaders and controls unchanged.
  if (edition !== 'multi') return;
  const container = topbar.parentElement;
  const groups = new Map();
  for (const card of [...container.children].filter(el => el.classList.contains('card'))) {
    const label = card.querySelector('.sec-title')?.textContent || '';
    const name = card.querySelector('#routeList') ? 'routes'
      : card.querySelector('#userList, #inviteList') ? 'users'
      : card.querySelector('#domainList') ? 'domains'
      : card.querySelector('#auditList') ? 'logs' : 'overview';
    if (!groups.has(name)) {
      const pane = document.createElement('section');
      pane.className = 'workspace-pane'; pane.id = `workspace-${name}`;
      pane.setAttribute('role', 'tabpanel');
      groups.set(name, pane); container.append(pane);
    }
    groups.get(name).append(card);
  }
  const nav = document.createElement('nav');
  nav.className = 'tabbar'; nav.setAttribute('aria-label', '工作区导航'); nav.setAttribute('role', 'tablist');
  const definitions = [['overview', '📊 概览'], ['routes', '🚦 路由'], ['users', '👥 用户与邀请'], ['domains', '🌐 优选'], ['logs', '📜 日志']];
  const activate = name => {
    if (!groups.has(name)) name = groups.keys().next().value;
    for (const [key, pane] of groups) pane.hidden = key !== name;
    for (const button of nav.children) {
      const active = button.dataset.tab === name;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    }
    try { sessionStorage.setItem('emby-multi-tab', name); } catch {}
  };
  for (const [name, label] of definitions) {
    if (!groups.has(name)) continue;
    const button = document.createElement('button');
    button.className = 'tab-btn'; button.type = 'button'; button.textContent = label;
    button.dataset.tab = name; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', `workspace-${name}`);
    button.addEventListener('click', () => activate(name)); nav.append(button);
  }
  topbar.after(nav);
  let initial = 'overview';
  try { initial = sessionStorage.getItem('emby-multi-tab') || initial; } catch {}
  activate(initial);
})();
