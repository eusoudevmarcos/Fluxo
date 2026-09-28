-- Fluxo Coin fica ativa apenas para ganhar/acumular por enquanto (missoes, niveis). Presentear
-- entre usuarios (presente 1-para-1) fica desativado ate o Fluxo Stream existir, quando o gasto
-- de moeda vira doacao em lives (estilo TikTok) em vez de transferencia livre entre pessoas.
-- A funcao continua definida para ser reativada mais tarde.
revoke execute on function public.gift_user_coins(uuid, bigint, text) from authenticated;
