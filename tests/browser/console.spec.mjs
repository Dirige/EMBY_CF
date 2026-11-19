import { test, expect } from '@playwright/test';

async function enter(page, edition, member=false) {
  const port=edition==='personal'?4273:4274;
  await page.goto(`http://127.0.0.1:${port}/__preview`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button',{name:member?'验收普通用户视图':edition==='personal'?'进入个人版工作区':'进入管理员工作区'}).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('.edition-label')).toContainText(edition==='personal'?'个人版':'多人版');
}

for(const edition of ['personal','multi']){
 test(`${edition}: original glass style, route editor and settings work`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await enter(page,edition);
  await page.getByRole('button',{name:/🚦 路由/}).click();
  await expect(page.locator('#routeList')).toContainText('本地测试');
  const blur=await page.locator('.card:visible').first().evaluate(el=>getComputedStyle(el).backdropFilter);
  expect(blur).toContain('blur');
  await page.getByRole('button',{name:'添加路由',exact:true}).click();
  await expect(page.locator('#modalRoute')).toHaveClass(/show/);
  await page.locator('#routePrefix').fill('browser-'+edition+'-'+Date.now().toString(36));
  await page.locator('#routeRemark').fill('浏览器本地验收');
  await page.locator('#routeTarget').fill('https://upstream.test');
  await page.locator('#modalRoute').getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('#modalRoute')).not.toHaveClass(/show/);
  await expect(page.locator('#routeList')).toContainText('浏览器本地验收');
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
  await page.getByRole('button',{name:/🚦 路由/}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 });
}

test('multi: member cannot see or call administrator controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await enter(page,'multi',true);
 await expect(page.locator('#userList')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'设置',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/🚦 路由/}).click();
 await expect(page.locator('#routeList')).toContainText('用户私有线路');
 await expect(page.locator('#routeList')).not.toContainText('分离推流线路');
 const status=await page.evaluate(async()=> (await fetch('/admin/api/users')).status);
 expect(status).toBe(401);expect(errors).toEqual([]);
});

test('preview rejects cross-origin login and arbitrary host',async({request})=>{
 const origin='http://127.0.0.1:4273';
 const r=await request.post(origin+'/__preview/login',{headers:{Origin:'https://external.test'}});expect(r.status()).toBe(403);
 const host=await request.get(origin+'/__preview/health',{headers:{Host:'external.test'}});expect(host.status()).toBe(403);
});
