import type { Server } from "http";
import net from "net";
import { log } from "@/shared/logging";

const DEFAULT_SYNC_PROXY_PORT = 4900;

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

export function installGlitchSyncWsProxy(server: Server) {
  const targetHost = process.env.GLITCH_SYNC_WS_PROXY_HOST || "127.0.0.1";
  const targetPort = configuredSyncProxyPort();

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (!isSyncUpgradePath(url.pathname)) {
      return;
    }

    const upstream = net.connect(targetPort, targetHost);
    const fail = (error: Error) => {
      log.warn("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_FAILED_V134.", {
        path: url.pathname,
        target: `${targetHost}:${targetPort}`,
        error,
      });
      try {
        socket.destroy(error);
      } catch {
        socket.destroy();
      }
    };

    upstream.once("error", fail);
    upstream.once("connect", () => {
      upstream.off("error", fail);
      log.info("GLITCH_SAME_ORIGIN_SYNC_WS_PROXY_CONNECTED_V134", {
        path: url.pathname,
        target: `${targetHost}:${targetPort}`,
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
    target: `${targetHost}:${targetPort}`,
  });
}
