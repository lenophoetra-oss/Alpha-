import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function getLatestMtimeMs(targetPath: string): number {
  try {
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return stat.mtimeMs;
    }
    let latest = stat.mtimeMs;
    for (const entry of fs.readdirSync(targetPath)) {
      const childMtime = getLatestMtimeMs(path.join(targetPath, entry));
      if (childMtime > latest) {
        latest = childMtime;
      }
    }
    return latest;
  } catch {
    return 0;
  }
}

function apkAttachmentPlugin(): Plugin {
  let isBuildingApk = false;
  const trialConfigPath = path.resolve(process.cwd(), 'trial-config.json');

  const readTrialConfig = () => {
    try {
      if (fs.existsSync(trialConfigPath)) {
        return JSON.parse(fs.readFileSync(trialConfigPath, 'utf-8'));
      }
    } catch {
      // Fallback
    }
    return {
      trialDurationMs: 3 * 24 * 60 * 60 * 1000,
      adminWaNumber: '081529285782',
      licensePriceText: 'Rp 150.000 (Aktif Selamanya)',
      updatedAt: Date.now(),
    };
  };

  const writeTrialConfig = (nextCfg: any) => {
    try {
      fs.writeFileSync(trialConfigPath, JSON.stringify(nextCfg, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write trial-config.json:', e);
    }
  };

  const ensureFreshApk = (apkFilePath: string, forceFastTrialRepack = false) => {
    if (isBuildingApk) return;
    try {
      const apkExists = fs.existsSync(apkFilePath);
      const apkMtime = apkExists ? fs.statSync(apkFilePath).mtimeMs : 0;
      const latestSrcMtime = Math.max(
        getLatestMtimeMs(path.resolve(process.cwd(), 'src')),
        getLatestMtimeMs(path.resolve(process.cwd(), 'index.html')),
        getLatestMtimeMs(path.resolve(process.cwd(), 'scripts/build_apk.py'))
      );
      const trialCfgMtime = getLatestMtimeMs(trialConfigPath);

      // Rebuild APK automatically if missing or if any file in src/ was modified after the APK was built
      if (!apkExists || latestSrcMtime > apkMtime + 1500) {
        isBuildingApk = true;
        execSync('python3 scripts/build_apk.py', {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      } else if (forceFastTrialRepack || trialCfgMtime > apkMtime + 500) {
        isBuildingApk = true;
        execSync('python3 scripts/build_apk.py --from-dist --fast-repack --only-trial', {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      }
    } catch (err) {
      console.error('Failed to auto-rebuild APK:', err);
    } finally {
      isBuildingApk = false;
    }
  };

  const serveApk = (req: any, res: any, next: any) => {
    const rawUrl = req.url || '';
    const [url, queryStr] = rawUrl.split('?');

    if (url === '/api/trial-config') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method === 'GET') {
        const cfg = readTrialConfig();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(cfg));
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const incoming = JSON.parse(body || '{}');
            const current = readTrialConfig();
            const nextCfg = {
              trialDurationMs:
                typeof incoming.trialDurationMs === 'number' && incoming.trialDurationMs >= 10000
                  ? incoming.trialDurationMs
                  : current.trialDurationMs,
              adminWaNumber: incoming.adminWaNumber || current.adminWaNumber,
              licensePriceText: incoming.licensePriceText || current.licensePriceText,
              updatedAt: Date.now(),
            };
            writeTrialConfig(nextCfg);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, config: nextCfg }));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false }));
          }
        });
        return;
      }
    }

    const isTrialApkRoute =
      url === '/Kasir-Konter-Trial-3Hari.apk' ||
      url === '/Kasir-Konter-Trial-3Hari-v3.0.apk' ||
      url === '/download-apk-trial';

    const isFullApkRoute =
      url === '/Kasir-Konter-Gadai-Pro.apk' ||
      url === '/Kasir-Konter-Gadai-Pro-v2.7.apk' ||
      url === '/Kasir-Konter-Gadai-Pro-v2.9.apk' ||
      url === '/Kasir-Konter-Gadai-Pro-v3.0.apk' ||
      url === '/download-apk';

    if (isTrialApkRoute || isFullApkRoute) {
      let forceTrialRepack = false;
      if (isTrialApkRoute && queryStr) {
        const params = new URLSearchParams(queryStr);
        const durParam = Number(params.get('dur'));
        const waParam = params.get('wa');
        const priceParam = params.get('price');
        if (durParam && durParam >= 10000) {
          const current = readTrialConfig();
          if (
            current.trialDurationMs !== durParam ||
            (waParam && current.adminWaNumber !== waParam)
          ) {
            writeTrialConfig({
              trialDurationMs: durParam,
              adminWaNumber: waParam || current.adminWaNumber,
              licensePriceText: priceParam || current.licensePriceText,
              updatedAt: Date.now(),
            });
            forceTrialRepack = true;
          }
        }
      }

      const apkFileName = isTrialApkRoute
        ? 'Kasir-Konter-Trial-3Hari.apk'
        : 'Kasir-Konter-Gadai-Pro.apk';
      const downloadFileName = isTrialApkRoute
        ? 'Kasir-Konter-Trial-3Hari-v3.0.apk'
        : 'Kasir-Konter-Gadai-Pro-v3.0.apk';

      const apkPath = path.resolve(process.cwd(), `public/${apkFileName}`);
      ensureFreshApk(apkPath, forceTrialRepack);

      const fallbackPath = path.resolve(process.cwd(), apkFileName);
      const targetPath = fs.existsSync(apkPath)
        ? apkPath
        : fs.existsSync(fallbackPath)
          ? fallbackPath
          : null;

      if (targetPath) {
        const stat = fs.statSync(targetPath);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${downloadFileName}"`
        );
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        const stream = fs.createReadStream(targetPath);
        stream.pipe(res);
        return;
      }
    }
    next();
  };

  return {
    name: 'apk-attachment-headers',
    configureServer(server) {
      server.middlewares.use(serveApk);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveApk);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      apkAttachmentPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Kasir Konter & Gadai Pro',
          short_name: 'KasirKonter',
          description:
            'Aplikasi Android Kasir Konter HP, Jual Beli HP Baru/Seken/Minusan, Voucher, Topup, Gadai & Pembukuan.',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallbackDenylist: [/\.apk$/i, /^\/download-apk/i, /^\/api\//i],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
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
