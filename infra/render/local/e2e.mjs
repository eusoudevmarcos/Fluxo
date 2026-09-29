// Ensaio de ponta a ponta da pilha do Render usando o MESMO cliente dos apps (supabase-js), tudo
// passando pelo gateway (apps/api). Contas de teste geradas na hora, so no banco local.
// Uso: node infra/render/local/e2e.mjs [URL do gateway] (padrao http://localhost:8787)
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(here, ".env"), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);

const GATEWAY = process.argv[2] ?? "http://localhost:8787";
const client = () =>
  createClient(GATEWAY, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
function check(condition, label, detail = "") {
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${!condition && detail ? ` -> ${detail}` : ""}`);
  if (!condition) failures += 1;
}

async function newUser(tag, birth) {
  const supabase = client();
  const email = `e2e-${tag}-${Date.now()}@fluxo.test`;
  const password = `Teste-${Math.random().toString(36).slice(2)}!`;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(`signUp ${tag}: ${error.message}`);
  const userId = data.user.id;
  const insert = await supabase.from("profiles").insert({
    user_id: userId, username: `${tag}${Date.now().toString(36)}`, display_name: tag, city: "Campinas", state: "SP",
  });
  if (insert.error) throw new Error(`profile ${tag}: ${insert.error.message}`);
  const band = await supabase.rpc("set_my_birth_date", { input_birth_date: birth });
  if (band.error) throw new Error(`birth ${tag}: ${band.error.message}`);
  const done = await supabase.from("profiles").update({ profile_required_completed: true }).eq("user_id", userId);
  if (done.error) throw new Error(`complete ${tag}: ${done.error.message}`);
  return { supabase, userId, email, password, band: band.data };
}

// 1. Gateway exige apikey
const noKey = await fetch(`${GATEWAY}/rest/v1/profiles?select=user_id`);
check(noKey.status === 401, "gateway recusa chamada sem apikey", String(noKey.status));

// 2. Cadastro, login e funcoes
const ana = await newUser("ana", "1995-03-10");
check(ana.band === "adult", "cadastro + data de nascimento via RPC", ana.band);

const relogin = client();
const signIn = await relogin.auth.signInWithPassword({ email: ana.email, password: ana.password });
check(!signIn.error && signIn.data.session?.access_token, "login com e-mail e senha", signIn.error?.message);

const privateCol = await ana.supabase.from("profiles").select("location_lat").limit(1);
check(Boolean(privateCol.error), "coluna privada bloqueada pela API", privateCol.error?.message);

const publicRead = await client().from("profiles").select("user_id,username").limit(5);
check(!publicRead.error && publicRead.data.length > 0, "perfis publicos legiveis sem login", publicRead.error?.message);

const missions = await ana.supabase.rpc("get_my_current_missions");
check(!missions.error && missions.data.length >= 8, `missoes sorteadas (${missions.data?.length})`, missions.error?.message);

// 3. Convite entre duas contas
const status = await ana.supabase.rpc("get_my_invite_status");
check(!status.error && status.data.code?.length === 8, "codigo de convite", status.error?.message);
const caio = await newUser("caio", "1998-07-07");
const redeem = await caio.supabase.rpc("redeem_invite", { invite_code: status.data.code });
check(!redeem.error && redeem.data.connected === true, "convite aceito conecta os dois", redeem.error?.message);

const notifications = await ana.supabase.from("notifications").select("type").eq("type", "invite_accepted");
check(!notifications.error && notifications.data.length === 1, "notificacao de convite aceito", notifications.error?.message);

// 4. Armazenamento: upload no bucket de avatares + leitura publica pelo gateway
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const objectPath = `${ana.userId}/e2e-avatar.png`;
const upload = await ana.supabase.storage.from("avatars").upload(objectPath, png, { contentType: "image/png", upsert: true });
check(!upload.error, "upload de avatar", upload.error?.message);
const publicUrl = ana.supabase.storage.from("avatars").getPublicUrl(objectPath).data.publicUrl;
const image = await fetch(publicUrl);
check(image.status === 200 && (image.headers.get("content-type") ?? "").includes("image"), `imagem publica servida (${publicUrl})`, String(image.status));

const foreign = await caio.supabase.storage.from("avatars").upload(`${ana.userId}/hack.png`, png, { contentType: "image/png" });
check(Boolean(foreign.error), "ninguem sobe arquivo na pasta de outra pessoa", "upload deveria falhar");

// 5. Post, wave e missao contada no servidor
const post = await caio.supabase.from("contents").insert({ author_id: caio.userId, text: "primeiro post", visibility: "public" }).select("id").single();
check(!post.error, "criar post", post.error?.message);
const wave = await ana.supabase.from("waves").insert({ user_id: ana.userId, content_id: post.data.id });
check(!wave.error, "dar wave", wave.error?.message);
const blocked = await ana.supabase.rpc("block_user", { target_user_id: caio.userId });
check(!blocked.error, "bloquear usuario", blocked.error?.message);
const hidden = await ana.supabase.from("contents").select("id").eq("id", post.data.id);
check(!hidden.error && hidden.data.length === 0, "post de bloqueado some para quem bloqueou", hidden.error?.message);

console.log(`\n${failures ? `${failures} FALHA(S)` : "ponta a ponta: tudo ok"}`);
process.exit(failures ? 1 : 0);
