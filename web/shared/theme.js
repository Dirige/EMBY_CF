var THEME_PREF=document.documentElement.getAttribute('data-theme-pref')||'auto';
function applyTheme(pref){
  THEME_PREF=pref;
  var dark=pref==='dark'||(pref==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  document.documentElement.setAttribute('data-theme-pref',pref);
  var btn=document.getElementById('themeToggle');
  if(btn){ btn.textContent=pref==='auto'?'AUTO':(pref==='dark'?'DARK':'LIGHT'); btn.title=pref==='auto'?'跟随系统':(pref==='dark'?'深色模式':'浅色模式'); }
  var meta=document.querySelector('meta[name=theme-color]');
  if(meta){ meta.setAttribute('content',dark?'#06090f':'#f2f5f8'); }
  if(window.__dynPalThemeHook){ try{ window.__dynPalThemeHook(); }catch(e){} }
}
function cycleTheme(){
  var next=THEME_PREF==='auto'?'dark':(THEME_PREF==='dark'?'light':'auto');
  try{ localStorage.setItem('proxy-theme',next); }catch(e){}
  applyTheme(next);
}
if(window.matchMedia){
  try{
    var mq=matchMedia('(prefers-color-scheme: dark)');
    var onMq=function(){ if(THEME_PREF==='auto') applyTheme('auto'); };
    if(mq.addEventListener){ mq.addEventListener('change',onMq); } else if(mq.addListener){ mq.addListener(onMq); }
  }catch(e){}
}
applyTheme(THEME_PREF);
