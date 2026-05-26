import {
  UNKNOWN_DEVICE_ID,
  getDeviceIdCookie,
  setDeviceIdCookie,
} from "@/server/shared/auth/cookies";
import { HostPort, listenWithDevFallback } from "@/server/shared/ports";
import type { WebServerRequest } from "@/server/web/context";
import {
  isApiError,
  type ServerResponseMaybeBiomesError,
} from "@/server/web/errors";
import { log, withLogContext } from "@/shared/logging";
import finalhandler from "finalhandler";
import type {
  Server as HTTPServer,
  IncomingMessage,
  ServerResponse,
} from "http";
import { createServer } from "http";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import type { NextApiRequest } from "next";
import next from "next";
import type { NextServer } from "next/dist/server/next";
import { extname, relative, resolve } from "path";
import { list } from "recursive-readdir-async";
import responseTime from "response-time";
import { parse } from "url";

async function findStaticPaths() {
  const staticSet = new Set<string>("/");
  const absoluteBase = resolve("./public");
  await list(
    absoluteBase,
    {},
    (obj: {
      name: string;
      path: string;
      fullname: string;
      isDirectory: boolean;
    }) => {
      if (!obj.isDirectory) {
        staticSet.add(obj.fullname.slice(absoluteBase.length));
      }
    }
  );
  return staticSet;
}

export type NextApiRequestWithContext<C> = NextApiRequest & { context: C };

const GCP_USER_AGENT_PREFIXES = ["GoogleHC", "GoogleStackDriverMonitoring"].map(
  (a) => a.toLowerCase()
);

function addOriginTrialHeaders(req: IncomingMessage, res: ServerResponse) {
  // TODO: these headers allow SharedArrayBuffer without an origin trial, but
  //       they break the signin link flows.
  //       Chrome is expecting to change these requirements in the future.
  //       If change doesn't progress here we could change the
  //       signin/login/link flows to be a separate page without these headers
  //       and allow our main game page to use them.
  //context.res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  //context.res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  //context.res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  if (req.headers.host === "localhost:3000") {
    res.setHeader(
      "Origin-Trial",
      "AuKHz2ifylDpZfg7iawfCDGtilbLT+tg9CCbVG4PNSxRA1v2NtYGRKAKctmE4Us42+t1lZ3IkPO9s5/VlHy/rwIAAABgeyJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJmZWF0dXJlIjoiVW5yZXN0cmljdGVkU2hhcmVkQXJyYXlCdWZmZXIiLCJleHBpcnkiOjE2NTg4Nzk5OTl9"
    );
  } else {
    res.setHeader(
      "Origin-Trial",
      "AtC5hLqG56A2sDremQjS1ner5bn4eeziP0B1uCzLAJk/bj2gduVbLDOsAScnri+ezDb19qNUq7QRK3/7pw35OQEAAABzeyJvcmlnaW4iOiJodHRwczovL2Jpb21lcy5nZzo0NDMiLCJmZWF0dXJlIjoiVW5yZXN0cmljdGVkU2hhcmVkQXJyYXlCdWZmZXIiLCJleHBpcnkiOjE2NjYxMzc1OTksImlzU3ViZG9tYWluIjp0cnVlfQ=="
    );
  }
}

function determineLogUrl(raw?: string) {
  raw ??= "[unknown]";
  const url = parse(raw, false);
  if (
    url.pathname?.startsWith("/api/auth") ||
    url.pathname?.startsWith("/auth")
  ) {
    return `${url.pathname}?[redacted]`;
  }
  return raw;
}

export interface RequestLogInfo {
  url: string | undefined;
  method: string | undefined;
  headers: Record<string, string | string[]>;
  bdid: string | undefined;
  remoteAddress: string | undefined;
}

export function captureRequest(req: IncomingMessage): RequestLogInfo {
  return {
    url: determineLogUrl(req.url),
    method: req.method,
    headers: req.headers as Record<string, string | string[]>,
    bdid: getDeviceIdCookie(req),
    remoteAddress: req.socket.remoteAddress,
  };
}

export function httpRequestContext(req: RequestLogInfo) {
  return {
    BDID: req.bdid,
    httpRequest: {
      requestMethod: req.method,
      requestUrl: req.url,
      requestSize: req.headers["content-length"],
      status: 200,
      userAgent: req.headers["user-agent"],
      remoteIp: req.headers["x-forwarded-for"] || req.remoteAddress,
      serverIp: req.headers["host"],
      referer: req.headers["referer"],
    } as {
      [key: string]: any;
    },
  };
}

