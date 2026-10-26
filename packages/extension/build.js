import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, renameSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runBuild() {
  console.log('Building Shareworks Bridge Extension...');

  const distDir = resolve(__dirname, 'dist');
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // 1. Build background service worker as standalone script (IIFE format)
  console.log('Building background script...');
  await build({
    root: __dirname,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/background/index.ts'),
        name: 'shareworksBackground',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
    },
    configFile: false,
  });

  // 2. Build webapp-bridge content script as standalone IIFE
  console.log('Building webapp-bridge content script...');
  await build({
    root: __dirname,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/content/webapp-bridge.ts'),
        name: 'shareworksWebappBridge',
        formats: ['iife'],
        fileName: () => 'webapp-bridge.js',
      },
    },
    configFile: false,
  });

  // 3. Build shareworks-interceptor (MAIN world) as standalone IIFE
  console.log('Building shareworks-interceptor script...');
  await build({
    root: __dirname,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/content/shareworks-interceptor.ts'),
        name: 'shareworksPageInterceptor',
        formats: ['iife'],
        fileName: () => 'shareworks-interceptor.js',
      },
    },
    configFile: false,
  });

  // 4. Build shareworks-bridge content script as standalone IIFE
  console.log('Building shareworks-bridge content script...');
  await build({
    root: __dirname,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/content/shareworks-bridge.ts'),
        name: 'shareworksPortalBridge',
        formats: ['iife'],
        fileName: () => 'shareworks-bridge.js',
      },
    },
    configFile: false,
  });

  // 5. Build popup UI
  console.log('Building popup page...');
  await build({
    root: resolve(__dirname, 'src/popup'),
    build: {
      outDir: distDir,
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(__dirname, 'src/popup/index.html'),
        output: {
          entryFileNames: 'popup.js',
        },
      },
    },
    configFile: false,
  });

  // Rename dist/index.html to dist/popup.html if needed
  if (existsSync(resolve(distDir, 'index.html'))) {
    renameSync(resolve(distDir, 'index.html'), resolve(distDir, 'popup.html'));
  }

  // 6. Write manifest.json with version sourced strictly from root package.json
  console.log('Writing manifest.json based on root package.json version...');
  const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'));
  manifest.version = rootPkg.version;
  writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`Extension build completed successfully (version: ${manifest.version})!`);
}

runBuild().catch((err) => {
  console.error('Extension build failed:', err);
  process.exit(1);
});
