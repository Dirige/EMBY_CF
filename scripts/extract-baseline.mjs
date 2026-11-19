/** One-time, syntax-aware migration. Generated files become editable source.
 * Never run this over an existing src tree. Baseline files remain untouched.
 */
import ts from 'typescript';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
try { await access(path.join(root, 'src')); throw new Error('src exists; refusing to overwrite editable source'); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
const printer = ts.createPrinter({ removeComments: false, newLine: ts.NewLineKind.LineFeed });
const editions = {};
const specialTheme = new Set(['PAGE_STYLE', 'THEME_INIT', 'THEME_LOGIC', 'PALETTE_MATH', 'DYN_PALETTE']);

function normalize(source, filename) {
  const sf = ts.createSourceFile(filename, source.slice(source.indexOf('var CURRENT_VERSION =')), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const result = ts.transform(sf, [context => {
    const visit = node => {
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(sf) === '__name') return undefined;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === '__name') return ts.visitNode(node.arguments[0], visit);
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit);
  }]);
  const text = printer.printFile(result.transformed[0]); result.dispose(); return text;
}
function bindingNames(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return [node.name.text];
  if (ts.isVariableStatement(node)) return node.declarationList.declarations.map(d => d.name).filter(ts.isIdentifier).map(d => d.text);
  return [];
}
for (const [edition, baseline] of Object.entries({ personal: 'personal/worker.js', multi: 'worker.js' })) {
  const filename = `/baseline/${edition}.js`;
  const source = normalize(await readFile(path.join(root, baseline), 'utf8'), filename);
  const options = { allowJs: true, noLib: true, noResolve: true, target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = name => name === filename ? ts.createSourceFile(filename, source, options.target, true, ts.ScriptKind.JS) : undefined;
  const program = ts.createProgram([filename], options, host);
  const sf = program.getSourceFile(filename), checker = program.getTypeChecker();
  const items = sf.statements.filter(n => !ts.isExportDeclaration(n)).map(node => ({ node, names: bindingNames(node), text: node.getFullText(sf).trim(), deps: new Set(), writes: new Set() }));
  const names = new Map(), symbols = new Map();
  for (const item of items) {
    if (!item.names.length) throw new Error(`Unexpected top-level statement: ${item.text.slice(0, 80)}`);
    for (const name of item.names) names.set(name, item);
    const declarations = ts.isVariableStatement(item.node) ? item.node.declarationList.declarations.map(d => d.name) : [item.node.name];
    for (const node of declarations) symbols.set(checker.getSymbolAtLocation(node), item);
  }
  for (const item of items) {
    const visit = node => {
      if (ts.isIdentifier(node)) {
        const dependency = symbols.get(checker.getSymbolAtLocation(node));
        if (dependency && dependency !== item) item.deps.add(node.text);
        const parent = node.parent;
        const writes = ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
          || (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(parent.operator);
        if (writes && dependency && dependency !== item) item.writes.add(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(item.node);
  }
  editions[edition] = { source, sf, items, names };
}

// Compare syntax text, treating equivalent Unicode spellings as equal.
const canonical = text => text.replace(/\\u\{([\da-f]+)\}/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/\\u([\da-f]{4})/gi, (_, x) => String.fromCharCode(parseInt(x, 16))).replace(/\s+/g, ' ');
const shared = new Set();
for (const [name, p] of editions.personal.names) {
  const m = editions.multi.names.get(name);
  const shareable = ts.isFunctionDeclaration(p.node) || /^[A-Z][A-Z0-9_]+$/.test(name) && name !== 'CONFIG';
  if (m && shareable && canonical(p.text) === canonical(m.text)) shared.add(name);
}
// Only share dependency-closed declarations; edition-specific dependencies stay local.
let changed;
do {
  changed = false;
  for (const name of shared) {
    const item = editions.personal.names.get(name);
    if ([...item.names, ...item.deps].some(dep => !shared.has(dep))) { shared.delete(name); changed = true; }
  }
} while (changed);
for (const name of specialTheme) shared.add(name);

function category(name, edition, node) {
  if (specialTheme.has(name)) return 'ui/theme';
  if (name === 'MANUAL_REDIRECT_DOMAINS') return 'rules/netdisk';
  if (name === 'worker_default' || name === 'bingWallpaper') return 'entry';
  const line = ts.getLineAndCharacterOfPosition(editions[edition].sf, node.getStart()).line;
  const all = editions[edition].names;
  const after = n => all.has(n) && line >= ts.getLineAndCharacterOfPosition(editions[edition].sf, all.get(n).node.getStart()).line;
  const before = n => all.has(n) && line < ts.getLineAndCharacterOfPosition(editions[edition].sf, all.get(n).node.getStart()).line;
  if (name === 'CURRENT_VERSION') return 'version';
  if (after('SPEED_TOOLS') && before('runHealthCheck')) return name.startsWith('build') || name.startsWith('render') ? 'ui/pages' : 'ui/theme';
  if (after('runHealthCheck')) return 'maintenance';
  if (after('clearRouteCache')) return 'proxy/pipeline';
  if (after('normalizePrefix')) return 'admin/api';
  if (after('initDatabase') && before('getOptimizedDomains')) return 'storage/schema';
  if (after('getOptimizedDomains') && before('getEdgeInfo')) return 'integrations/dns';
  if (after('getEdgeInfo') && before('normalizePrefix')) return 'integrations/stats';
  if (after('settingsCache') && before('probeTarget')) return 'config/settings';
  if (after('getCookie') && before('settingsCache')) return 'auth/session';
  if (after('cfFetchGraphql') && before('applySecurityHeaders')) return 'integrations/analytics';
  if (after('applySecurityHeaders') && before('getCookie')) return 'http/responses';
  if (after('probeTarget') && before('initDatabase')) return 'http/validation';
  return 'http/primitives';
}
const modules = new Map();
for (const [edition, data] of Object.entries(editions)) {
  for (const item of data.items) {
    item.location = [...item.names].every(n => shared.has(n)) ? `src/shared/${category(item.names[0], 'personal', editions.personal.names.get(item.names[0]).node)}.js` : `src/editions/${edition}/${category(item.names[0], edition, item.node)}.js`;
    if ([...item.names].some(n => specialTheme.has(n))) item.location = 'src/shared/ui/theme.js';
  }
}
// Merge rare cross-module binding writes rather than converting them into broken imports.
for (const data of Object.values(editions)) {
  do {
    changed = false;
    for (const item of data.items) for (const name of item.writes) {
      const target = data.names.get(name);
      if (target.location !== item.location) {
        if (target.location.startsWith('src/shared/')) throw new Error(`Cannot share mutable binding ${name}`);
        const previous = target.location;
        for (const other of data.items) if (other.location === previous) other.location = item.location;
        changed = true;
      }
    }
  } while (changed);
}
for (const [edition, data] of Object.entries(editions)) {
  for (const item of data.items) {
    if (edition === 'multi' && item.location.startsWith('src/shared/')) continue;
    if (!modules.has(item.location)) modules.set(item.location, { items: [], imports: new Map() });
    const mod = modules.get(item.location); mod.items.push(item);
    for (const name of item.deps) {
      const owner = data.names.get(name);
      if (owner.location === item.location) continue;
      if (!mod.imports.has(owner.location)) mod.imports.set(owner.location, new Set());
      mod.imports.get(owner.location).add(name);
    }
  }
}
for (const [filename, mod] of modules) {
  const imports = [...mod.imports].map(([from, names]) => `import { ${[...names].sort().join(', ')} } from ${JSON.stringify('./' + path.relative(path.dirname(filename), from))};`).join('\n');
  const names = mod.items.flatMap(item => item.names);
  const code = `// Extracted from baseline 4e0357e; editable source, not a deployment bundle.\n${imports}\n\n${mod.items.map(item => item.text).join('\n\n')}\n\nexport { ${names.join(', ')} };\n${names.includes('worker_default') ? 'export default worker_default;\n' : ''}`;
  await mkdir(path.dirname(path.join(root, filename)), { recursive: true });
  await writeFile(path.join(root, filename), code);
}
// Shared theme must include the personal palette, even though the baseline multi lacks it.
for (const edition of ['multi']) {
  const filename = path.join(root, 'src/editions', edition, 'ui/pages.js');
  let code = await readFile(filename, 'utf8');
  code = `import { DYN_PALETTE } from '../../../shared/ui/theme.js';\n` + code;
  code = code.replaceAll('<style>${PAGE_STYLE}</style></head><body>', '<script>${DYN_PALETTE}<\\/script>\n<style>${PAGE_STYLE}</style></head><body>\n<div class="admin-bg" aria-hidden="true"></div>');
  await writeFile(filename, code);
}
await mkdir(path.join(root, 'docs'), { recursive: true });
await writeFile(path.join(root, 'docs/EXTRACTION.json'), JSON.stringify({ baseline: '4e0357e', sharedSymbols: [...shared].sort(), modules: [...modules].map(([file, value]) => ({ file, exports: value.items.flatMap(i => i.names) })) }, null, 2) + '\n');
console.log(`Extracted ${modules.size} modules; ${shared.size} shared symbols. Original Workers untouched.`);
