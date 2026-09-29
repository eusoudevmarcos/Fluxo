// Render define PORT para web services; API_PORT fica para rodar local.
export const API_PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
// Servicos internos (rede privada do Render). Ex.: http://wave-auth:9999
export const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:9999";
export const REST_URL = process.env.REST_URL ?? "http://localhost:3000";
export const STORAGE_URL = process.env.STORAGE_URL ?? "http://localhost:5000";
// Chaves publicas do projeto (JWTs assinados com JWT_SECRET; ver infra/render/generate-keys.mjs).
export const ANON_KEY = process.env.ANON_KEY ?? "";
export const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? "";
// Conexao direta ao Postgres (dono do banco) para o envio de push.
export const DATABASE_URL = process.env.DATABASE_URL ?? "";
export const PUSH_WORKER_ENABLED = process.env.PUSH_WORKER_ENABLED !== "false";
export const PUSH_INTERVAL_MS = Number(process.env.PUSH_INTERVAL_MS ?? 5000);
// Origens do navegador liberadas (virgula). Vazio = qualquer origem (o app mobile nao manda Origin).
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
