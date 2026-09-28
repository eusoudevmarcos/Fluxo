// Teste de ponta a ponta do banco: aplica TODAS as migrations num Postgres real embutido
// (PGlite/WASM), com o minimo do Supabase simulado (auth.users, auth.uid(), papeis anon/
// authenticated, storage, pg_net), e percorre os fluxos do beta: idade, privacidade de colunas,
// convites, sorteio de missoes, anti-farm, sugestoes, bloqueio, denuncia, admin, push.
//
// Rodar: npm run test:db   (na raiz do monorepo)
// Rode antes de aplicar migrations novas no Supabase.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
// Bloco antigo 013-017 e alternativo ao 021-025 (nota do projeto); 019 nao existe.
const SKIP = new Set(["013", "014", "015", "016", "017"]);

const db = new PGlite();

// ---------- Stubs do Supabase ----------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    created_at timestamptz not null default now(),
    raw_user_meta_data jsonb default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text,
    name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/')
  $$;
  create schema extensions;
  create schema net;
  create table net.sent (id serial primary key, url text, body jsonb, created_at timestamptz default now());
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint
  language plpgsql security definer as $$
  begin insert into net.sent (url, body) values (url, body); return 1; end $$;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);

// ---------- Migrations ----------
const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
let failed = false;
for (const file of files) {
  if (SKIP.has(file.slice(0, 3))) continue;
  let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8").replace(/﻿/g, "");
  // extensoes que o PGlite nao tem (no Supabase existem)
  sql = sql.replace(/create extension if not exists pg_net with schema extensions;/g, "");
  sql = sql.replace(/create extension if not exists pgcrypto;/g, "");
  try {
    await db.exec(sql);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${file}: ${error.message}`);
    break;
  }
}
if (failed) process.exit(1);
console.log(`OK migrations aplicadas (${files.length - SKIP.size})`);

// ---------- Helpers ----------
async function as(userId, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
let checks = 0;
function expect(cond, label) {
  checks += 1;
  if (!cond) {
    console.log(`FAIL check: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`ok   ${label}`);
  }
}
async function expectError(promise, pattern, label) {
  try {
    await promise;
    expect(false, `${label} (esperava erro)`);
  } catch (error) {
    expect(pattern.test(error.message), `${label} -> "${error.message}"`);
  }
}

async function newUser(username, birth, { oldAccount = false } = {}) {
  const { id } = await one(
    `insert into auth.users (email, created_at) values ($1, $2) returning id`,
    [`${username}@t.dev`, oldAccount ? new Date(Date.now() - 30 * 864e5) : new Date()],
  );
  await as(id, () =>
    q(`insert into public.profiles (user_id, username, display_name, city, state, country)
       values ($1, $2, $2, 'Campinas', 'SP', 'BR')`, [id, username]),
  );
  let band = null;
  if (birth) {
    band = (await as(id, () => one(`select public.set_my_birth_date($1::date) as band`, [birth]))).band;
    if (band !== "blocked") {
      await as(id, () => q(`update public.profiles set profile_required_completed = true where user_id = $1`, [id]));
    }
  }
  return { id, band };
}

// ---------- Fluxos ----------
// Idade
const ana = await newUser("ana", "1995-03-10");
expect(ana.band === "adult", "set_my_birth_date adulto -> adult");
const bia = await newUser("bia", "2011-06-01");
expect(bia.band === "teen_14", "14-15 anos -> teen_14");
const kid = await newUser("kid", "2015-01-01");
expect(kid.band === "blocked", "menor de 14 -> blocked");
await expectError(
  as(kid.id, () => q(`update public.profiles set profile_required_completed = true where user_id = $1`, [kid.id])),
  /data de nascimento/,
  "perfil de bloqueado nao conclui cadastro",
);
await expectError(
  as(ana.id, () => q(`select public.set_my_birth_date('1990-01-01')`)),
  /já foi registrada/,
  "data de nascimento so uma vez",
);

// Privacidade de colunas
await expectError(
  as(bia.id, () => q(`select location_lat from public.profiles limit 1`)),
  /permission denied/,
  "location_lat nao e legivel pelo client",
);
await expectError(
  as(bia.id, () => q(`select * from public.profiles limit 1`)),
  /permission denied/,
  "select * em profiles bloqueado",
);
const pub = await as(bia.id, () => q(`select user_id, username, city from public.profiles`));
expect(pub.length >= 3, "colunas publicas de profiles continuam legiveis");
const priv = await as(ana.id, () => one(`select * from public.get_my_private_profile()`));
expect(priv.age_band === "adult", "get_my_private_profile devolve faixa etaria");

