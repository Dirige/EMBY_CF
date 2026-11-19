async function register(){
  const invite=document.getElementById('regInvite').value.trim();
  const username=document.getElementById('regUsername').value.trim();
  const password=document.getElementById('regPassword').value;
  const password2=document.getElementById('regPassword2').value;
  const err=document.getElementById('regErr');
  const btn=document.getElementById('regBtn');
  err.textContent='';
  if(!invite){ err.textContent='请输入邀请码'; return; }
  if(!username){ err.textContent='请输入用户名'; return; }
  if(!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(username.toLowerCase())){ err.textContent='用户名需为 3-32 位小写字母、数字或短横线，且不能以 - 开头/结尾'; return; }
  if(password.length<6){ err.textContent='密码至少 6 位'; return; }
  if(password!==password2){ err.textContent='两次输入的密码不一致'; return; }
  btn.disabled=true; btn.textContent='注册中...';
  try{
    const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite,username,password})});
    const d=await r.json();
    if(d.ok){
      if(d.dnsWarning){ alert('账号已创建，但 DNS 记录自动创建失败：' + d.dnsWarning + '\n\n登录后可在「我的入口」中重试。'); }
      location.href='/admin'; return;
    }
    err.textContent=d.error||'注册失败';
  } catch(e){ err.textContent='请求失败: '+e.message; }
  btn.disabled=false; btn.textContent='注 册';
}
