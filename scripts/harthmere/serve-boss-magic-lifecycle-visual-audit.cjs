#!/usr/bin/env node

const esbuild = require("esbuild");
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const outputRoot = path.join(
  root,
  "artifacts/harthmere-boss-magic-lifecycle-audit"
);
const bundlePath = path.join(outputRoot, "bundle.js");
const port = Number(process.env.HARTHMERE_BOSS_MAGIC_AUDIT_PORT || 4181);

fs.mkdirSync(outputRoot, { recursive: true });
esbuild.buildSync({
  entryPoints: [
    path.join(
      root,
      "scripts/harthmere/browser/boss-magic-lifecycle-visual-audit.ts"
    ),
  ],
  bundle: true,
  outfile: bundlePath,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: "inline",
  alias: { "@": path.join(root, "src") },
  define: { "process.env.NODE_ENV": '"development"' },
  banner: {
    js: 'var process = { env: { NODE_ENV: "development" }, platform: "browser", emitWarning: (...args) => console.warn(...args) };',
  },
});

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Harthmere boss magic lifecycle audit</title>
  </head>
  <body><script type="module" src="/bundle.js"></script></body>
</html>`;

function sendFile(response, filePath, contentType) {
  fs.readFile(filePath, (error, bytes) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(String(error.message || error));
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    response.end(bytes);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/" || url.pathname === "/index.html") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(html);
    return;
  }
  if (url.pathname === "/bundle.js") {
    sendFile(response, bundlePath, "text/javascript; charset=utf-8");
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    const assetPath = path.resolve(
      root,
      "public",
      `.${decodeURIComponent(url.pathname)}`
    );
    const publicRoot = path.resolve(root, "public");
    if (!assetPath.startsWith(`${publicRoot}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const extension = path.extname(assetPath).toLowerCase();
    const contentTypes = {
      ".glb": "model/gltf-binary",
      ".png": "image/png",
    };
    sendFile(
      response,
      assetPath,
      contentTypes[extension] || "application/octet-stream"
    );
    return;
  }
  response.writeHead(404);
  response.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Harthmere boss magic lifecycle audit: http://127.0.0.1:${port}/\n`
  );
});