// Convites
const status = await as(ana.id, () => one(`select public.get_my_invite_status() as s`));
expect(status.s.code?.length === 8 && status.s.slots_available === 5, "codigo de convite + 5 convites");
const preview = await as(null, () => one(`select public.get_invite_preview($1) as p`, [status.s.code]));
expect(preview.p.username === "ana", "preview publico do convite");
const caio = await newUser("caio", "1998-07-07");
const redeem = await as(caio.id, () => one(`select public.redeem_invite($1) as r`, [status.s.code]));
expect(redeem.r.connected === true, "convite aceito conecta adulto-adulto");
const mutual = await q(
  `select count(*)::int as n from public.user_relationships
   where (follower_id = $1 and following_id = $2) or (follower_id = $2 and following_id = $1)`,
  [ana.id, caio.id],
);
expect(mutual[0].n === 2, "seguir mutuo apos convite");
const redeemTeen = await as(bia.id, () => one(`select public.redeem_invite($1) as r`, [status.s.code]));
expect(redeemTeen.r.connected === false, "adulto x 14-15 nao conecta automaticamente");
await expectError(
  as(caio.id, () => q(`select public.redeem_invite($1)`, [status.s.code])),
  /já entrou/,
  "convite nao pode ser usado duas vezes",
);
const old = await newUser("old", "1990-01-01", { oldAccount: true });
await expectError(
  as(old.id, () => q(`select public.redeem_invite($1)`, [status.s.code])),
  /contas novas/,
  "conta antiga nao resgata convite",
);
const invNotif = await q(`select count(*)::int as n from public.notifications where recipient_id = $1 and type = 'invite_accepted'`, [ana.id]);
expect(invNotif[0].n === 2, "notificacao de convite aceito");

// Missoes
const missions = await as(ana.id, () => q(`select cadence, in_rotation from public.get_my_current_missions()`));
const daily = missions.filter((m) => m.cadence === "daily" && m.in_rotation).length;
const weekly = missions.filter((m) => m.cadence === "weekly" && m.in_rotation).length;
expect(daily === 3 && weekly === 5, `sorteio 3 diarias + 5 semanais (veio ${daily}/${weekly})`);
const again = await as(ana.id, () => q(`select id from public.get_my_current_missions()`));
expect(again.length === missions.length, "sorteio estavel ao reabrir");
const catalogCount = await one(`select count(*)::int as n from public.mission_definitions where metadata->>'catalog' = 'launch_v1'`);
expect(catalogCount.n === 210, "catalogo com 210 missoes");
await expectError(
  as(ana.id, () => q(`select public.increment_mission_progress($1, 'daily_create_flow', 1, '{}')`, [ana.id])),
  /permission denied/,
  "client nao incrementa missao direto",
);

// Acoes reais -> eventos
const post = await as(caio.id, () =>
  one(`insert into public.contents (author_id, text, visibility) values ($1, 'oi @ana tudo bem?', 'public') returning id`, [caio.id]),
);
await as(ana.id, () => q(`insert into public.waves (user_id, content_id) values ($1, $2)`, [ana.id, post.id]));
await as(ana.id, () => q(`delete from public.waves where user_id = $1 and content_id = $2`, [ana.id, post.id]));
await as(ana.id, () => q(`insert into public.waves (user_id, content_id) values ($1, $2)`, [ana.id, post.id]));
const waveEvents = await q(`select count(*)::int as n from public.mission_event_log where user_id = $1 and event_type = 'create_wave'`, [ana.id]);
expect(waveEvents[0].n === 1, "curtir/descurtir o mesmo post conta uma vez");
await as(ana.id, () => q(`insert into public.comments (content_id, author_id, text) values ($1, $2, 'ok')`, [post.id, ana.id]));
const shortComment = await q(`select count(*)::int as n from public.mission_event_log where user_id = $1 and event_type = 'create_comment'`, [ana.id]);
expect(shortComment[0].n === 0, "comentario curto nao conta");
await as(ana.id, () => q(`insert into public.comments (content_id, author_id, text) values ($1, $2, 'que post bom demais')`, [post.id, ana.id]));
const received = await q(`select count(*)::int as n from public.mission_event_log where user_id = $1 and event_type in ('receive_waves','receive_comments','mention_people')`, [caio.id]);
expect(received[0].n >= 2, "autor recebe eventos de wave/comentario/mencao");

// Sugestoes, busca, proximidade
const dani = await newUser("dani", "1993-02-02");
await db.query(`update public.profiles set location_lat = -22.9, location_lng = -47.06 where user_id in ($1, $2)`, [ana.id, dani.id]);
await as(ana.id, () => q(`select public.set_nearby_visibility(true)`));
await as(dani.id, () => q(`select public.set_nearby_visibility(true)`));
await expectError(
  as(bia.id, () => q(`select public.set_nearby_visibility(true)`)),
  /maiores de 18/,
  "adolescente nao ativa pessoas proximas",
);
const sugg = await as(ana.id, () => q(`select username, reason, reason_detail from public.get_follow_suggestions(20)`));
expect(sugg.some((s) => s.username === "dani" && s.reason === "nearby"), `sugestao por proximidade (${JSON.stringify(sugg)})`);
expect(!sugg.some((s) => s.username === "bia"), "14-15 nao aparece nas sugestoes");
const searchAdult = await as(caio.id, () => q(`select username from public.search_profiles('bi', 20)`));
expect(!searchAdult.some((s) => s.username === "bia"), "adulto nao encontra adolescente na busca");