export function logHttpRequest(
  req: RequestLogInfo,
  statusCodeOrError: number | any,
  additional?: {
    latency?: string;
    responseSize?: string;
    [key: string]: any;
  }
) {
  let statusCode = 200;
  let error: any;
  if (typeof statusCodeOrError === "number") {
    statusCode = statusCodeOrError;
  } else if (isApiError(statusCodeOrError)) {
    statusCode = statusCodeOrError.status();
    error = statusCodeOrError;
  } else {
    statusCode = 500;
    error = statusCodeOrError;
  }

  const context = {
    ...httpRequestContext(req),
    ...additional,
  };
  context.httpRequest.status = statusCode;
  if (additional?.latency) {
    context.httpRequest.latency = additional.latency;
    delete additional.latency;
  }
  if (additional?.responseSize) {
    context.httpRequest.responseSize = additional.responseSize;
    delete additional.responseSize;
  }
  if (error) {
    if (statusCode >= 500) {
      log.error(`${statusCode} ${req.url}`, {
        ...context,
        error,
      });
    } else {
      log.info(`${statusCode} ${req.url}`, {
        ...context,
        error,
      });
    }
  } else {
    if (statusCode >= 500) {
      log.error(
        `${statusCode} ${req.url}: Internal error "${statusCode}", actual callstack can likely be found in the previous log.`,
        context
      );
    } else {
      log.info(`${statusCode} ${req.url}`, context);
    }
  }
}



const GLITCH_LOCAL_BUCKET_ASSET_PROXY_V146 = "GLITCH_LOCAL_BUCKET_ASSET_PROXY_V146";
const GLITCH_BUCKET_ASSET_PROXY_ALLOWED_BUCKETS = new Set([
  "biomes-static",
  "biomes-bikkie",
]);

function shouldProxyLocalBucketAssetsV146() {
  return (
    process.env.GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_LOCAL_ASSETS === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1" ||
    !!process.env.GLITCH_TITLE_ID
  );
}

