import { test, expect } from '@playwright/test';

async function enter(page, edition, member=false) {
  const port=edition==='personal'?4273:4274;
  await page.goto(`http://127.0.0.1:${port}/__preview`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button',{name:member?'验收普通用户视图':edition==='personal'?'进入个人版工作区':'进入管理员工作区'}).click();
  await expect(page).toHaveURL(/\/admin(?:#.*)?$/);
  await expect(page.locator('.edition-label')).toContainText(edition==='personal'?'个人版':'多人版');
}

for(const edition of ['personal','multi']){
 test(`${edition}: import preflight/cancel is read-only and cross-origin probes are forbidden`,async({page,request})=>{
   const origin=`http://127.0.0.1:${edition==='personal'?4273:4274}`;
   const unauth=await request.post(origin+'/admin/api/routes/diagnose',{data:{prefix:'demo'}});
   expect(unauth.status()).toBe(401);
   await enter(page,edition);
   const forbidden=await page.request.post(origin+'/admin/api/routes/diagnose',{headers:{Origin:'https://external.test'},data:{prefix:'demo'}});
   expect(forbidden.status()).toBe(403);
   await page.getByRole(edition==='personal'?'button':'tab',{name:/🚦 路由/}).click();
   const before=await page.evaluate(async()=> (await (await fetch('/admin/api/routes')).json()).map(route=>route.prefix).sort());
   const config={routes:[{prefix:'demo',target:'https://upstream.test'},{prefix:'preflight-only',target:'https://upstream.test'}]};
   const preview=await page.request.post(origin+'/admin/api/import/preview',{data:config});
   expect(preview.ok()).toBe(true);
   const plan=await preview.json();
   expect(plan.added).toContain('preflight-only');expect(plan.overwritten).toContain('demo');
   const confirmation=page.waitForEvent('dialog');
   const uploading=page.locator('#importFile').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(config))});
   const dialog=await confirmation;
   expect(dialog.message()).toContain('覆盖 1 条');
   await dialog.dismiss();
   await uploading;
   const after=await page.evaluate(async()=> (await (await fetch('/admin/api/routes')).json()).map(route=>route.prefix).sort());
   expect(after).toEqual(before);
 });
 test(`${edition}: wallpaper, theme persistence and local visual review`,async({page})=>{
   await enter(page,edition);
   const image=await page.request.get(new URL('/bing-wallpaper',page.url()).href);
   expect(image.ok()).toBe(true);
   expect(image.headers()['content-type']).toMatch(/^image\//);
   expect((await image.body()).length).toBeGreaterThan(100);
   expect(await page.locator('.admin-bg').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('/bing-wallpaper');
   expect(Number(await page.locator('.admin-bg').evaluate(el=>getComputedStyle(el).opacity))).toBeGreaterThan(0);
   await page.locator('#themeToggle').click();
   await page.reload();
   await expect(page.locator('html')).toHaveAttribute('data-theme-pref','dark');
   await page.getByRole(edition==='personal'?'button':'tab',{name:/🚦 路由/}).click();
   await page.locator('#routeSearch').fill('本地测试');
   await page.screenshot({path:`.local/screenshots/${edition}-desktop.png`,fullPage:true});
   await page.setViewportSize({width:390,height:844});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   await page.screenshot({path:`.local/screenshots/${edition}-mobile.png`,fullPage:true});
 });
 test(`${edition}: diagnostic, route copy, selection and status filters work`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await enter(page,edition);
   await expect(page.locator('.console-intro')).toHaveCount(0);
   await expect(page.locator('.console-integrations')).toHaveCount(0);
   await page.getByRole(edition==='personal'?'button':'tab',{name:/🚦 路由/}).click();
   const demo=page.locator('.route-item').filter({has:page.locator('button[data-act="edit"][data-prefix="demo"]')});
   await demo.getByRole('button',{name:'链路诊断'}).click();
   const dialog=page.getByRole('dialog',{name:'线路诊断'});
   await expect(dialog).toBeVisible();
   await expect(dialog.locator('.diagnostic-row')).toHaveCount(1);
   await expect(dialog.locator('.diagnostic-row')).toContainText('API 正常');
   await expect(dialog).not.toContainText('Range 声明');
   await expect(dialog).toContainText('不是客户端 RTT');
   await dialog.getByRole('button',{name:'关闭',exact:true}).click();
   await demo.getByRole('button',{name:'复制为新线路'}).click();
   await expect(page.locator('#oldPrefix')).toHaveValue('');
   await expect(page.locator('#routeTarget')).toHaveValue('https://upstream.test');
   const prefix='copy-test-'+edition+'-'+Date.now().toString(36);
   await page.locator('#routePrefix').fill(prefix);
   await page.locator('#modalRoute').getByRole('button',{name:'保存',exact:true}).click();
   await expect(page.locator('#modalRoute')).not.toHaveClass(/show/);
   const copy=page.locator('.route-item').filter({has:page.locator(`button[data-act="edit"][data-prefix="${prefix}"]`)});
   await expect(copy).toHaveCount(1);
   await copy.getByRole('checkbox',{name:`选择线路 ${prefix}`}).check();
   await expect(page.getByRole('button',{name:'停用所选',exact:true})).toBeEnabled();
   page.once('dialog',dialog=>dialog.accept());
   await page.getByRole('button',{name:'停用所选',exact:true}).click();
   await expect(copy).toHaveAttribute('data-console-enabled','false');
   await page.getByRole('combobox',{name:'线路状态筛选'}).selectOption('enabled');
   await expect(copy).toBeHidden();
   await page.getByRole('combobox',{name:'线路状态筛选'}).selectOption('disabled');
   await expect(copy).toBeVisible();
   expect(errors).toEqual([]);
 });
 test(`${edition}: preview uses the original personal landing layout`,async({page})=>{
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${edition==='personal'?4273:4274}/__preview`);
    await expect(page.locator('body')).toHaveClass('lp2');
    expect(await page.locator('.lp2-photo').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('/bing-wallpaper');
   await expect(page.locator('.lp2-left h1')).toHaveText('Emby 边缘代理');
   await expect(page.locator('.lp2-chips > div')).toHaveCount(3);
   await expect(page.locator('.lp2-right h2')).toHaveText('快捷入口');
   await expect(page.locator('body')).not.toContainText('原来的毛玻璃，全新的结构');
   expect(await page.locator('.lp2-card').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
   await page.setViewportSize({width:390,height:844});
   expect(await page.locator('.lp2-card').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   expect(errors).toEqual([]);
 });
 test(`${edition}: original glass style, route editor and settings work`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await enter(page,edition);
   await page.getByRole(edition==='personal'?'button':'tab',{name:/🚦 路由/}).click();
  await expect(page.locator('#routeList')).toContainText('本地测试');
  const blur=await page.locator('.card:visible').first().evaluate(el=>getComputedStyle(el).backdropFilter);
  expect(blur).toContain('blur');
  await page.getByRole('button',{name:'添加路由',exact:true}).click();
   await expect(page.locator('#modalRoute')).toHaveClass(/show/);
    if (edition === 'personal') {
      await expect(page.locator('#routeRelayMode')).toHaveValue('auto');
      await expect(page.locator('#routeRelayMode option')).toHaveCount(3);
      await expect(page.locator('#modalRoute')).toContainText('401/403/451');
      await expect(page.locator('#modalRoute')).toContainText('优先 VPS 2 分钟');
      await expect(page.locator('#modalRoute')).toContainText('下载慢不会中途重发视频');
    }
  await page.locator('#routePrefix').fill('browser-'+edition+'-'+Date.now().toString(36));
  await page.locator('#routeRemark').fill('浏览器本地验收');
  await page.locator('#routeTarget').fill('https://upstream.test');
  await page.locator('#modalRoute').getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('#modalRoute')).not.toHaveClass(/show/);
   await expect(page.locator('#routeList')).toContainText('浏览器本地验收');
   if (edition === 'personal') {
     await expect(page.locator('.route-item').filter({ hasText: '浏览器本地验收' }).last()).toContainText('VPS 中继：自动');
   }
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await expect(page.locator('#modalSettings')).toHaveClass(/show/);
  await page.locator('#modalSettings').getByRole('button',{name:'取消',exact:true}).click();
  expect(errors).toEqual([]);
 });
 test(`${edition}: theme cycle and mobile layout`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await enter(page,edition);
  await page.locator('#themeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-pref','dark');
  await page.locator('#themeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-pref','light');
   await page.getByRole(edition==='personal'?'button':'tab',{name:/🚦 路由/}).click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 });
 test(`${edition}: short mobile viewport can edit the first route fields`,async({page})=>{
   await page.setViewportSize({width:390,height:480});
   await enter(page,edition);
   await page.getByRole(edition==='personal'?'button':'tab',{name:/🚦 路由/}).click();
   await page.getByRole('button',{name:'添加路由',exact:true}).click();
   const modal=page.locator('#modalRoute');
   await expect(modal).toBeVisible();
   expect(await modal.evaluate(el=>el.querySelector('.modal-inner').getBoundingClientRect().top>=el.getBoundingClientRect().top)).toBe(true);
   for (const [id,value] of [['routeRemark','手机测试'],['routePrefix','mobile-demo']]) {
     const field=modal.locator('#'+id);
     await field.click();
     await expect(field).toBeFocused();
     await field.fill(value);
     await expect(field).toHaveValue(value);
   }
   await modal.getByRole('button',{name:'取消',exact:true}).click();
   await expect(modal).toBeHidden();
 });
}

test('multi: member cannot see or call administrator controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await enter(page,'multi',true);
 await expect(page.locator('#userList')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'设置',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'链路诊断',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:/🚦 路由/}).click();
 await expect(page.locator('#routeList')).toContainText('用户私有线路');
 await expect(page.locator('#routeList')).not.toContainText('分离推流线路');
 const status=await page.evaluate(async()=> (await fetch('/admin/api/users')).status);
  expect(status).toBe(401);expect(errors).toEqual([]);
  const diagnosticStatus=await page.evaluate(async()=> (await fetch('/admin/api/routes/diagnose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'demo'})})).status);
  expect(diagnosticStatus).toBe(401);
});

test('preview rejects cross-origin login and arbitrary host',async({request})=>{
 const origin='http://127.0.0.1:4273';
 const r=await request.post(origin+'/__preview/login',{headers:{Origin:'https://external.test'}});expect(r.status()).toBe(403);
 const host=await request.get(origin+'/__preview/health',{headers:{Host:'external.test'}});expect(host.status()).toBe(403);
});

test('personal: notification and password settings work on a short mobile viewport (mocked writes)', async ({page}) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:480});
  await enter(page,'personal');
  let state={success:true,telegram:true,webhook:false,tokenConfigured:true,chatId:'-100123',source:'web',encryptionReady:true,last:null};
  const writes=[];
  await page.route('**/admin/api/notifications', async route=>{
    if(route.request().method()==='POST') {
      const data=route.request().postDataJSON(); writes.push(data);
      state={...state,telegram:!data.clear,tokenConfigured:!data.clear,chatId:data.clear?'':data.chatId,source:data.clear?'disabled':'web'};
    }
    await route.fulfill({json:state});
  });
  await page.route('**/admin/api/notifications/test', async route=>{
    state={...state,last:{kind:'test',ok:true,at:'2026-11-21T00:00:00Z'}};
    await route.fulfill({json:{ok:true}});
  });
  await page.route('**/admin/api/security/password', async route=>{
    writes.push(route.request().postDataJSON());
    await route.fulfill({json:{ok:true}});
  });
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await expect(page.locator('#modalSettings')).toContainText('告警优先显示安全的线路备注');
  await expect(page.locator('#tgBotToken')).toHaveValue('');
  await page.locator('#tgBotToken').fill('123456:synthetic-token');
  await page.locator('#tgChatId').fill('-100999');
  await page.locator('#btnSaveTelegram').click();
  await expect(page.locator('#tgBotToken')).toHaveValue('');
  expect(writes.at(-1)).toEqual({token:'123456:synthetic-token',chatId:'-100999'});
  await page.locator('#btnTestTelegram').click();
  await expect(page.locator('#tgLastStatus')).toContainText('成功');
  await page.locator('#newPassword').fill('short');
  await page.locator('#confirmPassword').fill('short');
  await page.locator('#btnChangePassword').click();
  await expect(page.locator('#toast')).toContainText('12–128');
  await page.locator('#currentPassword').fill('synthetic-old');
  await page.locator('#newPassword').fill('synthetic-new-password');
  await page.locator('#confirmPassword').fill('synthetic-new-password');
  page.once('dialog', dialog=>dialog.accept());
  await page.locator('#btnChangePassword').click();
  await expect(page).toHaveURL('http://127.0.0.1:4273/');
  expect(writes.at(-1)).toEqual({currentPassword:'synthetic-old',newPassword:'synthetic-new-password',confirmPassword:'synthetic-new-password'});
  expect(errors).toEqual([]);
});
