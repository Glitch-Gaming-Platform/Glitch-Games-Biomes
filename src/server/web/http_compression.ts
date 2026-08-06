import type { IncomingMessage, ServerResponse } from "node:http";
import { createGzip } from "node:zlib";

const { shouldCompressHttpResponses } =
  require("@/../config/http_compression.cjs") as {
    shouldCompressHttpResponses: (
      env?: Record<string, string | undefined>
    ) => boolean;
  };

// HARTHMERE_ASSET_TRANSPORT_COMPRESSION (2026-08-04 asset loading audit,
// finding 1)
//
// `next.config.js#compress` only controls the server created by `next start`.
// Biomes production instead runs `dist/web.js`, whose custom Node HTTP server
// delegates requests to Next. A live probe against that origin found no
// Content-Encoding on the game page chunk, service worker, or Bikkie response.
//
// Keep this implementation dependency-free: the server webpack build
// externalizes packages from node_modules, while the runtime image intentionally
// contains only the dependencies present when that image was built. Node's
// streaming zlib API gives the custom origin the required gzip behavior without
// coupling a code-only deployment to a newly rebuilt base image.

export const WEB_COMPRESSION_THRESHOLD_BYTES = 1024;

export type WebCompressionMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void
) => void;

function acceptsGzip(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  let wildcardAccepted = false;
  for (const entry of value.split(",")) {
    const [rawName, ...parameters] = entry.trim().split(";");
    const name = rawName.trim().toLowerCase();
    const qualityParameter = parameters.find((parameter) =>
      parameter.trim().toLowerCase().startsWith("q=")
    );
    const quality = qualityParameter
      ? Number(qualityParameter.trim().slice(2))
      : 1;
    const accepted = Number.isFinite(quality) && quality > 0;

    // An explicit gzip preference takes precedence over a wildcard, including
    // the common `gzip;q=0, *;q=1` form used to reject gzip specifically.
    if (name === "gzip") {
      return accepted;
    }
    if (name === "*") {
      wildcardAccepted = accepted;
    }
  }
  return wildcardAccepted;
}

function isCompressibleContentType(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const type = value.split(";", 1)[0].trim().toLowerCase();
  return (
    type.startsWith("text/") ||
    type === "application/javascript" ||
    type === "application/json" ||
    type === "application/manifest+json" ||
    type === "application/wasm" ||
    type === "application/xml" ||
    type.endsWith("+json") ||
    type.endsWith("+xml") ||
    type === "image/svg+xml" ||
    type === "font/otf" ||
    type === "font/ttf" ||
    type === "application/vnd.ms-fontobject" ||
    type === "application/x-font-opentype" ||
    type === "application/x-font-truetype"
  );
}

