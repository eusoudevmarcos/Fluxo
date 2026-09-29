import { createServer } from "node:http";

import { API_PORT } from "./config/env.js";
import { handleGateway } from "./gateway.js";
import { startPushWorker } from "./push-worker.js";

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, app: "Fluxo", service: "gateway" }));
    return;
  }

  if (handleGateway(request, response)) return;

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(API_PORT, () => {
  console.log(`Fluxo gateway listening on :${API_PORT}`);
});

startPushWorker();
