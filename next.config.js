const nextBuildId = require("next-build-id");
const fs = require("fs/promises");
const path = require("path");

const withBundleAnalyzer = process.env.ANALYZE
  ? require("@next/bundle-analyzer")({
      enabled: process.env.ANALYZE === "true",
    })
  : (x) => x;

const isProd = process.env.NODE_ENV === "production";

// Adjust this if you wish to debug the service worker locally.
const debugServiceWorker = false;
const withPWA =
  isProd || debugServiceWorker
    ? require("next-pwa")({
        dest: "public",
        register: false,
        swSrc: "./src/client/service_worker.ts",
      })
    : (x) => x;

module.exports = withBundleAnalyzer(
  withPWA({
    // GLITCH_REMOVE_STATIC_BIOMES_GG_V193:
    // Never emit external CDN asset URLs. In production-mode local
    // boots, Next.js bakes assetPrefix into the generated HTML; pointing it at
    // the legacy CDN breaks localhost when that cert/domain is invalid. Use the
    // default same-origin /_next/static paths instead.
    ...(isProd && { assetPrefix: "" }),

    reactStrictMode: false,
    poweredByHeader: false,
    compress: !isProd,

    async redirects() {
      return [
        {
          source: "/api/environment_group/:id/external_metadata",
          destination: "/api/md/eg/:id",
          permanent: true,
        },
      ];
    },

    // HARTHMERE_POLISH_V1_CACHE_HEADERS
    // Stops the browser from re-requesting the same HUD PNGs every 30 seconds
    // (one full RTT each on every poll) and stops the per-player GLTF body
    // variant requests from missing the cache because of a long query string.
    async headers() {
      return [
        {
          source: "/hud/:path*",
          headers: [
            { key: "Cache-Control", value: "public, max-age=86400, must-revalidate" },
          ],
        },
        {
          source: "/_next/static/media/:path*",
          headers: [
            // Next.js fingerprints these filenames already (hash in name),
            // so immutable is safe.
            { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          ],
        },
        {
          source: "/assets/harthmere/gltf/:path*",
          headers: [
            // Even with a per-player query string, an in-memory disk cache
            // helps a lot when the same body variant is reloaded across
            // navigation.
            { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" },
          ],
        },
        {
          source: "/buckets/:bucket/:path*",
          headers: [
            // GLITCH_LOCAL_BUCKET_ASSET_PROXY_V146: hash bucket assets are
            // fingerprinted by content and can be safely cached hard. The web
            // server still falls back to the public bucket if the packaged local
            // public/buckets copy is missing.
            { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          ],
        },
      ];
    },

    generateBuildId: async () => {
      const attemptBuildFromFile = async (...relativePath) => {
        try {
          const buildId = (
            await fs.readFile(path.join(__dirname, ...relativePath))
          ).toString();
          if (buildId !== "local") {
            return buildId;
          }
        } catch (error) {
          // Pass through
        }
      };

      return (
        (await attemptBuildFromFile(".next", "BUILD_ID")) ??
        (await attemptBuildFromFile("BUILD_ID")) ??
        (await (async () => {
          try {
            return await nextBuildId({ dir: __dirname });
          } catch (error) {
            return "unknown";
          }
        })())
      );
    },

    webpack(config, { isServer, webpack, buildId, dev }) {
      const experiments = config.experiments || {};
      config.experiments = { ...experiments, asyncWebAssembly: true };
      config.output.assetModuleFilename = `static/[hash][ext]`;
      if (isServer && !dev) {
        // See comments around WasmChunksFixPlugin below, this works around
        // an issue in nextjs when building for prod.
        config.output.webassemblyModuleFilename = "chunks/[modulehash].wasm";
        config.plugins.push(new WasmChunksFixPlugin());
        // GLITCH_NEXT_PAGES_MANIFEST_REPAIR_V1:
        // With next-pwa + asyncWebAssembly, the production server compile can
        // emit every page file to .next/server/pages but write an incomplete
        // .next/server/pages-manifest.json. Next's own "Collecting page data"
        // step then throws `PageNotFoundError: Cannot find module for page`
        // (e.g. /admin/blocks) and the build aborts BEFORE the post-build
        // repair script (scripts/glitch/repair-next-pages-manifest-v1.cjs) can
        // run. Rebuilding the manifest from the emitted page files in afterEmit
        // guarantees it is complete before page-data collection runs.
        config.plugins.push(new NextPagesManifestRepairPlugin(__dirname));
      }

      config.optimization.moduleIds = "named";
      //config.output.publicPath = `/_next/`;
      config.module.rules.push({
        test: /src\/gen\/shared\/cpp_ext\/.*\.wasm/,
        type: "asset/resource",
      });
      config.module.rules.push({
        test: /\.(mp4|webm|ogg|swf|ogv)$/,
        type: "asset/resource",
      });
      config.plugins.push(
        new webpack.DefinePlugin({
          "process.env.IS_SERVER": JSON.stringify(isServer),
          "process.env.BUILD_ID": JSON.stringify(buildId),
          "process.env.BUILD_TIMESTAMP": JSON.stringify(Date.now()),
          "process.env.SYNC_PORT": process.env.SYNC_PORT,
          "process.env.OOB_PORT": process.env.OOB_PORT,
          "process.env.BIKKIE_STATIC_PREFIX": JSON.stringify(
            process.env.BIKKIE_STATIC_PREFIX || ""
          ),
          "process.env.GALOIS_STATIC_PREFIX": JSON.stringify(
            process.env.GALOIS_STATIC_PREFIX || ""
          ),
          "process.env.OPEN_ADMIN_ACCESS": JSON.stringify(
            process.env.OPEN_ADMIN_ACCESS || "0"
          ),
          "process.env.GCS_LOCAL_DISK": JSON.stringify(
            process.env.GCS_LOCAL_DISK || "0"
          ),
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        assert: require.resolve("assert"),
        async_hooks: false,
        child_process: false,
        cluster: false,
        constants: false,
        crypto: require.resolve("crypto-browserify"),
        dgram: false,
        dns: false,
        events: require.resolve("events-browserify"),
        fs: false,
        http: false,
        https: false,
        net: false,
        os: false,
        path: false,
        perf_hooks: false,
        querystring: require.resolve("querystring-browser"),
        repl: false,
        stream: require.resolve("stream-browserify"),
        tls: false,
        v8: false,
        zlib: false,
      };
      return config;
    },

    eslint: {
      dirs: [
        "src/client",
        "src/pages",
        "src/server",
        "src/shared",
        "src/galois/js",
      ],
      ignoreDuringBuilds: true,
    },

    typescript: {
      ignoreBuildErrors: true,
      tsconfigPath: "tsconfig.next.json",
    },

    // AFAIK, this is the only way to have nextjs generate source maps in
    // production. In our deploy step, we remove these from the public directory
    // and upload them to a non-public bucket instead so that we can
    // de-obfuscate source maps later.
    productionBrowserSourceMaps: isProd,
  })
);

// Applies workaround from https://github.com/vercel/next.js/issues/29362#issuecomment-971377869,
// as otherwise there is an issue internal to nextjs around webpacking imported
// wasm files. Amusingly, even NextJS's own wasm example has a
// (different, though suggested previously by the same person https://github.com/vercel/next.js/issues/29362#issuecomment-932767530)
// workaround for this: https://github.com/vercel/next.js/blob/a7a9777ddc78dbe2c7772b010f53aa7a93322b4a/examples/with-webassembly/next.config.js#L6-L9
class WasmChunksFixPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("WasmChunksFixPlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: "WasmChunksFixPlugin" },
        (assets) =>
          Object.entries(assets).forEach(([pathname, source]) => {
            if (!pathname.match(/chunks\/.*\.wasm$/)) return;
            compilation.deleteAsset(pathname);

            const name = pathname.split("/").slice(1);
            const info = compilation.assetsInfo.get(pathname);
            compilation.emitAsset(name, source, info);
          })
      );
    });
  }
}

// GLITCH_NEXT_PAGES_MANIFEST_REPAIR_V1:
// Rebuilds .next/server/pages-manifest.json from the page files that were
// actually emitted, so Next's internal "Collecting page data" step never trips
// over a manifest that next-pwa/webpack left incomplete. The route -> file
// mapping mirrors scripts/glitch/repair-next-pages-manifest-v1.cjs exactly.
class NextPagesManifestRepairPlugin {
  constructor(root) {
    this.root = root;
  }

  apply(compiler) {
    const fsSync = require("fs");
    const path = require("path");
    const serverDir = path.join(this.root, ".next", "server");
    const pagesDir = path.join(serverDir, "pages");
    const manifestPath = path.join(serverDir, "pages-manifest.json");

    const walk = (dir, out = []) => {
      for (const entry of fsSync.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(abs, out);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          out.push(abs);
        }
      }
      return out;
    };

    const routeForPageFile = (abs) => {
      const rel = path
        .relative(pagesDir, abs)
        .split(path.sep)
        .join("/")
        .replace(/[.]js$/, "");
      if (rel === "index") return "/";
      if (rel.endsWith("/index")) return `/${rel.slice(0, -"/index".length)}`;
      return `/${rel}`;
    };

    const manifestValueForPageFile = (abs) =>
      path.relative(serverDir, abs).split(path.sep).join("/");

    const rebuild = () => {
      try {
        if (!fsSync.existsSync(pagesDir)) return;
        const entries = walk(pagesDir)
          .map((abs) => [routeForPageFile(abs), manifestValueForPageFile(abs)])
          .sort(([a], [b]) => a.localeCompare(b));
        const repaired = Object.fromEntries(entries);
        if (Object.keys(repaired).length === 0) return;
        let existing = {};
        try {
          existing = JSON.parse(fsSync.readFileSync(manifestPath, "utf8"));
        } catch {
          existing = {};
        }
        const before = Object.keys(existing).length;
        if (before >= Object.keys(repaired).length) return;
        fsSync.writeFileSync(
          manifestPath,
          `${JSON.stringify(repaired, null, 2)}\n`
        );
        console.log(
          `[pages-manifest-repair] ${before} -> ${
            Object.keys(repaired).length
          } routes`
        );
      } catch (error) {
        console.warn(
          `[pages-manifest-repair] skipped: ${
            error && error.message ? error.message : error
          }`
        );
      }
    };

    compiler.hooks.afterEmit.tap("NextPagesManifestRepairPlugin", rebuild);
  }
}
