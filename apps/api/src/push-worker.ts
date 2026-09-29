import pg from "pg";

import { DATABASE_URL, PUSH_INTERVAL_MS, PUSH_WORKER_ENABLED } from "./config/env.js";

// Envio de push (substitui o pg_net, que o Postgres do Render nao tem). A cada ciclo pega as
// notificacoes pendentes via claim_pending_pushes() (migration 056: marca como enviadas, respeita
// o silencio de adolescentes 21h-8h e monta o texto) e manda em lotes para a Expo Push API.

type PendingPush = { token: string; body: string; notification_id: string; type: string };

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH = 100;

async function sendToExpo(messages: PendingPush[]) {
  for (let index = 0; index < messages.length; index += BATCH) {
    const chunk = messages.slice(index, index + BATCH).map((message) => ({
      to: message.token,
      title: "Fluxo",
      body: message.body,
      sound: "default",
      data: { notification_id: message.notification_id, type: message.type },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(chunk),
    });

    if (!response.ok) {
      console.warn(`[push] Expo respondeu ${response.status}`);
    }
  }
}

export function startPushWorker() {
  if (!PUSH_WORKER_ENABLED || !DATABASE_URL) {
    console.log("[push] worker desligado (sem DATABASE_URL ou PUSH_WORKER_ENABLED=false)");
    return;
  }

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 2,
    ssl: DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : undefined,
  });
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { rows } = await pool.query<PendingPush>("select * from public.claim_pending_pushes(500)");
      if (rows.length) {
        await sendToExpo(rows);
        console.log(`[push] ${rows.length} enviados`);
      }
    } catch (error) {
      console.warn("[push] falha no ciclo:", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  setInterval(() => void tick(), PUSH_INTERVAL_MS);
  console.log(`[push] worker ligado (a cada ${PUSH_INTERVAL_MS} ms)`);
}
