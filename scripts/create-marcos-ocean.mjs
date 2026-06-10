import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path) {
  const env = {};
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const webEnv = readEnvFile("apps/web/.env.local");
const email = process.env.OCEAN_TEST_EMAIL?.trim().toLowerCase();
const password = process.env.OCEAN_TEST_PASSWORD;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const displayName = "Marcos Ocean";
const username = "marcos";

if (!webEnv.NEXT_PUBLIC_SUPABASE_URL || !webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local");
}

if (!email || !password) {
  throw new Error("Set OCEAN_TEST_EMAIL and OCEAN_TEST_PASSWORD before running this script.");
}

const publicClient = createClient(webEnv.NEXT_PUBLIC_SUPABASE_URL, webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsertProfile(client, userId) {
  const existing = await client
    .from("profiles")
    .select("id,user_id,username,display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const payload = {
    username,
    display_name: displayName,
    bio: "",
    theme: "sunflow",
    aura: "starter",
    updated_at: new Date().toISOString(),
  };

  const result = existing.data
    ? await client.from("profiles").update(payload).eq("user_id", userId).select("id,user_id,username,display_name,bio,theme,aura").single()
    : await client.from("profiles").insert({ user_id: userId, ...payload }).select("id,user_id,username,display_name,bio,theme,aura").single();

  if (result.error) throw result.error;
  return result.data;
}

async function runWithAdmin() {
  const admin = createClient(webEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;

  const existingUser = listed.data.users.find((user) => user.email?.toLowerCase() === email);

  const userResult = existingUser
    ? await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { name: displayName, full_name: displayName },
      })
    : await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: displayName, full_name: displayName },
      });

  if (userResult.error) throw userResult.error;

  const profile = await upsertProfile(admin, userResult.data.user.id);
  return { ok: true, mode: existingUser ? "admin_update" : "admin_create", userId: userResult.data.user.id, profile };
}

async function runWithPublicAuth() {
  let mode = "signin";
  let { data: authData, error: authError } = await publicClient.auth.signInWithPassword({ email, password });

  if (authError) {
    mode = "signup";
    const signUp = await publicClient.auth.signUp({
      email,
      password,
      options: { data: { name: displayName, full_name: displayName } },
    });
    authData = signUp.data;
    authError = signUp.error;
  }

  if (authError) throw authError;

  if (!authData.session?.user?.id) {
    return {
      ok: true,
      mode,
      profileUpdated: false,
      emailConfirmationRequired: true,
      message: "Supabase accepted signup but did not return a session. Confirm the email or run with SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const profile = await upsertProfile(publicClient, authData.session.user.id);
  return { ok: true, mode, userId: authData.session.user.id, profile };
}

try {
  const result = serviceRoleKey ? await runWithAdmin() : await runWithPublicAuth();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
}