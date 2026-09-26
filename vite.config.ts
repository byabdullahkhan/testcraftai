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
        const rootAssetsDir = path.resolve(__dirname, 'assets');
        if (!fs.existsSync(distDir)) return;

        // Clean old docs/assets and root /assets so stale bundles are never served
        const docsAssets = path.join(docsDir, 'assets');
        if (fs.existsSync(docsAssets)) {
          fs.rmSync(docsAssets, {recursive: true, force: true});
        }
        if (fs.existsSync(rootAssetsDir)) {
          fs.rmSync(rootAssetsDir, {recursive: true, force: true});
        }

        // Copy fresh dist build into docs/
        fs.cpSync(distDir, docsDir, {recursive: true, force: true});

        // Also copy built assets into root /assets so GitHub Pages "/ (root)" branch deploy works directly
        const distAssets = path.join(distDir, 'assets');
        if (fs.existsSync(distAssets)) {
          fs.cpSync(distAssets, rootAssetsDir, {recursive: true, force: true});
        }

        // Copy favicon.svg and logo.svg to root so they work on "/ (root)" deploy
        for (const icon of ['favicon.svg', 'logo.svg']) {
          const srcIcon = path.join(distDir, icon);
          if (fs.existsSync(srcIcon)) {
            fs.copyFileSync(srcIcon, path.resolve(__dirname, icon));
          }
        }

        // Create 404.html in dist, docs, and root for GitHub Pages SPA routing
        const indexHtml = path.join(distDir, 'index.html');
        if (fs.existsSync(indexHtml)) {
          fs.copyFileSync(indexHtml, path.join(distDir, '404.html'));
          fs.copyFileSync(indexHtml, path.join(docsDir, '404.html'));
          fs.copyFileSync(indexHtml, path.resolve(__dirname, '404.html'));
        }

        // Create .nojekyll in root and docs for "Deploy from a branch" on GitHub Pages
        fs.writeFileSync(path.resolve(__dirname, '.nojekyll'), '');
        fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

        // Alias main bundle over all previous hashed filenames in both /docs/assets and /assets
        // so cached index.html files on GitHub Pages CDN never 404 (white screen)
        const jsAliases = [
          'index-CBOKpWOA.js',
          'index-DLWkkvoX.js',
          'index-Ddnw7tww.js',
          'index-vGsSK59C.js',
        ];
        const cssAliases = [
          'index-B3kqqo61.css',
          'index-odbwR2li.css',
          'index-DHeXafDn.css',
        ];

        for (const targetAssetsDir of [path.join(docsDir, 'assets'), rootAssetsDir]) {
          const mainJs = path.join(targetAssetsDir, 'index.js');
          const mainCss = path.join(targetAssetsDir, 'index.css');
          if (fs.existsSync(mainJs)) {
            for (const alias of jsAliases) {
              fs.copyFileSync(mainJs, path.join(targetAssetsDir, alias));
            }
          }
          if (fs.existsSync(mainCss)) {
            for (const alias of cssAliases) {
              fs.copyFileSync(mainCss, path.join(targetAssetsDir, alias));
            }
          }
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
