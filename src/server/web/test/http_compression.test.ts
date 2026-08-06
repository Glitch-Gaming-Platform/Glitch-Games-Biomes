/// <reference types="mocha" />
import {
  createWebCompressionMiddleware,
  WEB_COMPRESSION_THRESHOLD_BYTES,
} from "@/server/web/http_compression";
import assert from "assert";
import { randomBytes } from "node:crypto";
import { createServer, request, type Server } from "node:http";
import { Readable } from "node:stream";
import { gunzipSync } from "node:zlib";

// HARTHMERE_ASSET_TRANSPORT_COMPRESSION (2026-08-04 asset loading audit)
//
// These tests exercise the custom `dist/web.js` origin path. Testing only
// next.config.js missed the real regression because `next start` is not the
// process serving production traffic.

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      resolve(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function get(
  port: number,
  acceptEncoding?: string,
  method = "GET"
): Promise<{
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
}> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path: "/asset.js",
        method,
        headers: acceptEncoding
          ? { "accept-encoding": acceptEncoding }
          : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () =>
          resolve({ body: Buffer.concat(chunks), headers: res.headers })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function compressedServer(
  body: string | Buffer,
  env: Record<string, string | undefined> = {},
  options: {
    status?: number;
    headers?: Record<string, string | number>;
    writeHead?: boolean;
    endWithCallbackOnly?: boolean;
    pipeBody?: boolean;
  } = {}
) {
  const compress = createWebCompressionMiddleware(env);
  return createServer((req, res) => {
    compress(req, res, (error) => {
      if (error) {
        res.statusCode = 500;
        res.end(String(error));
        return;
      }
      const headers = {
        "Content-Type": "application/javascript; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        ...options.headers,
      };
      res.statusCode = options.status ?? 200;
      if (options.writeHead) {
        res.writeHead(res.statusCode, headers);
      } else {
        for (const [name, value] of Object.entries(headers)) {
          res.setHeader(name, value);
        }
      }
      if (options.pipeBody) {
        const chunks: Buffer[] = [];
        const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
        for (let offset = 0; offset < bytes.length; offset += 4096) {
          chunks.push(bytes.subarray(offset, offset + 4096));
        }
        Readable.from(chunks).pipe(res);
      } else if (options.endWithCallbackOnly) {
        res.write(body);
        res.end(() => undefined);
      } else {
        res.end(body);
      }
    });
  });
}

describe("custom web origin compression", () => {
  const identityCases: ReadonlyArray<{
    label: string;
    options: {
      status?: number;
      headers?: Record<string, string | number>;
    };
    expectedEncoding?: string;
  }> = [
    {
      label: "no-transform responses",
      options: { headers: { "Cache-Control": "no-transform" } },
    },
    {
      label: "already encoded responses",
      options: { headers: { "Content-Encoding": "br" } },
      expectedEncoding: "br",
    },
    { label: "partial responses", options: { status: 206 } },
    {
      label: "responses with Content-Range",
      options: { headers: { "Content-Range": "bytes 0-9/20" } },
    },
    {
      label: "server-sent events",
      options: { headers: { "Content-Type": "text/event-stream" } },
    },
  ];

  it("gzips large compressible responses when the client accepts gzip", async () => {
    const body = "const asset = 'compress me';\n".repeat(4096);
    const server = compressedServer(body);
    const port = await listen(server);
    try {
      const response = await get(port, "gzip");
      assert.equal(response.headers["content-encoding"], "gzip");
      assert.match(String(response.headers.vary), /Accept-Encoding/i);
      assert.equal(gunzipSync(response.body).toString("utf8"), body);
      assert.ok(response.body.length < Buffer.byteLength(body) / 10);
    } finally {
      await close(server);
    }
  });

  it("finishes large streams after socket backpressure", async () => {
    // Repetitive fixtures compress below the socket high-water mark and cannot
    // exercise pause/resume behavior. Random bytes remain large after gzip.
    const body = randomBytes(2 * 1024 * 1024);
    const server = compressedServer(body);
    const port = await listen(server);
    try {
      const response = await get(port, "gzip");
      assert.equal(response.headers["content-encoding"], "gzip");
      assert.deepEqual(gunzipSync(response.body), body);
    } finally {
      await close(server);
    }
  });

  it("routes Readable.pipe backpressure through the gzip input stream", async () => {
    const body = randomBytes(4 * 1024 * 1024);
    const server = compressedServer(body, {}, { pipeBody: true });
    const port = await listen(server);
    try {
      const response = await get(port, "gzip");
      assert.equal(response.headers["content-encoding"], "gzip");
      assert.deepEqual(gunzipSync(response.body), body);
    } finally {
      await close(server);
    }
  });

  it("leaves the body plain when gzip was not requested", async () => {
    const body = "plain response\n".repeat(512);
    const server = compressedServer(body);
    const port = await listen(server);
    try {
      const response = await get(port);
      assert.equal(response.headers["content-encoding"], undefined);
      assert.match(String(response.headers.vary), /Accept-Encoding/i);
      assert.equal(response.body.toString("utf8"), body);
    } finally {
      await close(server);
    }
  });

  it("honors an explicit gzip rejection even when wildcard is accepted", async () => {
    const body = "do not gzip\n".repeat(512);
    const server = compressedServer(body);
    const port = await listen(server);
    try {
      const response = await get(port, "br, *;q=1, gzip;q=0");
      assert.equal(response.headers["content-encoding"], undefined);
      assert.equal(response.body.toString("utf8"), body);
    } finally {
      await close(server);
    }
  });

  it("compresses responses whose headers are supplied through writeHead", async () => {
    const body = "writeHead path\n".repeat(1024);
    const server = compressedServer(body, {}, { writeHead: true });
    const port = await listen(server);
    try {
      const response = await get(port, "gzip");
      assert.equal(response.headers["content-encoding"], "gzip");
      assert.equal(gunzipSync(response.body).toString("utf8"), body);
    } finally {
      await close(server);
    }
  });

  it("supports the res.end(callback) overload after streamed writes", async () => {
    const body = "callback overload\n".repeat(1024);
    const server = compressedServer(body, {}, { endWithCallbackOnly: true });
    const port = await listen(server);
    try {
      const response = await get(port, "gzip");
      assert.equal(response.headers["content-encoding"], "gzip");
      assert.equal(gunzipSync(response.body).toString("utf8"), body);
    } finally {
      await close(server);
    }
  });

  it("honors the explicit upstream-compression escape hatch", async () => {
    const body = "proxy owns compression\n".repeat(512);
    const server = compressedServer(body, {
      BIOMES_ORIGIN_HAS_COMPRESSING_PROXY: "1",
    });
    const port = await listen(server);
    try {
      const response = await get(port, "gzip");
      assert.equal(response.headers["content-encoding"], undefined);
      assert.equal(response.body.toString("utf8"), body);
    } finally {
      await close(server);
    }
  });

  it("does not spend CPU compressing sub-threshold responses", async () => {
    const body = "x".repeat(WEB_COMPRESSION_THRESHOLD_BYTES - 1);
    const server = compressedServer(body);
    const port = await listen(server);
    try {
      const response = await get(port, "gzip");
      assert.equal(response.headers["content-encoding"], undefined);
      assert.equal(response.body.toString("utf8"), body);
    } finally {
      await close(server);
    }
  });

  for (const { label, options, expectedEncoding } of identityCases) {
    it(`does not transform ${label}`, async () => {
      const body = "identity body\n".repeat(512);
      const server = compressedServer(body, {}, options);
      const port = await listen(server);
      try {
        const response = await get(port, "gzip");
        assert.equal(response.headers["content-encoding"], expectedEncoding);
        assert.equal(response.body.toString("utf8"), body);
      } finally {
        await close(server);
      }
    });
  }

  it("does not transform HEAD responses", async () => {
    const body = "head body\n".repeat(512);
    const server = compressedServer(body);
    const port = await listen(server);
    try {
      const response = await get(port, "gzip", "HEAD");
      assert.equal(response.headers["content-encoding"], undefined);
      assert.equal(response.body.length, 0);
      assert.equal(
        Number(response.headers["content-length"]),
        Buffer.byteLength(body)
      );
    } finally {
      await close(server);
    }
  });

  it("preserves an existing Vary wildcard", async () => {
    const body = "vary wildcard\n".repeat(512);
    const server = compressedServer(body, {}, { headers: { Vary: "*" } });
    const port = await listen(server);
    try {
      const response = await get(port, "gzip");
      assert.equal(response.headers.vary, "*");
      assert.equal(response.headers["content-encoding"], "gzip");
    } finally {
      await close(server);
    }
  });
});
