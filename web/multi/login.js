async function login(){
  const u=document.getElementById('usernameInput').value.trim();
  const p=document.getElementById('passwordInput').value;
  const err=document.getElementById('loginErr');
  const btn=document.getElementById('loginBtn');
  err.textContent='';
  if(!p){ err.textContent='请输入密码 / 管理密钥'; return; }
  btn.disabled=true; btn.textContent='验证中...';
  const body = u ? {username:u,password:p} : {token:p};
  try{
    const r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(d.ok){ location.href='/admin'; return; }
    err.textContent=d.error||'登录失败';
  } catch(e){ err.textContent='请求失败: '+e.message; }
  btn.disabled=false; btn.textContent='登 录';
}