// Bloqueio e denuncia
await as(ana.id, () => q(`select public.block_user($1)`, [caio.id]));
const visibleToAna = await as(ana.id, () => q(`select id from public.contents where id = $1`, [post.id]));
expect(visibleToAna.length === 0, "post de quem bloqueei some");
await expectError(
  as(caio.id, () => q(`insert into public.user_relationships (follower_id, following_id) values ($1, $2)`, [caio.id, ana.id])),
  /Não é possível seguir/,
  "bloqueado nao consegue seguir",
);
const reporters = [];
for (const name of ["r1", "r2", "r3", "r4", "r5"]) reporters.push(await newUser(name, "1990-05-05"));
for (const reporter of reporters) {
  await as(reporter.id, () => q(`select public.submit_report('content', $1, 'spam', null)`, [post.id]));
}
const hidden = await one(`select visibility from public.contents where id = $1`, [post.id]);
expect(hidden.visibility === "removed", "5 denuncias ocultam o post");

// Admin
await db.query(`insert into public.official_accounts (user_id, kind, is_founder) values ($1, 'founder', true)`, [ana.id]);
const queue = await as(ana.id, () => q(`select * from public.list_open_reports()`));
expect(queue.length === 1 && queue[0].report_count === 5, "fila de moderacao agrupa denuncias");
await as(ana.id, () => q(`select public.resolve_reports('content', $1, 'dismiss')`, [post.id]));
const restored = await one(`select visibility from public.contents where id = $1`, [post.id]);
expect(restored.visibility === "public", "arquivar denuncias restaura o post");
const metrics = await as(ana.id, () => one(`select public.get_growth_metrics() as m`));
expect(metrics.m.invites.accepted_total === 2, "metricas de convites");
await expectError(
  as(caio.id, () => q(`select public.get_growth_metrics()`)),
  /restrito/,
  "metricas so para contas oficiais",
);

// Criadores + tema exclusivo
await as(dani.id, () => q(`select public.submit_creator_application('instagram', '@dani', 'javascript:alert(1)', 5000, 'humor', null)`));
const app = await one(`select profile_url, verification_code from public.creator_applications where user_id = $1`, [dani.id]);
expect(app.profile_url === null && /^FLUXO-/.test(app.verification_code), "link nao-http descartado + codigo de verificacao");
await expectError(
  as(dani.id, () => q(`update public.profiles set theme = 'prime-gold' where user_id = $1`, [dani.id])),
  /exclusivo/,
  "tema exclusivo bloqueado sem desbloqueio",
);

// Feedback + push
await as(bia.id, () => q(`insert into public.app_feedback (user_id, kind, message) values ($1, 'bug', 'travou')`, [bia.id]));
await as(dani.id, () => q(`select public.register_push_token('ExponentPushToken[abc123]', 'android')`));
await as(ana.id, () => q(`delete from public.user_blocks where blocker_id = $1`, [ana.id]));
await as(ana.id, () => q(`insert into public.user_relationships (follower_id, following_id) values ($1, $2)`, [ana.id, dani.id]));
const pushes = await q(`select body from net.sent`);
expect(pushes.length >= 1 && JSON.stringify(pushes.at(-1).body).includes("ExponentPushToken[abc123]"), "push enviado ao seguir");

// Recompensa para quem RECEBE a acao (autor), disparada por outra pessoa
await db.query(`insert into public.mission_definitions
  (slug, title, mission_type, cadence, target_value, xp_reward, coin_reward, in_rotation)
  values ('test_receive', 'Teste', 'receive_waves', 'daily', 1, 100, 7, false)`);
const oldPost = await as(old.id, () =>
  one(`insert into public.contents (author_id, text, visibility) values ($1, 'post do old', 'public') returning id`, [old.id]),
);
await as(dani.id, () => q(`insert into public.waves (user_id, content_id) values ($1, $2)`, [dani.id, oldPost.id]));
const oldXp = await one(`select xp_total from public.user_gamification where user_id = $1`, [old.id]);
const oldCoins = await one(`select balance from public.user_coin_wallets where user_id = $1`, [old.id]);
expect(Number(oldXp?.xp_total) >= 100 && Number(oldCoins?.balance) >= 7, "autor recebe XP e moedas pela wave de outra pessoa");
await expectError(
  as(dani.id, () => q(`select public.ensure_user_gamification($1)`, [old.id])),
  /another user/,
  "client nao le gamificacao de outra pessoa",
);
const slots = await as(old.id, () => one(`select public.get_my_invite_status() as s`));
expect(slots.s.slots_total === 5, "missao diaria nao da convite extra");

console.log(`\n${checks} checagens; ${process.exitCode ? "COM FALHAS" : "tudo ok"}`);
