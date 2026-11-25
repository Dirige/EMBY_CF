import { test, expect } from '@playwright/test';

async function enter(page, member = false) {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('http://127.0.0.1:4274/__preview', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: member ? '验收普通用户视图' : '进入管理员工作区' }).click();
  await expect(page).toHaveURL(/\/admin(?:#.*)?$/);
}

test('multi: administrator TG configuration can save, retain, test and explicitly disable without exposing the Token (mocked writes)', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  let state = { ok: true, telegram: true, webhook: true, tokenConfigured: true, chatId: '-100123', source: 'web', encryptionReady: true, last: null };
  const writes = [];
  await page.route('**/admin/api/settings', route => route.fulfill({ json: { settings: { health_check: '0', tg_daily_report: '0', tg_route_alerts: '1' }, notify: state } }));
  await page.route('**/admin/api/notifications', async route => {
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON(); writes.push(data);
      state = { ...state, telegram: !data.clear, tokenConfigured: !data.clear, chatId: data.clear ? '' : data.chatId, source: data.clear ? 'disabled' : 'web' };
    }
    await route.fulfill({ json: state });
  });
  await page.route('**/admin/api/notifications/test', async route => {
    state = { ...state, last: { kind: 'test', ok: true, at: '2026-11-24T00:00:00Z' } };
    await route.fulfill({ json: { ok: true } });
  });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const modal = page.locator('#modalSettings');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('只修改当前账号');
  await expect(modal).toContainText('SESSION_SECRET');
  await expect(modal).toContainText('下载慢不会中途重发视频');
  await expect(page.locator('#tgBotToken')).toHaveValue('');
  await expect(page.locator('#tgBotToken')).toHaveAttribute('type', 'password');
  await expect(page.locator('#tgChatId')).toHaveValue('-100123');
  await expect(page.locator('#tgConfigStatus')).toContainText('网页加密配置');
  expect(await modal.evaluate(element => element.querySelector('.modal-inner').getBoundingClientRect().top >= element.getBoundingClientRect().top)).toBe(true);
  await page.locator('#tgBotToken').fill('123456:synthetic-browser-token');
  await page.locator('#tgChatId').fill('-100999');
  await page.locator('#btnTestTelegram').click();
  await expect(page.locator('#toast')).toContainText('请先保存');
  await page.locator('#btnSaveTelegram').click();
  await expect(page.locator('#tgBotToken')).toHaveValue('');
  expect(writes.at(-1)).toEqual({ token: '123456:synthetic-browser-token', chatId: '-100999' });
  await page.locator('#tgChatId').fill('-100888');
  await page.locator('#btnSaveTelegram').click();
  expect(writes.at(-1)).toEqual({ token: '', chatId: '-100888' });
  await page.locator('#btnTestTelegram').click();
  await expect(page.locator('#tgLastStatus')).toContainText('成功');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '清除并停用 TG', exact: true }).click();
  expect(writes).toHaveLength(2);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '清除并停用 TG', exact: true }).click();
  await expect(page.locator('#tgConfigStatus')).toContainText('已停用');
  await expect(page.locator('#tgChatId')).toHaveValue('');
  expect(writes.at(-1)).toEqual({ clear: true });
  await page.locator('#setXfo').selectOption('off');
  await expect(page.locator('#setXfo')).toHaveValue('off');
  expect(await page.locator('#routeRelayMode').count()).toBe(0);
  expect(errors).toEqual([]);
});

for (const member of [false, true]) {
  test(`multi: ${member ? 'member' : 'administrator'} password modal validates, cancels and submits only to the current-account endpoint (mocked writes)`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await enter(page, member);
    const writes = [];
    let success = false;
    const endpoint = member ? '/api/user/password' : '/admin/api/security/password';
    await page.route('**' + endpoint, async route => {
      writes.push({ path: new URL(route.request().url()).pathname, data: route.request().postDataJSON() });
      await route.fulfill({ status: success ? 200 : 403, json: success ? { ok: true } : { ok: false, error: '当前密码错误' } });
    });
    if (member) {
      await expect(page.locator('#tgBotToken')).toHaveCount(0);
      await expect(page.locator('#modalSettings')).toHaveCount(0);
      await page.getByRole('button', { name: '改密码', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '设置', exact: true }).click();
    }
    const modal = page.locator(member ? '#modalPassword' : '#modalSettings');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('不影响其他用户');
    await expect(page.locator('#currentPassword')).toHaveAttribute('type', 'password');
    await page.locator('#newPassword').fill('short');
    await page.locator('#confirmPassword').fill('short');
    await page.locator('#btnChangePassword').click();
    await expect(page.locator('#toast')).toContainText('12–128');
    expect(writes).toHaveLength(0);
    const currentPassword = 'synthetic-browser-current';
    const newPassword = '  synthetic-browser-new-password  ';
    await page.locator('#currentPassword').fill(currentPassword);
    await page.locator('#newPassword').fill(newPassword);
    await page.locator('#confirmPassword').fill(newPassword);
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#btnChangePassword').click();
    expect(writes).toHaveLength(0);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#btnChangePassword').click();
    await expect(page.locator('#toast')).toContainText('当前密码错误');
    await expect(page.locator('#currentPassword')).toHaveValue('');
    await expect(page.locator('#newPassword')).toHaveValue('');
    await expect(page.locator('#btnChangePassword')).toBeEnabled();
    expect(writes.at(-1)).toEqual({ path: endpoint, data: { currentPassword, newPassword, confirmPassword: newPassword } });
    await expect(page).toHaveURL(/\/admin(?:#.*)?$/);
    success = true;
    await page.locator('#currentPassword').fill(currentPassword);
    await page.locator('#newPassword').fill(newPassword);
    await page.locator('#confirmPassword').fill(newPassword);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#btnChangePassword').click();
    await expect(page).toHaveURL('http://127.0.0.1:4274/');
    expect(writes).toHaveLength(2);
    expect(errors).toEqual([]);
  });
}
