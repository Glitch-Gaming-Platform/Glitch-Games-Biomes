import type { Server } from "http";
import net from "net";
import type { Duplex } from "stream";
import { log } from "@/shared/logging";

const DEFAULT_SYNC_PROXY_PORT = 4900;
const EXPECTED_SYNC_PROXY_SOCKET_ERROR_CODES = new Set([
  "EPIPE",
  "ECONNRESET",
  "ERR_STREAM_DESTROYED",
  "ERR_STREAM_PREMATURE_CLOSE",
]);

function configuredSyncProxyPort(): number {
  const raw =
    process.env.GLITCH_SYNC_WS_PROXY_PORT ??
    process.env.GLITCH_SYNC_WEBSOCKET_PORT ??
    process.env.SYNC_PORT ??
    `${DEFAULT_SYNC_PROXY_PORT}`;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SYNC_PROXY_PORT;
}

function isSyncUpgradePath(pathname: string): boolean {
  return pathname === "/sync" || pathname === "/beta-sync" || pathname === "/ro-sync";
}

export function isExpectedGlitchSyncWsProxySocketError(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return (
    typeof code === "string" &&
    EXPECTED_SYNC_PROXY_SOCKET_ERROR_CODES.has(code)
  );
}

function destroySocket(socket: Duplex, error?: Error) {
  if (socket.destroyed) {
    return;
  }
  try {
    socket.destroy(error);
  } catch {
    socket.destroy();
  }
}

function attachSocketGuards(options: {
  client: Duplex;
  upstream: Duplex;
  path: string;
  target: string;
}) {
  const { client, upstream, path, target } = options;
  const sockets = [
    { socket: client, peer: upstream, side: "client" },
    { socket: upstream, peer: client, side: "upstream" },
  ] as const;

  for (const { socket, peer, side } of sockets) {
    socket.on("error", (error) => {
      const details = {
        path,
        target,
        side,
        code: (error as NodeJS.ErrnoException).code,
        error,
      };
      if (isExpectedGlitchSyncWsProxySocketError(error)) {
        log.info("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_SOCKET_CLOSED_V135", details);
      } else {
        log.warn("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_SOCKET_ERROR_V135", details);
      }
      destroySocket(peer);
    });

    socket.on("close", () => {
      destroySocket(peer);
    });
  }
}

export function installGlitchSyncWsProxy(server: Server) {
  const targetHost = process.env.GLITCH_SYNC_WS_PROXY_HOST || "127.0.0.1";
  const targetPort = configuredSyncProxyPort();
  const target = `${targetHost}:${targetPort}`;

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (!isSyncUpgradePath(url.pathname)) {
      return;
    }

    const upstream = net.connect(targetPort, targetHost);
    const failUpstreamConnect = (error: Error) => {
      log.warn("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_FAILED_V134.", {
        path: url.pathname,
        target,
        error,
      });
      destroySocket(socket, error);
    };
    const failClientBeforeConnect = (error: Error) => {
      const details = {
        path: url.pathname,
        target,
        side: "client",
        code: (error as NodeJS.ErrnoException).code,
        error,
      };
      if (isExpectedGlitchSyncWsProxySocketError(error)) {
        log.info("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_SOCKET_CLOSED_V135", details);
      } else {
        log.warn("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_SOCKET_ERROR_V135", details);
      }
      destroySocket(upstream);
    };

    upstream.once("error", failUpstreamConnect);
    socket.once("error", failClientBeforeConnect);
    upstream.once("connect", () => {
      upstream.off("error", failUpstreamConnect);
      socket.off("error", failClientBeforeConnect);
      attachSocketGuards({
        client: socket,
        upstream,
        path: url.pathname,
        target,
      });
      log.info("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_CONNECTED_V134", {
        path: url.pathname,
        target,
      });

      upstream.write(
        `${request.method || "GET"} ${url.pathname}${url.search} HTTP/${request.httpVersion}\r\n`
      );
      for (let i = 0; i < request.rawHeaders.length; i += 2) {
        upstream.write(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}\r\n`);
      }
      upstream.write("\r\n");
      if (head.length > 0) {
        upstream.write(head);
      }
      socket.pipe(upstream).pipe(socket);
    });
  });

  log.info("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_V134 installed /sync, /beta-sync, and /ro-sync on web", {
    target,
  });
}

export const installGlitchSameOriginSyncWebSocketProxy = installGlitchSyncWsProxy;
