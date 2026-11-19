(function(){
  var lastP=null;
  function todayKey(){ return new Date(Date.now()+8*3600000).toISOString().slice(0,10); }
  function buildVars(p,dark){
    var a=hsl2rgb(p.h,p.s,dark?0.55:0.40);
    var v={'--accent':'rgb('+a.r+','+a.g+','+a.b+')',
      '--accent-dim':'rgba('+a.r+','+a.g+','+a.b+','+(dark?'0.12':'0.09')+')',
      '--accent-line':'rgba('+a.r+','+a.g+','+a.b+',0.45)',
      '--accent-ink':colorYiq(a.r,a.g,a.b)>150?'#0b1620':'#ffffff'};
    if(dark){
      var bg=hsl2rgb(p.bh,p.bs,0.05);
      var sf=hsl2rgb(p.bh,0.3,0.09),sf2=hsl2rgb(p.bh,0.28,0.13),ib=hsl2rgb(p.bh,0.28,0.06);
      v['--bg']='rgb('+bg.r+','+bg.g+','+bg.b+')';
      v['--glow']='rgba('+a.r+','+a.g+','+a.b+',0.07)';
      v['--surface']='rgba('+sf.r+','+sf.g+','+sf.b+',0.58)';
      v['--surface-2']='rgba('+sf2.r+','+sf2.g+','+sf2.b+',0.45)';
      v['--input-bg']='rgba('+ib.r+','+ib.g+','+ib.b+',0.62)';
      v['--veil-rgb']=bg.r+','+bg.g+','+bg.b;
    }
    return v;
  }
  function applyDyn(p){
    lastP=p;
    var dark=document.documentElement.getAttribute('data-theme')!=='light';
    var v=buildVars(p,dark),st=document.documentElement.style;
    for(var k in v)st.setProperty(k,v[k]);
    var meta=document.querySelector('meta[name=theme-color]');
    if(meta&&dark&&v['--bg'])meta.setAttribute('content',v['--bg']);
  }
  window.__dynPalThemeHook=function(){ if(lastP)applyDyn(lastP); };
  window.__dynBuildVars=buildVars;
  var stored=null;
  try{stored=JSON.parse(localStorage.getItem('dyn-pal')||'null');}catch(e){}
  if(stored&&stored.d===todayKey()&&typeof stored.h==='number'&&typeof stored.bh==='number'){try{applyDyn(stored);}catch(e){}}
  function extract(){
    var img=new Image();
    img.onload=function(){
      try{
        var c=document.createElement('canvas');c.width=48;c.height=48;
        var ctx=c.getContext('2d');if(!ctx)return;
        ctx.drawImage(img,0,0,48,48);
        var d=ctx.getImageData(0,0,48,48).data;
        var buckets={},total=0;
        for(var i=0;i<d.length;i+=4){
          var r=d[i],g=d[i+1],b=d[i+2];
          if(d[i+3]<128)continue;
          var mx=Math.max(r,g,b),mn=Math.min(r,g,b);
          var l=(mx+mn)/510;
          if(l<0.06||l>0.94)continue;
          var dd=(mx-mn)/255;
          var s=dd===0?0:dd/(1-Math.abs(2*l-1));
          total++;
          var key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);
          var bk=buckets[key];if(!bk){bk={n:0,r:0,g:0,b:0,s:0};buckets[key]=bk;}
          bk.n++;bk.r+=r;bk.g+=g;bk.b+=b;bk.s+=s;
        }
        if(total<60)return;
        var best=null,bestScore=0,dom=null,domN=0;
        for(var k in buckets){var x=buckets[k];
          if(x.n>domN){domN=x.n;dom=x;}
          var as=x.s/x.n;
          if(as>=0.28){var sc=x.n*(as+0.1);if(sc>bestScore){bestScore=sc;best=x;}}
        }
        if(!best||best.n<12)return;
        var ac=rgb2hsl(best.r/best.n,best.g/best.n,best.b/best.n);
        var bc=dom?rgb2hsl(dom.r/dom.n,dom.g/dom.n,dom.b/dom.n):ac;
        var p={d:todayKey(),h:Math.round(ac.h),s:clampNum(ac.s,0.45,0.8),bh:Math.round(bc.h),bs:clampNum(bc.s||0.2,0.15,0.35)};
        var old=null;try{old=JSON.parse(localStorage.getItem('dyn-pal')||'null');}catch(e){}
        if(old&&old.d===p.d&&old.h===p.h&&old.bh===p.bh)return;
        try{localStorage.setItem('dyn-pal',JSON.stringify(p));}catch(e){}
        applyDyn(p);
      }catch(e){}
    };
    img.src='/bing-wallpaper';
  }
  if(document.readyState==='complete')extract();else window.addEventListener('load',extract);
})();
