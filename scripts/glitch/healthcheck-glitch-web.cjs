/* eslint-disable no-console */
const http = require("http");

const port = Number(process.env.WEB_PORT || 3000);
const req = http.get(
  {
    host: "127.0.0.1",
    port,
    path: "/",
    timeout: 8000,
  },
  (res) => {
    res.resume();
    process.exit(res.statusCode && res.statusCode < 500 ? 0 : 1);
  }
);

req.on("timeout", () => {
  req.destroy(new Error("healthcheck timeout"));
});

req.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
