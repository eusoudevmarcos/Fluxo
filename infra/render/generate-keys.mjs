// Gera os segredos da pilha no Render: JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY (JWTs HS256 no
// formato do Supabase) e as senhas dos papeis do banco. Grava em infra/render/.env.secrets
// (ignorado pelo Git) e NAO imprime os valores. Rodar uma vez: node infra/render/generate-keys.mjs
// Rodar de novo gera chaves NOVAS (todo mundo precisa logar de novo e os apps precisam da nova
// ANON_KEY) -- use --force para sobrescrever.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// --out <arquivo> grava em outro lugar (ex.: segredos so do ensaio local).
const outIndex = process.argv.indexOf("--out");
const target = outIndex > -1 ? path.resolve(process.argv[outIndex + 1]) : path.join(here, ".env.secrets");

if (fs.existsSync(target) && !process.argv.includes("--force")) {
  console.log(`Ja existe ${target}. Use --force para gerar chaves novas.`);
  process.exit(0);
}

const base64url = (input) => Buffer.from(input).toString("base64url");
const secret = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

function signJwt(payload, jwtSecret) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", jwtSecret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

const jwtSecret = secret(48);
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 60 * 60; // 10 anos, como as chaves do Supabase

const values = {
  JWT_SECRET: jwtSecret,
  ANON_KEY: signJwt({ role: "anon", iss: "supabase", iat, exp }, jwtSecret),
  SERVICE_ROLE_KEY: signJwt({ role: "service_role", iss: "supabase", iat, exp }, jwtSecret),
  AUTHENTICATOR_PASSWORD: secret(24),
  AUTH_ADMIN_PASSWORD: secret(24),
  STORAGE_ADMIN_PASSWORD: secret(24),
};

const lines = [
  "# GERADO por infra/render/generate-keys.mjs - SECRETO, ignorado pelo Git. Nao compartilhe.",
  ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
  "",
];

fs.writeFileSync(target, lines.join("\n"), { mode: 0o600 });
console.log(`Chaves geradas em ${target} (${Object.keys(values).join(", ")}).`);