function contentTypeForBucketAssetV146(pathname: string) {
  switch (extname(pathname).toLowerCase()) {
    case ".avif":
      return "image/avif";
    case ".bin":
      return "application/octet-stream";
    case ".css":
      return "text/css; charset=utf-8";
    case ".glb":
      return "model/gltf-binary";
    case ".gltf":
      return "model/gltf+json; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".ktx2":
      return "image/ktx2";
    case ".mp3":
      return "audio/mpeg";
    case ".ogg":
      return "audio/ogg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".wasm":
      return "application/wasm";
    case ".webm":
      return "audio/webm";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function cacheControlForBucketAssetV146(pathname: string) {
  if (/^assets\/[0-9a-f]{2}\/[0-9a-f]{40}$/i.test(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  if (/\.[0-9a-f]{8,}\./i.test(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=3600, must-revalidate";
}

function safeBucketObjectPathV146(rawPath: string) {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return undefined;
  }
  decodedPath = decodedPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = decodedPath.split("/").filter((part) => part.length > 0);
  if (
    parts.length === 0 ||
    parts.some((part) => part === "." || part === ".." || part.includes("\0"))
  ) {
    return undefined;
  }
  return parts.join("/");
}

function remoteBucketBaseUrlV146(bucket: string) {
  const envKey = `GLITCH_${bucket.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_FALLBACK_BASE_URL`;
  const explicit = process.env[envKey] ?? process.env.GLITCH_BUCKET_FALLBACK_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  if (bucket === "biomes-static") {
    return (process.env.GLITCH_STATIC_BUCKET_FALLBACK_BASE_URL ?? "https://storage.googleapis.com/biomes-static").replace(/\/+$/, "");
  }
  if (bucket === "biomes-bikkie") {
    return (process.env.GLITCH_BIKKIE_BUCKET_FALLBACK_BASE_URL ?? "https://storage.googleapis.com/biomes-bikkie").replace(/\/+$/, "");
  }
  return undefined;
}

function encodedBucketObjectPathV146(pathname: string) {
  return pathname.split("/").map(encodeURIComponent).join("/");
}

const GLITCH_HASH_BUCKET_ASSET_PATH_V147 =
  /^assets\/[0-9a-f]{2}\/[0-9a-f]{40}(?:\.[a-z0-9]+)?$/i;

function isSafeLocalPublicPathV147(publicRoot: string, candidate: string) {
  const rel = relative(publicRoot, candidate);
  return rel === "" || (!!rel && !rel.startsWith("..") && !rel.startsWith("/"));
}

function localBucketAssetCandidatesV147(
  publicRoot: string,
  bucket: string,
  objectPath: string
) {
  const candidates = [
    resolve(publicRoot, "buckets", bucket, objectPath),
  ];

  if (
    bucket === "biomes-static" &&
    GLITCH_HASH_BUCKET_ASSET_PATH_V147.test(objectPath)
  ) {
    // GLITCH_STATIC_TO_BIKKIE_BUCKET_ALIAS_V147:
    // Bikkie binary attributes are emitted as /buckets/biomes-static/assets/...
    // in local/Glitch runtimes, but the snapshot build stores many of those exact
    // hash-addressed files under public/buckets/biomes-bikkie/assets/...
    // Probe the local bikkie bucket before falling back to remote GCS, otherwise
    // valid packaged files become 403 "Missing bucket asset fallback" responses.
    candidates.push(resolve(publicRoot, "buckets", "biomes-bikkie", objectPath));
  }

  if (bucket === "biomes-static") {
    candidates.push(resolve(publicRoot, objectPath));
  }

  return candidates;
}

async function tryServeGlitchLocalBucketAssetV146(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
) {
  if (!shouldProxyLocalBucketAssetsV146()) {
    return false;
  }
  const match = /^\/buckets\/([^/]+)\/(.+)$/.exec(pathname);
  if (!match) {
    return false;
  }

  const bucket = match[1];
  if (!GLITCH_BUCKET_ASSET_PROXY_ALLOWED_BUCKETS.has(bucket)) {
    return false;
  }
  const objectPath = safeBucketObjectPathV146(match[2]);
  if (!objectPath) {
    res.statusCode = 400;
    res.end("Invalid bucket asset path");
    return true;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method not allowed");
    return true;
  }

  const publicRoot = resolve("./public");
  const localCandidates = localBucketAssetCandidatesV147(
    publicRoot,
    bucket,
    objectPath
  );

  for (const candidate of localCandidates) {
    if (!isSafeLocalPublicPathV147(publicRoot, candidate)) {
      continue;
    }
    try {
      const fileStat = await stat(candidate);
      if (!fileStat.isFile()) {
        continue;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", contentTypeForBucketAssetV146(objectPath));
      res.setHeader("Content-Length", String(fileStat.size));
      res.setHeader("Cache-Control", cacheControlForBucketAssetV146(objectPath));
      res.setHeader("X-Glitch-Bucket-Asset-Proxy", `${GLITCH_LOCAL_BUCKET_ASSET_PROXY_V146}; source=local`);
      if (req.method === "HEAD") {
        res.end();
      } else {
        createReadStream(candidate).pipe(res);
      }
      return true;
    } catch {
      // Try the next local path, then the public bucket fallback below.
    }
  }

  const remoteBase = remoteBucketBaseUrlV146(bucket);
  if (!remoteBase || process.env.GLITCH_DISABLE_REMOTE_BUCKET_FALLBACK === "1") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`Missing bucket asset: ${bucket}/${objectPath}`);
    return true;
  }

  const remoteUrl = `${remoteBase}/${encodedBucketObjectPathV146(objectPath)}`;
  try {
    const upstream = await fetch(remoteUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
    });
    if (!upstream.ok) {
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(`Missing bucket asset fallback: ${bucket}/${objectPath}`);
      log.warn("Glitch bucket asset fallback miss", {
        bucket,
        objectPath,
        remoteUrl,
        status: upstream.status,
      });
      return true;
    }

    const contentType = upstream.headers.get("content-type") ?? contentTypeForBucketAssetV146(objectPath);
    const cacheControl = upstream.headers.get("cache-control") ?? cacheControlForBucketAssetV146(objectPath);
    const contentLength = upstream.headers.get("content-length");
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("X-Glitch-Bucket-Asset-Proxy", `${GLITCH_LOCAL_BUCKET_ASSET_PROXY_V146}; source=remote`);
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    if (!contentLength) {
      res.setHeader("Content-Length", String(body.length));
    }
    res.end(body);
    return true;
  } catch (error) {
    log.error("Glitch bucket asset fallback failed", {
      bucket,
      objectPath,
      remoteUrl,
      error,
    });
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(`Bucket asset fallback failed: ${bucket}/${objectPath}`);
    return true;
  }
}

const ACCEPTABLE_STATIC_FILES = new Set(["/sw.js"]);

function maybeReportStatic(path: string) {
  if (
    process.env.NODE_ENV === "production" &&
    !ACCEPTABLE_STATIC_FILES.has(path)
  ) {
    log.warn(`Web server serving static: ${path}`);
  }
}

export class ApiApp {
  public readonly http: HTTPServer;
  private context?: any;

  constructor(app: NextServer, private staticSet: Set<string>) {
    const middlewareResponseTime = responseTime((req, res, time) => {
      const userAgent = (req.headers["user-agent"] || "").toLowerCase();
      if (
        GCP_USER_AGENT_PREFIXES.some((prefix) => userAgent.startsWith(prefix))
      ) {
        // Ignore health check requests for logging purposes.
        return;
      }
      const errorOrStatusCode =
        (res as ServerResponseMaybeBiomesError).maybeBiomesError ??
        res.statusCode;
      logHttpRequest(captureRequest(req), errorOrStatusCode, {
        responseSize: String(res.getHeader("content-length")),
        latency: `${(time / 1000).toFixed(3)}s`,
      });
      res.setHeader("Server-Timing", `app;dur=${time.toFixed(0)}`);
    });

    this.http = createServer((req, res) => {
      if (this.context !== undefined) {
        (req as WebServerRequest).context = this.context;
      }
      if (getDeviceIdCookie(req) === UNKNOWN_DEVICE_ID) {
        req.headers["x-bdid"] = setDeviceIdCookie(res, req);
      }
      const url = parse(req.url!, true);
      withLogContext(
        {
          path: url.pathname ?? "[unknown]",
        },
        () => {
          const done = finalhandler(req, res);
          middlewareResponseTime(req, res, (err) => {
            if (err) return done(err);
            void (async () => {
              if (
                url.pathname &&
                (await tryServeGlitchLocalBucketAssetV146(req, res, url.pathname))
              ) {
                return;
              }

              if (url.pathname) {
                if (url.pathname?.startsWith("/_next/static")) {
                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=31536000, immutable"
                  );
                  maybeReportStatic(url.pathname);
                } else if (this.staticSet.has(url.pathname)) {
                  res.setHeader("Cache-Control", "public, max-age=3600");
                  maybeReportStatic(url.pathname);
                }
              }

              addOriginTrialHeaders(req, res);
              await app.getRequestHandler()(req, res, url);
              if (res.statusCode === 413) {
                // This particular error code is tricky to catch because it's
                // interpreted as an API error (and thus usually not flagged as
                // a network error), but is generated by next.js, not Biomes.
                // Flag it here as an error explicitly to improve observability.
                // See GI-1082 for more info on what prompted this.
                log.error(
                  `Error 413 (${res.statusMessage}) produced (probably within NextJS) on request to "${url.pathname}". Check client and/or server logs for more details.`
                );
              }
            })().catch(done);
          });
        }
      );
    });
  }

  public async start(context: any) {
    this.context = context;

    const defaultPort = HostPort.forWeb().port;
    const requestedPort = Number.parseInt(
      process.env.GLITCH_WEB_PORT ?? process.env.WEB_PORT ?? process.env.PORT ?? "",
      10
    );

    const port =
      (process.env.GLITCH_RUNTIME === "1" || !!process.env.GLITCH_TITLE_ID) &&
      Number.isFinite(requestedPort) &&
      requestedPort > 0
        ? requestedPort
        : defaultPort;

    log.info(`Starting Web HTTP server on 0.0.0.0:${port}`);
    listenWithDevFallback("Web", this.http, port);
  }

  public async stop() {
    this.http.close();
  }
}

export async function registerApp() {
  // Parse out enviornment variables.
  const dev = process.env.NODE_ENV !== "production";

  log.info(`Server is running in ${dev ? "development" : "production"} mode`);

  // Initialize next.js HTTP server.
  const app = next({ dev, quiet: false });
  await app.prepare();
  return new ApiApp(app, await findStaticPaths());
}
