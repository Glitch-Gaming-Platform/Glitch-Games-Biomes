#!/usr/bin/env node
const http = require("http");

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.BASE_PORT || 3000);
const timeoutMs = Number(
  process.env.GLITCH_SIMULATION_HEALTH_TIMEOUT_MS || 1500
);

const workers = [
  { name: "anima", host: "127.0.0.1", port: 4101 },
  { name: "gaia", host: "127.0.0.1", port: 4201 },
];

function workerReady(worker) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: worker.host,
        port: worker.port,
        path: "/ready",
        timeout: timeoutMs,
      },
      (response) => {
        response.resume();
        resolve({
          name: worker.name,
          ready: response.statusCode === 200,
          statusCode: response.statusCode || 0,
        });
      }
    );
    request.on("timeout", () => {
      request.destroy();
      resolve({ name: worker.name, ready: false, error: "timeout" });
    });
    request.on("error", (error) => {
      resolve({
        name: worker.name,
        ready: false,
        error: error.code || "error",
      });
    });
  });
}

const server = http.createServer(async (request, response) => {
  if (request.url !== "/" && request.url !== "/ready") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not_found" }));
    return;
  }

  const status = await Promise.all(workers.map(workerReady));
  const ready = status.every((worker) => worker.ready);
  response.writeHead(ready ? 200 : 503, {
    "cache-control": "no-store",
    "content-type": "application/json",
  });
  response.end(
    JSON.stringify({
      ok: ready,
      role: "simulation",
      workers: status,
    })
  );
});

server.listen(port, host, () => {
  console.log(
    `GLITCH_SIMULATION_HEALTH listening on http://${host}:${port}; readiness requires Anima and Gaia`
  );
});
