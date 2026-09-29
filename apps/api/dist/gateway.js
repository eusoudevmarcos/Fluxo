import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { ALLOWED_ORIGINS, ANON_KEY, AUTH_URL, REST_URL, SERVICE_ROLE_KEY, STORAGE_URL } from "./config/env.js";
const ROUTES = [
    { prefix: "/auth/v1", target: AUTH_URL },
    { prefix: "/rest/v1", target: REST_URL },
    { prefix: "/storage/v1", target: STORAGE_URL },
];
// Rotas abertas sem apikey: retorno do OAuth/links de e-mail e midia publica (<img src>).
const OPEN_PATHS = [
    /^\/auth\/v1\/(callback|verify|authorize|settings|health)\b/,
    /^\/storage\/v1\/object\/public\//,
    /^\/storage\/v1\/render\/image\/public\//,
];
const CORS_HEADERS = {
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, range, accept-profile, content-profile, x-upsert, cache-control, x-retry-count",
    "access-control-expose-headers": "content-range, content-length, content-type, x-total-count, location",
    "access-control-max-age": "86400",
};
function corsOrigin(request) {
    const origin = request.headers.origin;
    if (!origin)
        return null;
    if (!ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin))
        return origin;
    return null;
}
function hasValidApiKey(request, url) {
    if (!ANON_KEY)
        return true; // sem chave configurada (dev local), nao bloqueia
    const header = request.headers.apikey;
    const key = (Array.isArray(header) ? header[0] : header) ?? url.searchParams.get("apikey");
    return key === ANON_KEY || (SERVICE_ROLE_KEY !== "" && key === SERVICE_ROLE_KEY);
}
function sendJson(response, status, body, extra = {}) {
    response.writeHead(status, { "content-type": "application/json", ...extra });
    response.end(JSON.stringify(body));
}
export function handleGateway(request, response) {
    const url = new URL(request.url ?? "/", "http://gateway.local");
    const origin = corsOrigin(request);
    const cors = origin
        ? { ...CORS_HEADERS, "access-control-allow-origin": origin, vary: "Origin" }
        : {};
    if (request.method === "OPTIONS") {
        response.writeHead(204, cors);
        response.end();
        return true;
    }
    const route = ROUTES.find((item) => url.pathname === item.prefix || url.pathname.startsWith(`${item.prefix}/`));
    if (!route)
        return false;
    const isOpen = OPEN_PATHS.some((pattern) => pattern.test(url.pathname));
    if (!isOpen && !hasValidApiKey(request, url)) {
        sendJson(response, 401, { message: "Invalid API key" }, cors);
        return true;
    }
    const target = new URL(route.target);
    const upstreamPath = url.pathname.slice(route.prefix.length) || "/";
    const headers = { ...request.headers };
    delete headers.host;
    // Servicos atras do gateway geram links (OAuth, e-mail) com o endereco publico.
    headers["x-forwarded-host"] = request.headers.host ?? "";
    headers["x-forwarded-proto"] = request.headers["x-forwarded-proto"] ?? "https";
    headers["x-forwarded-prefix"] = route.prefix;
    const send = target.protocol === "https:" ? httpsRequest : httpRequest;
    const upstream = send({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: request.method,
        path: `${target.pathname.replace(/\/$/, "")}${upstreamPath}${url.search}`,
        headers,
    }, (upstreamResponse) => {
        const responseHeaders = { ...upstreamResponse.headers };
        // O gateway e quem controla CORS.
        for (const name of Object.keys(responseHeaders)) {
            if (name.startsWith("access-control-"))
                delete responseHeaders[name];
        }
        response.writeHead(upstreamResponse.statusCode ?? 502, { ...responseHeaders, ...cors });
        upstreamResponse.pipe(response);
    });
    upstream.on("error", (error) => {
        if (!response.headersSent) {
            sendJson(response, 502, { message: "Serviço indisponível", detail: error.message }, cors);
        }
        else {
            response.destroy(error);
        }
    });
    request.pipe(upstream);
    return true;
}
