import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Script } from 'node:vm';
import { loadEdition, fixture } from './helpers.mjs';

for (const edition of ['personal','multi']) {
  for (const baseline of [true,false]) {
    const label=`${edition}/${baseline?'baseline':'refactor'}`;
    test(`${label}: Range, If-Range, HEAD and 206 remain intact`, async()=>{
      const m=await loadEdition(edition,baseline), f=fixture(m,edition);
      try {
        f.respond(req=>{
          assert.equal(req.headers.get('Range'),'bytes=2-5');assert.equal(req.headers.get('If-Range'),'"fixture-etag"');
          return new Response(req.method==='HEAD'?null:'2345',{status:206,headers:{'Content-Range':'bytes 2-5/10','Content-Length':'4','Accept-Ranges':'bytes'}});
        });
        for(const method of ['GET','HEAD']){
          const res=await f.serve(f.request('/demo/Videos/fixture/stream.mkv',{method,headers:{Range:'bytes=2-5','If-Range':'"fixture-etag"'}}));
          assert.equal(res.status,206);assert.equal(res.headers.get('Content-Range'),'bytes 2-5/10');assert.equal(await res.text(),method==='HEAD'?'':'2345');
        }
      } finally{f.restore();}
    });
    test(`${label}: 416 is not converted to success or retried`,async()=>{
      const m=await loadEdition(edition,baseline),f=fixture(m,edition);
      try{f.respond(()=>new Response(null,{status:416,headers:{'Content-Range':'bytes */10'}}));const r=await f.serve(f.request('/demo/Videos/fixture/stream.mkv',{headers:{Range:'bytes=100-'}}));assert.equal(r.status,416);assert.equal(f.calls.length,1);}finally{f.restore();}
    });
    test(`${label}: a single upstream is attempted despite a down marker`,async()=>{
      const m=await loadEdition(edition,baseline),f=fixture(m,edition);
      try{m.hostDownUntil.set('api.test',Date.now()+30_000);f.respond(()=>new Response('fixture'));const r=await f.serve(f.request('/demo/Videos/fixture/stream.mkv'));assert.equal(r.status,200);assert.equal(f.calls.length,1);}finally{f.restore();}
    });
    test(`${label}: disabled routes never fetch`,async()=>{
      const m=await loadEdition(edition,baseline),f=fixture(m,edition,{enabled:0});
      try{f.respond(()=>{throw new Error('Must not fetch');});const r=await f.serve(f.request('/demo/Videos/fixture/stream.mkv'));assert.equal(r.status,503);assert.equal(f.calls.length,0);}finally{f.restore();}
    });
    test(`${label}: netdisk redirect retains query spelling and repeated keys`,async()=>{
      const m=await loadEdition(edition,baseline),f=fixture(m,edition,{stream_target:''});
      const target='https://download.123pan.com/opaque%2Fpath?fixture=A%2Bz%2f%3D&name=a+b&empty=&fixture=second';
      try{f.respond(()=>new Response(null,{status:302,headers:{Location:target}}));const r=await f.serve(f.request('/demo/Videos/fixture/stream.mkv'));assert.equal(r.status,302);assert.equal(r.headers.get('Location'),target);assert.equal(f.calls.length,1);}finally{f.restore();}
    });
    test(`${label}: media stream is returned before its full body exists`,async()=>{
      const m=await loadEdition(edition,baseline),f=fixture(m,edition);
      let output;const stream=new ReadableStream({start(c){output=c;}});
      try{f.respond(()=>new Response(stream));const r=await f.serve(f.request('/demo/Videos/fixture/stream.mkv'));assert.equal(r.status,200);output.enqueue(new TextEncoder().encode('synthetic'));output.close();assert.equal(await r.text(),'synthetic');assert.equal(f.cacheWrites.length,0);}finally{f.restore();}
    });
    test(`${label}: custom headers preserve explicit empty Referer`,async()=>{
      const m=await loadEdition(edition,baseline),f=fixture(m,edition,{custom_headers:'Referer:'});
      try{f.respond(req=>{assert.equal(req.headers.has('Referer'),true);assert.equal(req.headers.get('Referer'),'');return new Response('fixture');});await f.serve(f.request('/demo/Videos/fixture/stream.mkv'));}finally{f.restore();}
    });
    test(`${label}: 8 concurrent Range requests remain independent`,async()=>{
      const m=await loadEdition(edition,baseline),f=fixture(m,edition);
      try{f.respond(req=>new Response(req.headers.get('Range'),{status:206}));const values=await Promise.all(Array.from({length:8},async(_,i)=>{const range=`bytes=${i*4}-${i*4+3}`;const r=await f.serve(f.request('/demo/Videos/fixture/stream.mkv',{headers:{Range:range}}));return[range,await r.text()];}));for(const[a,b]of values)assert.equal(a,b);assert.equal(f.calls.length,8);}finally{f.restore();}
    });
    test(`${label}: upstream request headers strip cross-origin credentials`,async()=>{
      const m=await loadEdition(edition,baseline);
      const req=new Request('https://proxy.test/x',{headers:{Authorization:'fixture-only',Cookie:'fixture-only',Referer:'https://proxy.test/'}});
      const h=m.buildUpstreamHeaders(req,new URL('https://other.test'),{ipMode:'strip',compatMode:false,crossOrigin:true});
      assert.equal(h.has('Authorization'),false);assert.equal(h.has('Cookie'),false);assert.equal(h.has('Referer'),false);
    });
  }
}

