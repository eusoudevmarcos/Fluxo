// Ensaio da migracao: "create" cria uma conta de teste com senha conhecida no banco de ORIGEM;
// "login" confere, depois de migrar, que a mesma conta entra com a mesma senha e que o avatar
// enviado antes continua disponivel. Credenciais de teste ficam em infra/render/.work (ignorado).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.join(here, ".env"), "utf8").split("\n").filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);
const stateFile = path.join(here, "../.work/legacy-user.json");
const GATEWAY = "http://localhost:8787";
const client = () => createClient(GATEWAY, env.ANON_KEY, { auth: { persistSession: false } });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

if (process.argv[2] === "create") {
  const supabase = client();
  const email = `legacy-${Date.now()}@fluxo.test`;
  const password = `Legado-${Math.random().toString(36).slice(2)}!`;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  await supabase.from("profiles").insert({ user_id: data.user.id, username: `legado${Date.now().toString(36)}`, display_name: "Legado" });
  const upload = await supabase.storage.from("avatars").upload(`${data.user.id}/legado.png`, png, { contentType: "image/png" });
  if (upload.error) throw upload.error;
  fs.writeFileSync(stateFile, JSON.stringify({ email, password, userId: data.user.id }));
  console.log("conta de origem criada");
} else {
  const { email, password, userId } = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  console.log(`${!error && data.session ? "ok  " : "FAIL"} conta antiga entra com a mesma senha${error ? ` -> ${error.message}` : ""}`);
  const profile = await supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
  console.log(`${profile.data?.display_name === "Legado" ? "ok  " : "FAIL"} perfil antigo preservado`);
  const image = await fetch(supabase.storage.from("avatars").getPublicUrl(`${userId}/legado.png`).data.publicUrl);
  console.log(`${image.status === 200 ? "ok  " : "FAIL"} avatar antigo continua disponivel (${image.status})`);
}
