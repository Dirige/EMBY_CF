function hsl2rgb(h,s,l){h=((h%360)+360)%360;var c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,r,g,b;
if(h<60){r=c;g=x;b=0}else if(h<120){r=x;g=c;b=0}else if(h<180){r=0;g=c;b=x}else if(h<240){r=0;g=x;b=c}else if(h<300){r=x;g=0;b=c}else{r=c;g=0;b=x}
return{r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255)};}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h=0,s=0,l=(mx+mn)/2,d=mx-mn;
if(d>0){s=l>0.5?d/(2-mx-mn):d/(mx+mn);
if(mx===r)h=60*(((g-b)/d)%6);else if(mx===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
if(h<0)h+=360;return{h:h,s:s,l:l};}
function colorYiq(r,g,b){return (r*299+g*587+b*114)/1000;}
function clampNum(v,a,b){return v<a?a:(v>b?b:v);}
