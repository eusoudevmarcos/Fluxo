import { createServer } from "node:http";
import { API_PORT } from "./config/env.js";
const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
            ok: true,
            app: "Ocean",
            service: "api",
        }));
        return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "Not found" }));
});
server.listen(API_PORT, () => {
    console.log(`Ocean API listening on http://localhost:${API_PORT}`);
});
