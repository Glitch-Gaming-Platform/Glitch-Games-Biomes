import {
  installGlitchSyncWsProxy,
  isExpectedGlitchSyncWsProxySocketError,
} from "@/server/web/glitch_sync_ws_proxy";
import assert from "assert";
import http from "http";
import net from "net";

function listen(server: http.Server | net.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve(address.port);
    });
  });
}

function close(server: http.Server | net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if ((error as NodeJS.ErrnoException | undefined)?.code === "ERR_SERVER_NOT_RUNNING") {
        resolve();
      } else if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

describe("glitch sync websocket proxy", () => {
  it("classifies expected socket disconnect errors as non-fatal", () => {
    for (const code of [
      "EPIPE",
      "ECONNRESET",
      "ERR_STREAM_DESTROYED",
      "ERR_STREAM_PREMATURE_CLOSE",
    ]) {
      assert.equal(
        isExpectedGlitchSyncWsProxySocketError(Object.assign(new Error(code), { code })),
        true
      );
    }
  });

  it("does not hide unexpected socket errors", () => {
    assert.equal(
      isExpectedGlitchSyncWsProxySocketError(
        Object.assign(new Error("permission denied"), { code: "EACCES" })
      ),
      false
    );
    assert.equal(isExpectedGlitchSyncWsProxySocketError(new Error("plain")), false);
  });

  it("survives a client disconnecting during a proxied sync stream", async () => {
    let upstreamInterval: NodeJS.Timeout | undefined;
    const upstream = net.createServer((socket) => {
      socket.on("error", () => {});
      socket.once("data", () => {
        socket.write(
          "HTTP/1.1 101 Switching Protocols\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n\r\n"
        );
        upstreamInterval = setInterval(() => {
          socket.write(Buffer.alloc(1024, "x"));
        }, 1);
      });
    });
    const originalPort = process.env.GLITCH_SYNC_WS_PROXY_PORT;
    const web = http.createServer();

    try {
      const upstreamPort = await listen(upstream);
      process.env.GLITCH_SYNC_WS_PROXY_PORT = String(upstreamPort);
      installGlitchSyncWsProxy(web);
      const webPort = await listen(web);

      const client = net.connect(webPort, "127.0.0.1");
      client.on("error", () => {});
      client.write(
        "GET /sync?p=2 HTTP/1.1\r\n" +
          "Host: 127.0.0.1\r\n" +
          "Connection: Upgrade\r\n" +
          "Upgrade: websocket\r\n\r\n"
      );
      await new Promise<void>((resolve) => {
        client.once("data", () => {
          client.destroy();
          setTimeout(resolve, 50);
        });
      });
    } finally {
      if (upstreamInterval) {
        clearInterval(upstreamInterval);
      }
      await close(web);
      await close(upstream);

      if (originalPort === undefined) {
        delete process.env.GLITCH_SYNC_WS_PROXY_PORT;
      } else {
        process.env.GLITCH_SYNC_WS_PROXY_PORT = originalPort;
      }
    }
  });
});
