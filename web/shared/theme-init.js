(function(){
  var pref='auto';
  try{ var s=localStorage.getItem('proxy-theme'); if(s==='dark'||s==='light'||s==='auto') pref=s; }catch(e){}
  function darkNow(){ return pref==='dark'||(pref==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches); }
  document.documentElement.setAttribute('data-theme',darkNow()?'dark':'light');
  document.documentElement.setAttribute('data-theme-pref',pref);
})();
