import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function syncDocsPlugin() {
  return {
    name: 'sync-docs-for-github-pages',
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, 'dist');
        const docsDir = path.resolve(__dirname, 'docs');
        if (!fs.existsSync(distDir)) return;

        // Clean old docs/assets so stale bundles are never served on GitHub Pages
        const docsAssets = path.join(docsDir, 'assets');
        if (fs.existsSync(docsAssets)) {
          fs.rmSync(docsAssets, {recursive: true, force: true});
        }

        // Copy fresh dist build into docs/
        fs.cpSync(distDir, docsDir, {recursive: true, force: true});

        // Create 404.html in both dist and docs for GitHub Pages SPA routing
        const indexHtml = path.join(distDir, 'index.html');
        if (fs.existsSync(indexHtml)) {
          fs.copyFileSync(indexHtml, path.join(distDir, '404.html'));
          fs.copyFileSync(indexHtml, path.join(docsDir, '404.html'));
        }

        // Create .nojekyll in root and docs for "Deploy from a branch" on GitHub Pages
        fs.writeFileSync(path.resolve(__dirname, '.nojekyll'), '');
        fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

        // Also alias the main bundle over the legacy filename in case GitHub CDN cached old index.html
        const mainJs = path.join(docsDir, 'assets', 'index.js');
        const mainCss = path.join(docsDir, 'assets', 'index.css');
        if (fs.existsSync(mainJs)) {
          fs.copyFileSync(mainJs, path.join(docsDir, 'assets', 'index-CBOKpWOA.js'));
        }
        if (fs.existsSync(mainCss)) {
          fs.copyFileSync(mainCss, path.join(docsDir, 'assets', 'index-B3kqqo61.css'));
        }
      } catch (err) {
        console.warn('Could not sync dist to docs:', err);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), syncDocsPlugin()],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
