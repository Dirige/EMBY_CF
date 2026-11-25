import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { Marked } from 'marked';

export const repoRoot = path.resolve(import.meta.dirname, '..');
export const guides = [
  { edition: 'personal', file: 'docs/个人版部署教程.md', title: '个人版部署教程' },
  { edition: 'multi', file: 'docs/多人版部署教程.md', title: '多人版部署教程' },
];
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const style = `:root{color-scheme:light dark;font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.75}body{max-width:960px;margin:auto;padding:24px;color:#243047;background:#fff}a{color:#1265ad}h1,h2,h3{line-height:1.35;scroll-margin:20px}h2{margin-top:2em;border-bottom:1px solid #cbd5e1;padding-bottom:.4em}img{display:block;max-width:100%;height:auto;margin:20px auto;border:1px solid #cbd5e1;border-radius:6px}table{border-collapse:collapse;display:block;overflow-x:auto;width:100%;margin:20px 0}td,th{border:1px solid #cbd5e1;padding:9px 12px;text-align:left}pre{overflow:auto;padding:16px;background:#edf2f7;border-radius:6px}code{font-family:ui-monospace,Consolas,monospace;overflow-wrap:anywhere}blockquote,.offline-note{border-left:4px solid #2388be;background:#eef7ff;margin:20px 0;padding:12px 18px}nav{padding:12px 0}li{margin:.35em 0}footer{margin-top:48px;font-size:.9em;color:#627089}@media(prefers-color-scheme:dark){body{background:#111827;color:#e2e8f0}a{color:#7dc4ff}pre{background:#1e293b}blockquote,.offline-note{background:#182a3e}td,th,img,h2{border-color:#475569}}@media print{body{max-width:none;color:#111;background:#fff}pre,blockquote,.offline-note{background:#f4f4f4}img{break-inside:avoid}a{color:inherit}}`;

export async function inlineLocalImage(href, markdownFile, root = repoRoot) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(href)) throw new Error('Documentation images must be local relative files');
  const filename = await realpath(path.resolve(path.dirname(markdownFile), decodeURIComponent(href)));
  const absoluteRoot = await realpath(root);
  if (!filename.startsWith(absoluteRoot + path.sep)) throw new Error('Documentation image escapes repository');
  const extension = path.extname(filename).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extension];
  if (!mime) throw new Error('Unsupported documentation image format');
  const data = await readFile(filename);
  if (data.length > 12 * 1024 * 1024) throw new Error('Documentation image is too large');
  return `data:${mime};base64,${data.toString('base64')}`;
}

export async function offlineDocument(guide, root = repoRoot) {
  const filename = path.join(root, guide.file);
  const markdown = await readFile(filename, 'utf8');
  if (/<\s*(?:script|iframe|img|link|style)\b/i.test(markdown)) throw new Error('Use Markdown images; active/raw external assets are not allowed');
  const headings = new Map();
  const parser = new Marked({ gfm: true, async: true });
  parser.use({
    renderer: {
      heading(token) {
        const base = token.text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-');
        const count = headings.get(base) || 0;
        headings.set(base, count + 1);
        const id = base + (count ? '-' + count : '');
        return `<h${token.depth} id="${escape(id)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
    },
    async walkTokens(token) {
      if (token.type === 'image') token.href = await inlineLocalImage(token.href, filename, root);
      if (token.type === 'link' && token.href && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(token.href)) {
        const target = path.resolve(path.dirname(filename), decodeURIComponent(token.href.split('#')[0]));
        const other = guides.find(item => path.join(root, item.file) === target);
        const fragment = token.href.includes('#') ? '#' + token.href.split('#').slice(1).join('#') : '';
        token.href = (other ? other.edition + '.html' : path.relative(path.join(root, 'docs/offline'), target).split(path.sep).join('/')) + fragment;
      }
    },
  });
  const body = await parser.parse(markdown);
  // No script, remote stylesheet, remote image, analytics, or web font. Links
  // to provider dashboards are ordinary user-initiated navigation only.
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(guide.title)} · 离线版</title><style>${style}</style></head><body><nav><a href="personal.html">个人版</a> · <a href="multi.html">多人版</a></nav><aside class="offline-note">单文件离线阅读：图片与样式已内嵌，无需网络。注册／部署操作及外部链接仍需联网；其他源码／Markdown 链接需完整仓库。</aside><main>${body}</main><footer>由本仓库 Markdown 与本地图片生成；不含运行凭据。请勿把示例值当作实际配置。</footer></body></html>\n`;
}

export async function buildDocs(root = repoRoot) {
  const destination = path.join(root, 'docs/offline');
  await mkdir(destination, { recursive: true });
  for (const guide of guides) {
    const html = await offlineDocument(guide, root);
    await writeFile(path.join(destination, guide.edition + '.html'), html);
    console.log(`${guide.edition}: standalone tutorial, ${Buffer.byteLength(html)} bytes`);
  }
}
if (process.argv[1] === path.join(import.meta.dirname, 'build-docs.mjs')) await buildDocs();