for(const baseline of [true,false]){
 test(`multi/${baseline?'baseline':'refactor'}: mapped media paths and default API Referer stay unchanged`,async()=>{
  const m=await loadEdition('multi',baseline),f=fixture(m,'multi');
  const location='https://media.test/opaque%2Fpath?fixture=x%2By&fixture=second';
  try{
   f.respond(req=>req.url.startsWith('https://api.test')?new Response(null,{status:302,headers:{Location:location}}):new Response('fixture',{status:206}));
   const r=await f.serve(f.request('/demo/Videos/fixture/stream.mkv'));const mapped=r.headers.get('Location');
   assert.equal(mapped,'https://alice.example.test/demo/__stream/0/opaque%2Fpath?fixture=x%2By&fixture=second');
   const media=await f.serve(new Request(mapped,{headers:{Range:'bytes=0-3','cf-connecting-ip':'198.51.100.10'}}));
   assert.equal(media.status,206);assert.equal(f.calls[1].url,location);assert.equal(f.calls[1].headers.get('Referer'),'https://api.test/web/index.html');
  }finally{f.restore();}
 });
 test(`multi/${baseline?'baseline':'refactor'}: invalid stream mapping never chooses an arbitrary target`,async()=>{
  const m=await loadEdition('multi',baseline),f=fixture(m,'multi');
  try{f.respond(()=>{throw new Error('Must not fetch');});const r=await f.serve(f.request('/demo/__stream/99/opaque'));assert.equal(r.status,404);assert.equal(f.calls.length,0);}finally{f.restore();}
 });
}

test('shared netdisk authority is 66 unique entries for both editions',async()=>{
 const p=await loadEdition('personal'),m=await loadEdition('multi');assert.equal(p.MANUAL_REDIRECT_DOMAINS.length,66);assert.equal(new Set(p.MANUAL_REDIRECT_DOMAINS).size,66);assert.deepEqual(p.MANUAL_REDIRECT_DOMAINS,m.MANUAL_REDIRECT_DOMAINS);
});
test('all generated admin browser scripts parse for personal/admin/member',async()=>{
 for(const edition of ['personal','multi']){
  const m=await loadEdition(edition);
  for(const role of edition==='personal'?[null]:[{isAdmin:true,username:'admin'},{isAdmin:false,username:'alice'}]){
   const html=m.buildAdminHtml(role,{BASE_DOMAIN:'example.test'});
   for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new Script(match[1]);
   assert.ok(html.includes('backdrop-filter: blur(18px)'));
  }
 }
});
