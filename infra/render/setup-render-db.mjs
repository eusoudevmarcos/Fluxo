// Migracao Supabase -> Render (banco). Usa Docker (imagem postgres:17-alpine) para psql/pg_dump,
// entao nao precisa instalar o Postgres na maquina. Le infra/render/.env.migration e
// infra/render/.env.secrets (gera com generate-keys.mjs se faltar).
//
//   node infra/render/setup-render-db.mjs check        so leitura: permissoes e contagens
//   node infra/render/setup-render-db.mjs migrate      prepara o Render e copia tudo do Supabase
//   node infra/render/setup-render-db.mjs copy-files   depois dos servicos no ar: copia as midias
//
// Opcoes: --source <url> --target <url> sobrescrevem as URLs (usado no ensaio local);
//         --force migra mesmo se o banco do Render ja tiver tabelas em public.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const workDir = path.join(here, ".work");
const migrationsDir = path.join(repoRoot, "packages/database/migrations");
const PG_IMAGE = "postgres:17-alpine";

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(`\nERRO: ${message}`);
  process.exit(1);
}

function withSsl(url) {
  if (!url || /sslmode=/.test(url) || /localhost|host\.docker\.internal/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

const command = process.argv[2];
const config = readEnvFile(path.join(here, ".env.migration"));
// --secrets <arquivo>: outro conjunto de chaves (o ensaio local usa o proprio, sem tocar no de producao).
const secretsFile = argValue("--secrets") ? path.resolve(argValue("--secrets")) : path.join(here, ".env.secrets");

if (!fs.existsSync(secretsFile) && command !== "check") {
  spawnSync(process.execPath, [path.join(here, "generate-keys.mjs")], { stdio: "inherit" });
}
const secrets = readEnvFile(secretsFile);

const SOURCE = withSsl(argValue("--source") ?? config.SUPABASE_DATABASE_URL);
const TARGET = withSsl(argValue("--target") ?? config.RENDER_DATABASE_URL);

// Roda psql/pg_dump num container. As URLs vao por variavel de ambiente (nao aparecem no log).
function pg(tool, args, { url, input, mountWork = false, capture = true } = {}) {
  const dockerArgs = ["run", "--rm", "-i", "--add-host=host.docker.internal:host-gateway", "-e", "PGURL"];
  if (mountWork) dockerArgs.push("-v", `${workDir}:/work`);
  dockerArgs.push(PG_IMAGE, "sh", "-c", `${tool} "$PGURL" ${args.map((arg) => `'${arg.replace(/'/g, "'\\''")}'`).join(" ")}`);
  const result = spawnSync("docker", dockerArgs, {
    env: { ...process.env, PGURL: url },
    input,
    encoding: "utf8",
    stdio: capture ? ["pipe", "pipe", "pipe"] : ["pipe", "inherit", "inherit"],
    maxBuffer: 1024 * 1024 * 512,
  });
  return { ok: result.status === 0, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function sql(url, statement) {
  const result = pg("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement], { url });
  if (!result.ok) fail(`${statement.slice(0, 80)}...\n${result.stderr}`);
  return result.stdout.trim();
}

function runSqlFile(url, file, extraArgs = []) {
  const content = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const result = pg("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", ...extraArgs, "-f", "-"], { url, input: content });
  if (!result.ok) fail(`${path.basename(file)}:\n${result.stderr.split("\n").slice(-8).join("\n")}`);
}

function requireUrls() {
  if (!TARGET) fail("preencha RENDER_DATABASE_URL em infra/render/.env.migration");
  if (!SOURCE) fail("preencha SUPABASE_DATABASE_URL em infra/render/.env.migration");
}

// ---------------------------------------------------------------- check
function check() {
  if (!TARGET) fail("preencha RENDER_DATABASE_URL em infra/render/.env.migration");
  console.log("Render:");
  console.log(
    sql(
      TARGET,
      "select 'versao: ' || current_setting('server_version') || ' | usuario: ' || current_user || ' | superusuario: ' || rolsuper || ' | pode criar papeis: ' || rolcreaterole from pg_roles where rolname = current_user",
    ),
  );
  console.log(`tabelas em public: ${sql(TARGET, "select count(*) from pg_tables where schemaname = 'public'")}`);
  if (SOURCE) {
    console.log("\nSupabase:");
    console.log(
      sql(
        SOURCE,
        "select 'usuarios: ' || (select count(*) from auth.users) || ' | perfis: ' || (select count(*) from public.profiles) || ' | posts: ' || (select count(*) from public.contents) || ' | arquivos: ' || (select count(*) from storage.objects)",
      ),
    );
  }
}

// ---------------------------------------------------------------- migrate
function renderInternalUrl(externalUrl, user, password) {
  const url = new URL(externalUrl);
  // dpg-xxxx-a.oregon-postgres.render.com -> dpg-xxxx-a (rede privada do Render)
  const internalHost = url.hostname.endsWith(".render.com") ? url.hostname.split(".")[0] : url.hostname;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${internalHost}:${url.port || 5432}${url.pathname}`;
}

function supabaseStorageBase(sourceUrl) {
  const url = new URL(sourceUrl);
  const ref =
    url.username.startsWith("postgres.") ? url.username.slice("postgres.".length) : url.hostname.split(".")[1];
  return `https://${ref}.supabase.co/storage/v1`;
}

function migrate() {
  requireUrls();
  if (!secrets.JWT_SECRET) fail("infra/render/.env.secrets sem JWT_SECRET (rode generate-keys.mjs)");
  fs.mkdirSync(workDir, { recursive: true });

  const privileges = sql(TARGET, "select rolsuper::text || ',' || rolcreaterole::text from pg_roles where rolname = current_user");
  if (!privileges.split(",").includes("true")) {
    fail("o usuario do banco do Render nao pode criar papeis (CREATEROLE). Me avise: vamos pelo plano B.");
  }

  const publicTables = Number(sql(TARGET, "select count(*) from pg_tables where schemaname = 'public'"));
  if (publicTables > 0 && !process.argv.includes("--force")) {
    fail(`o banco do Render ja tem ${publicTables} tabelas em public. Use --force se tiver certeza.`);
  }

  console.log("1/8 preparando papeis e schemas no Render...");
  runSqlFile(TARGET, path.join(here, "bootstrap.sql"), [
    "-v", `authenticator_password=${secrets.AUTHENTICATOR_PASSWORD}`,
    "-v", `auth_admin_password=${secrets.AUTH_ADMIN_PASSWORD}`,
    "-v", `storage_admin_password=${secrets.STORAGE_ADMIN_PASSWORD}`,
  ]);

  console.log("2/8 copiando o banco do Supabase (public, auth, storage)...");
  const dump = pg(
    "pg_dump",
    ["--schema=public", "--schema=auth", "--schema=storage", "--no-owner", "--no-publications",
      "--no-subscriptions", "--no-comments", "-f", "/work/supabase.sql"],
    { url: SOURCE, mountWork: true },
  );
  if (!dump.ok) fail(`pg_dump:\n${dump.stderr}`);

  console.log("3/8 adaptando a copia para o Render...");
  let content = fs.readFileSync(path.join(workDir, "supabase.sql"), "utf8");
  content = content
    .split("\n")
    .filter(
      (line) =>
        !/^CREATE SCHEMA (auth|storage|public);/.test(line) &&
        !/^SET transaction_timeout/.test(line) &&
        !/^ALTER DEFAULT PRIVILEGES/.test(line) &&
        !/^(CREATE|ALTER|DROP) EVENT TRIGGER/.test(line),
    )
    .join("\n");
  fs.writeFileSync(path.join(workDir, "supabase-render.sql"), content);

  // Papeis do Supabase citados nos GRANTs que nao existem no Render viram papeis sem login.
  const referenced = new Set();
  for (const match of content.matchAll(/^(?:GRANT|REVOKE)[^;]*?\b(?:TO|FROM)\s+([^;]+);/gm)) {
    for (const role of match[1].split(",")) referenced.add(role.trim().replace(/^"|"$/g, "").split(/\s/)[0]);
  }
  referenced.delete("PUBLIC");
  for (const role of referenced) {
    sql(TARGET, `do $$ begin if not exists (select 1 from pg_roles where rolname = '${role.replace(/'/g, "''")}') then execute format('create role %I nologin', '${role.replace(/'/g, "''")}'); end if; end $$`);
  }

  console.log("4/8 restaurando no Render...");
  runSqlFile(TARGET, path.join(workDir, "supabase-render.sql"));

  console.log("5/8 devolvendo auth e storage aos seus donos...");
  sql(
    TARGET,
    `do $$ declare item record; begin
      for item in select c.relname, n.nspname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('auth', 'storage') and c.relkind in ('r', 'p', 'v', 'm') loop
        execute format('alter %s %I.%I owner to %I',
          case item.relkind when 'S' then 'sequence' when 'v' then 'view' when 'm' then 'materialized view' else 'table' end,
          item.nspname, item.relname,
          case item.nspname when 'auth' then 'supabase_auth_admin' else 'supabase_storage_admin' end);
      end loop;
      for item in select p.oid::regprocedure as signature, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('auth', 'storage') loop
        execute format('alter function %s owner to %I', item.signature,
          case item.nspname when 'auth' then 'supabase_auth_admin' else 'supabase_storage_admin' end);
      end loop;
    end $$`,
  );
  runSqlFile(TARGET, path.join(here, "storage-service-role.sql"));

  console.log("6/8 aplicando as migrations 046 a 057...");
  for (const file of fs.readdirSync(migrationsDir).filter((name) => /^0(4[6-9]|5\d)_.*\.sql$/.test(name)).sort()) {
    runSqlFile(TARGET, path.join(migrationsDir, file));
    console.log(`   ok ${file}`);
  }

  console.log("7/8 trocando enderecos antigos das midias...");
  const oldBase = supabaseStorageBase(SOURCE);
  const publicApi = (config.PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  if (publicApi) {
    const newBase = `${publicApi}/storage/v1`;
    sql(
      TARGET,
      `do $$ declare item record; begin
        for item in select table_name, column_name from information_schema.columns
          where table_schema = 'public' and data_type in ('text', 'character varying') loop
          execute format('update public.%I set %I = replace(%I, %L, %L) where %I like %L',
            item.table_name, item.column_name, item.column_name, '${oldBase}', '${newBase}',
            item.column_name, '%${oldBase}%');
        end loop;
      end $$`,
    );
  } else {
    console.log("   PUBLIC_API_URL vazio: pulei (rode migrate de novo com ele, ou faca depois).");
  }
  sql(TARGET, "notify pgrst, 'reload schema'");

  console.log("8/8 gravando os valores para o Render em infra/render/.env.secrets...");
  const target = new URL(TARGET);
  const owner = decodeURIComponent(target.username);
  const ownerPassword = decodeURIComponent(target.password);
  const values = {
    GATEWAY_DATABASE_URL: renderInternalUrl(TARGET, owner, ownerPassword),
    AUTH_DB_URL: `${renderInternalUrl(TARGET, "supabase_auth_admin", secrets.AUTH_ADMIN_PASSWORD)}?search_path=auth`,
    REST_DB_URI: renderInternalUrl(TARGET, "authenticator", secrets.AUTHENTICATOR_PASSWORD),
    STORAGE_DB_URL: renderInternalUrl(TARGET, "supabase_storage_admin", secrets.STORAGE_ADMIN_PASSWORD),
    API_EXTERNAL_URL: publicApi ? `${publicApi}/auth/v1` : "",
    GOOGLE_REDIRECT_URI: publicApi ? `${publicApi}/auth/v1/callback` : "",
    OLD_STORAGE_BASE: oldBase,
  };
  const merged = { ...readEnvFile(secretsFile), ...values };
  fs.writeFileSync(
    secretsFile,
    ["# GERADO - SECRETO, ignorado pelo Git. Nao compartilhe.", ...Object.entries(merged).map(([k, v]) => `${k}=${v}`), ""].join("\n"),
    { mode: 0o600 },
  );

  console.log("\nPronto. Banco do Render migrado. Proximo passo: criar os servicos (infra/render/README.md).");
}

// ---------------------------------------------------------------- copy-files
async function copyFiles() {
  const publicApi = (argValue("--gateway") ?? config.PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  if (!publicApi) fail("preencha PUBLIC_API_URL (endereco do gateway no Render)");
  if (!TARGET) fail("preencha RENDER_DATABASE_URL");
  const oldBase = secrets.OLD_STORAGE_BASE ?? supabaseStorageBase(SOURCE);
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(publicApi, secrets.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const rows = sql(TARGET, "select bucket_id || E'\\t' || name || E'\\t' || coalesce(metadata->>'mimetype', '') from storage.objects order by created_at")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));

  console.log(`${rows.length} arquivos para copiar de ${oldBase}`);
  let copied = 0;
  let failed = 0;
  for (const [bucket, name, mimetype] of rows) {
    const response = await fetch(`${oldBase}/object/public/${bucket}/${name.split("/").map(encodeURIComponent).join("/")}`);
    if (!response.ok) {
      failed += 1;
      console.warn(`  falhou ao baixar ${bucket}/${name}: ${response.status}`);
      continue;
    }
    const body = Buffer.from(await response.arrayBuffer());
    const { error } = await admin.storage
      .from(bucket)
      .upload(name, body, { upsert: true, contentType: mimetype || response.headers.get("content-type") || undefined });
    if (error) {
      failed += 1;
      console.warn(`  falhou ao enviar ${bucket}/${name}: ${error.message}`);
    } else {
      copied += 1;
    }
  }
  console.log(`\nCopiados: ${copied} | falhas: ${failed}`);
}

if (command === "check") check();
else if (command === "migrate") migrate();
else if (command === "copy-files") await copyFiles();
else {
  console.log("Uso: node infra/render/setup-render-db.mjs <check|migrate|copy-files>");
  process.exit(1);
}
