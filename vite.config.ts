import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const standalone = process.env.VITE_SCENIA_STANDALONE === 'true';

function standalonePlugin(): Plugin {
  const publicRoot = path.resolve(__dirname, 'public');

  const publicImages = fs.readdirSync(publicRoot, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const filename = path.join(entry.parentPath, entry.name);
      const relative = `/${path.relative(publicRoot, filename).split(path.sep).join('/')}`;
      const extension = path.extname(filename).slice(1);
      const mime = extension === 'svg' ? 'image/svg+xml' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
      return [relative, `data:${mime};base64,${fs.readFileSync(filename).toString('base64')}`] as const;
    });

  return {
    name: 'scenia-standalone',
    apply: 'build',
    writeBundle(options, bundle) {
      const outputDirectory = options.dir;
      const htmlEntry = Object.values(bundle).find(item => item.type === 'asset' && item.fileName.endsWith('.html'));
      const jsEntry = Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry);
      const cssEntry = Object.values(bundle).find(item => item.type === 'asset' && item.fileName.endsWith('.css'));
      if (!outputDirectory || !htmlEntry || htmlEntry.type !== 'asset' || !jsEntry || jsEntry.type !== 'chunk') {
        this.error('Standalone build could not locate its HTML or JavaScript entry.');
        return;
      }

      let javascript = jsEntry.code;
      for (const [url, dataUri] of publicImages) {
        javascript = javascript.split(url).join(dataUri);
      }
      javascript = javascript.replaceAll('</script', '<\\/script');

      // Use a classic inline script rather than an inline module. Browsers assign
      // opaque, unique origins to file:// documents, and Chromium may reject a
      // module script as a cross-origin load even when it is embedded in the same
      // local HTML file. Rollup's single chunk has no imports or exports, so it is
      // safe to execute as a classic script and works when opened by double-click.
      // Vite puts its module entry in <head>, where modules are deferred. A classic
      // inline script is not deferred, so move it to the end of <body>; otherwise
      // React runs before #root exists and throws minified error 299.
      let html = fs.readFileSync(path.join(outputDirectory, htmlEntry.fileName), 'utf8')
        .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/, '')
        .replace('<title>Scenia — IT Portfolio Planning, Visualised.</title>', '<title>Scenia Standalone</title>');
      if (cssEntry && cssEntry.type === 'asset') {
        html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/, () => `<style>${String(cssEntry.source)}</style>`);
      }
      html = html.replace('</body>', () => `<script>${javascript}</script>\n  </body>`);
      fs.rmSync(outputDirectory, { recursive: true, force: true });
      fs.mkdirSync(outputDirectory, { recursive: true });
      fs.writeFileSync(path.join(outputDirectory, 'scenia-standalone.html'), html);
    },
  };
}

const securityHeaders = {
  // Dev server CSP includes 'unsafe-inline' in script-src to allow Vite's React Refresh HMR preamble.
  // Production CSP (nginx.conf) is stricter: script-src 'self' only (no unsafe-inline).
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://us-central1-oneview-diagrams.cloudfunctions.net; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
};

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(standalone ? [standalonePlugin()] : [])],
  publicDir: standalone ? false : 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    headers: securityHeaders,
  },
  build: {
    assetsInlineLimit: standalone ? Number.MAX_SAFE_INTEGER : undefined,
    rollupOptions: {
      output: {
        inlineDynamicImports: standalone,
        manualChunks: standalone ? undefined : {
          'vendor-react': ['react', 'react-dom'],
          'vendor-date': ['date-fns'],
          'vendor-xlsx': ['xlsx'],
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 400,
  },
});