function headerString(
  value: number | string | readonly string[] | undefined
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function appendVaryAcceptEncoding(res: ServerResponse): void {
  const existing = headerString(res.getHeader("Vary"));
  if (!existing) {
    res.setHeader("Vary", "Accept-Encoding");
    return;
  }
  const values = existing.split(",").map((value) => value.trim().toLowerCase());
  // `Vary: *` already means every request header and must remain the complete
  // field value; appending another token produces an invalid cache directive.
  if (!values.includes("*") && !values.includes("accept-encoding")) {
    res.setHeader("Vary", `${existing}, Accept-Encoding`);
  }
}

function applyWriteHeadHeaders(res: ServerResponse, headers: unknown): void {
  if (Array.isArray(headers)) {
    // Node accepts both a flat [name, value, ...] list and (in older call
    // sites) an array of [name, value] pairs.
    if (headers.length > 0 && Array.isArray(headers[0])) {
      for (const [name, value] of headers as Array<[string, unknown]>) {
        res.setHeader(name, value as any);
      }
    } else {
      for (let i = 0; i + 1 < headers.length; i += 2) {
        res.setHeader(String(headers[i]), headers[i + 1] as any);
      }
    }
    return;
  }
  if (headers && typeof headers === "object") {
    for (const [name, value] of Object.entries(headers)) {
      if (value !== undefined) {
        res.setHeader(name, value as any);
      }
    }
  }
}

/**
 * Create streaming gzip middleware for the custom Biomes web origin.
 *
 * The decision is delayed until the first body write so handlers can set the
 * status and content headers normally. Known small responses, ranges, already
 * encoded bodies, and `no-transform` responses remain byte-for-byte unchanged.
 */
export function createWebCompressionMiddleware(
  env: Record<string, string | undefined> = process.env
): WebCompressionMiddleware {
  const enabled = shouldCompressHttpResponses(env);

  return (req, res, next) => {
    if (!enabled) {
      next();
      return;
    }

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalWriteHead = res.writeHead.bind(res);
    const originalOn = res.on;
    const originalRemoveListener = res.removeListener;
    let decided = false;
    let gzip: ReturnType<typeof createGzip> | undefined;
    let pendingDrainListeners: Array<(...args: any[]) => void> | undefined = [];

    const routePendingDrainListeners = (
      stream: ReturnType<typeof createGzip> | undefined
    ) => {
      if (!pendingDrainListeners) {
        return;
      }
      for (const listener of pendingDrainListeners) {
        if (stream) {
          stream.on("drain", listener);
        } else {
          originalOn.call(res, "drain", listener);
        }
      }
      pendingDrainListeners = undefined;
    };

    // Readable.pipe registers its drain listener before the first write decides
    // whether compression is active. Route those listeners to zlib's writable
    // side when compressed; otherwise a large piped file can pause forever
    // waiting for the wrong stream's drain event.
    res.on = ((event: string | symbol, listener: (...args: any[]) => void) => {
      if (event !== "drain") {
        return originalOn.call(res, event, listener);
      }
      if (gzip) {
        gzip.on("drain", listener);
      } else if (pendingDrainListeners) {
        pendingDrainListeners.push(listener);
      } else {
        originalOn.call(res, "drain", listener);
      }
      return res;
    }) as ServerResponse["on"];

    res.removeListener = ((
      event: string | symbol,
      listener: (...args: any[]) => void
    ) => {
      if (event !== "drain") {
        return originalRemoveListener.call(res, event, listener);
      }
      if (gzip) {
        gzip.removeListener("drain", listener);
      } else if (pendingDrainListeners) {
        const index = pendingDrainListeners.indexOf(listener);
        if (index >= 0) {
          pendingDrainListeners.splice(index, 1);
        }
      } else {
        originalRemoveListener.call(res, "drain", listener);
      }
      return res;
    }) as ServerResponse["removeListener"];

    const decide = () => {
      if (decided) {
        return gzip;
      }
      decided = true;

      const status = res.statusCode;
      const cacheControl = headerString(res.getHeader("Cache-Control"));
      const contentLength = Number(res.getHeader("Content-Length"));
      const contentType = headerString(res.getHeader("Content-Type"));
      const existingEncoding = headerString(res.getHeader("Content-Encoding"));

      if (
        req.method === "HEAD" ||
        res.headersSent ||
        status < 200 ||
        status === 204 ||
        status === 205 ||
        status === 206 ||
        status === 304 ||
        existingEncoding !== undefined ||
        res.hasHeader("Content-Range") ||
        cacheControl?.toLowerCase().includes("no-transform") ||
        contentType?.toLowerCase().startsWith("text/event-stream") ||
        !isCompressibleContentType(contentType) ||
        (Number.isFinite(contentLength) &&
          contentLength < WEB_COMPRESSION_THRESHOLD_BYTES)
      ) {
        routePendingDrainListeners(undefined);
        return undefined;
      }

      // A shared cache must distinguish compressed and identity responses even
      // when this particular client did not advertise gzip support.
      appendVaryAcceptEncoding(res);
      if (!acceptsGzip(headerString(req.headers["accept-encoding"]))) {
        routePendingDrainListeners(undefined);
        return undefined;
      }

      res.setHeader("Content-Encoding", "gzip");
      res.removeHeader("Content-Length");
      gzip = createGzip({ level: 6 });

      // Write compressed output through the original response methods so it
      // cannot recurse into the input methods patched below. Pause zlib while
      // the socket buffer is full, then resume on ServerResponse's drain event.
      gzip.on("data", (chunk) => {
        if (!originalWrite(chunk)) {
          gzip?.pause();
        }
      });
      gzip.on("end", () => originalEnd());
      // This listener is for compressed output backpressure, so it must remain
      // on the actual ServerResponse rather than being routed to gzip input.
      originalOn.call(res, "drain", () => gzip?.resume());
      res.once("close", () => {
        if (!res.writableFinished) {
          gzip?.destroy();
        }
      });
      const destroyResponse = (error: Error) => res.destroy(error);
      gzip.once("error", destroyResponse);
      routePendingDrainListeners(gzip);
      return gzip;
    };

    // Node's writeHead can provide headers and mark them sent before write/end
    // runs. Apply those values first, decide compression, then forward only the
    // status line so Content-Encoding/Vary are present on that common path too.
    res.writeHead = ((
      statusCode: number,
      statusMessageOrHeaders?: string | unknown,
      headers?: unknown
    ) => {
      res.statusCode = statusCode;
      const hasStatusMessage = typeof statusMessageOrHeaders === "string";
      const statusMessage = hasStatusMessage
        ? statusMessageOrHeaders
        : undefined;
      if (hasStatusMessage) {
        res.statusMessage = statusMessage as string;
      }
      applyWriteHeadHeaders(
        res,
        hasStatusMessage ? headers : statusMessageOrHeaders
      );
      decide();
      return hasStatusMessage
        ? originalWriteHead(res.statusCode, statusMessage as string)
        : originalWriteHead(res.statusCode);
    }) as ServerResponse["writeHead"];

    res.write = ((
      chunk: any,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void
    ) => {
      const stream = decide();
      if (!stream) {
        return originalWrite(chunk, encodingOrCallback as any, callback as any);
      }
      return stream.write(chunk, encodingOrCallback as any, callback as any);
    }) as ServerResponse["write"];

    res.end = ((
      chunk?: any,
      encodingOrCallback?: BufferEncoding | (() => void),
      callback?: () => void
    ) => {
      const stream = decide();
      if (!stream) {
        return originalEnd(chunk, encodingOrCallback as any, callback);
      }

      const chunkIsCallback = typeof chunk === "function";
      const endCallback = chunkIsCallback
        ? chunk
        : typeof encodingOrCallback === "function"
          ? encodingOrCallback
          : callback;
      if (endCallback) {
        res.once("finish", endCallback);
      }
      const encoding =
        typeof encodingOrCallback === "string" ? encodingOrCallback : undefined;
      const finalChunk = chunkIsCallback ? undefined : chunk;
      if (encoding === undefined) {
        stream.end(finalChunk);
      } else {
        stream.end(finalChunk, encoding);
      }
      return res;
    }) as ServerResponse["end"];

    next();
  };
}
