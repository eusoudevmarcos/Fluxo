import type { SupabaseClient } from "@supabase/supabase-js";

export type PollingSubscription = { unsubscribe: () => void };

// Substitui o Realtime do Supabase, que nao roda no Render (o Postgres de la nao tem replicacao
// logica ligada): consulta a tabela a cada intervalo e chama o callback quando aparece uma linha
// mais nova que a ultima vista. A primeira consulta so marca a referencia.
export function pollForNewRows(
  supabase: SupabaseClient,
  table: string,
  filterColumn: string,
  filterValue: string,
  callback: () => void,
  intervalMs = 3000,
): PollingSubscription {
  let lastSeen: string | null | undefined;
  let stopped = false;
  let busy = false;

  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const { data, error } = await supabase
        .from(table)
        .select("created_at")
        .eq(filterColumn, filterValue)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || stopped) return;

      const newest = ((data ?? [])[0] as { created_at?: string } | undefined)?.created_at ?? null;
      if (lastSeen !== undefined && newest && newest !== lastSeen) callback();
      lastSeen = newest;
    } finally {
      busy = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return {
    unsubscribe() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
