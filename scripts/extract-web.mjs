/** One-time separation of editable CSS and browser JS from server templates. */
import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(import.meta.dirname, '..');
const replacements = {
  PAGE_STYLE: ['web/shared/glass.css', 'text'],
  THEME_INIT: ['web/shared/theme-init.js', 'text'],
  THEME_LOGIC: ['web/shared/theme.js', 'text'],
  PALETTE_MATH: ['web/shared/palette-math.js', 'text'],
};
async function literalAssets(filename, names) {
  let code = await fs.readFile(path.join(root, filename), 'utf8');
  const sf = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edits = [], imports = [];
  for (const statement of sf.statements) if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) {
    const name = d.name.text;
    if (names[name]) {
      if (!ts.isNoSubstitutionTemplateLiteral(d.initializer)) throw new Error('Not a literal: ' + name);
      const [asset] = names[name], alias = name + '_SOURCE';
      await fs.mkdir(path.dirname(path.join(root, asset)), { recursive: true });
      await fs.writeFile(path.join(root, asset), d.initializer.text.trim() + '\n');
      imports.push(`import ${alias} from ${JSON.stringify('./' + path.relative(path.dirname(filename), asset) + '?text')};`);
      edits.push([d.initializer.getStart(sf), d.initializer.end, alias]);
    }
  }
  for (const [start, end, value] of edits.sort((a,b)=>b[0]-a[0])) code = code.slice(0,start)+value+code.slice(end);
  await fs.writeFile(path.join(root, filename), imports.join('\n')+'\n'+code);
}
await literalAssets('src/shared/ui/theme.js', replacements);
// Palette runtime is the literal second operand; keep its math dependency explicit.
{
 const filename='src/shared/ui/theme.js'; let code=await fs.readFile(path.join(root,filename),'utf8');
 const sf=ts.createSourceFile(filename,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const d=sf.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>d.name.text==='DYN_PALETTE');
 await fs.writeFile(path.join(root,'web/shared/palette.js'), d.initializer.right.text.trim()+'\n');
 code=code.slice(0,d.initializer.getStart(sf))+'PALETTE_MATH + PALETTE_RUNTIME'+code.slice(d.initializer.end);
 await fs.writeFile(path.join(root,filename), 'import PALETTE_RUNTIME from "../../../web/shared/palette.js?text";\n'+code);
}
for (const edition of ['personal','multi']) {
 await literalAssets(`src/editions/${edition}/ui/theme.js`, {
   SPEED_TOOLS:[`web/${edition}/speed-test.js`,'text'],
   ...(edition==='personal'?{LANDING_CSS:['web/personal/landing.css','text']}:{}),
 });
 const filename=`web/${edition}/pages.js`; let code=await fs.readFile(path.join(root,filename),'utf8');
 const sf=ts.createSourceFile(filename,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const edits=[], imports=[];
 for(const fn of sf.statements.filter(ts.isFunctionDeclaration)) {
  // Personal landing's conditional login handler stays in its small SSR template.
  if(edition==='personal' && fn.name.text==='buildFrontendHtml') continue;
  const body=fn.getText(sf);
  const matches=[...body.matchAll(/<script>([\s\S]*?)<\\\/script>/g)];
  for(const match of matches) {
   if(match[1].length<100) continue;
   const name=fn.name.text.replace(/^build/,'').replace(/Html$/,'').toLowerCase();
   const alias=name.toUpperCase()+'_CLIENT';
   let script=match[1].replace('${THEME_LOGIC}','').replace('${SPEED_TOOLS}','');
   if(edition==='multi' && name==='admin') {
    script=script.replace('${isAdmin2 ? "true" : "false"}', 'window.__EMBY_PAGE__.isAdmin');
    script=script.replace(/(['"])\$\{username\}\1/g, 'window.__EMBY_PAGE__.username');
   }
   if(script.includes('${')) throw new Error('Unconverted server interpolation in '+edition+'/'+name);
   // Decode the baseline outer template exactly; no third-party code is evaluated.
   script=vm.runInNewContext('`'+script+'`', Object.create(null), {timeout:1000});
   new vm.Script(script, {filename:`${edition}/${name}.js`});
   await fs.writeFile(path.join(root,`web/${edition}/${name}.js`), script.trim()+'\n');
   imports.push(`import ${alias} from './${name}.js?text';`);
   const bootstrap=edition==='multi'&&name==='admin'?'window.__EMBY_PAGE__ = ${JSON.stringify({ isAdmin: isAdmin2, username }).replace(/</g, "\\\\u003c")};\n':'';
   const value='<script>'+bootstrap+'${THEME_LOGIC}\n'+(match[1].includes('${SPEED_TOOLS}')?'${SPEED_TOOLS}\n':'')+'${'+alias+'}<\\/script>';
   const start=fn.getStart(sf)+match.index;
   edits.push([start,start+match[0].length,value]);
  }
 }
 for(const [start,end,value] of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,start)+value+code.slice(end);
 await fs.writeFile(path.join(root,filename),imports.join('\n')+'\n'+code);
}
console.log('CSS, theme, palette and browser controllers are now editable web/ assets.');
