import WORKSPACE from '../../web/shared/workspace.js?text';
import WORKSPACE_STYLE from '../../web/shared/workspace.css?text';
import { wallpaperResponse } from './ui/wallpaper.js';

/** Composition boundary only. Media/API responses are never inspected here. */
export function createApplication({ edition, handler }) {
  return {
    scheduled: handler.scheduled,
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.pathname === '/bing-wallpaper') return wallpaperResponse(request.method);
      const response = await handler.fetch(request, env, ctx);
      const page = ['/', '/admin', '/admin/', '/login', '/register', '/register/'].includes(url.pathname);
      if (request.method !== 'GET' || !page || response.status !== 200 || !response.headers.get('Content-Type')?.includes('text/html')) return response;
      const html = (await response.text())
        .replace('<body', () => `<body data-edition="${edition}"`)
        .replace('</head>', () => `<style>${WORKSPACE_STYLE}</style></head>`)
        .replace('</body>', () => `<script>${WORKSPACE}</script></body>`);
      const headers = new Headers(response.headers);
      headers.delete('Content-Length'); headers.delete('Content-Encoding');
      headers.set('Cache-Control', 'no-store');
      return new Response(html, { status: response.status, headers });
    },
  };
}
