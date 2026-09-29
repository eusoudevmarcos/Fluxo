# Fluxo no Render — backend completo (banco, login, API, arquivos, push)

A Fluxo usa a mesma pilha de código aberto do Supabase, agora rodando no **Render**, ligada ao
Postgres pago que já existe lá. Site e app continuam usando o cliente `supabase-js`: só trocam o
endereço e a chave.

```
celular / site ──► wave-gateway (web, público)
                     ├─ /auth/v1     ─► wave-auth    (GoTrue: login, cadastro, Google)
                     ├─ /rest/v1     ─► wave-rest    (PostgREST: tabelas e funções)
                     ├─ /storage/v1  ─► wave-storage (fotos e vídeos, disco persistente)
                     └─ push worker  ─► Expo Push API
                          todos ──► Postgres do Render (regras de segurança = RLS)
```

Diferenças para o Supabase, já tratadas no código:

- **Sem Realtime** (o Postgres do Render não liga replicação lógica sem o suporte): contador de
  notificações, chat privado e salas consultam a cada poucos segundos (`apps/*/src/lib/polling.ts`).
- **Sem `pg_net`**: o push sai do gateway (`apps/api/src/push-worker.ts` + migration 056).
- **Sem superusuário**: `service_role` não tem BYPASSRLS; `storage-service-role.sql` libera só o
  schema `storage` para o servidor de arquivos.

Tudo foi ensaiado localmente com as mesmas restrições (dono do banco sem superusuário):
`infra/render/local/` — migrations, migração de dados e 16 testes de ponta a ponta pelo gateway.

## Passo a passo

### 1. Preencher `infra/render/.env.migration` (arquivo local, ignorado pelo Git)

`RENDER_DATABASE_URL`, `SUPABASE_DATABASE_URL`, `PUBLIC_API_URL` (pode ser
`https://wave-gateway.onrender.com` agora e um domínio próprio depois), Google e SMTP.

### 2. Conferir as permissões (só leitura)

```bash
node infra/render/setup-render-db.mjs check
```

Precisa mostrar `pode criar papeis: true` ou `superusuario: true`.

### 3. Migrar o banco

```bash
node infra/render/setup-render-db.mjs migrate
```

Gera as chaves (`infra/render/.env.secrets`, secreto), prepara papéis e schemas, copia `public`,
`auth` e `storage` do Supabase, aplica as migrations 046–057, troca os endereços das mídias e grava
os valores que o Render vai pedir. **O Supabase não é alterado.**

### 4. Criar os serviços (Render Dashboard → New → Blueprint → este repositório)

O Render lê `render.yaml`, mostra o custo e pede os valores marcados como secretos. Copie de
`infra/render/.env.secrets`:

| Serviço | Variável | Valor em `.env.secrets` |
| --- | --- | --- |
| wave-gateway | `ANON_KEY` / `SERVICE_ROLE_KEY` | `ANON_KEY` / `SERVICE_ROLE_KEY` |
| wave-gateway | `DATABASE_URL` | `GATEWAY_DATABASE_URL` |
| wave-auth | `GOTRUE_DB_DATABASE_URL` | `AUTH_DB_URL` |
| wave-auth | `GOTRUE_JWT_SECRET` | `JWT_SECRET` |
| wave-auth | `API_EXTERNAL_URL` | `API_EXTERNAL_URL` |
| wave-auth | `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI` | `GOOGLE_REDIRECT_URI` |
| wave-auth | `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | do Google Cloud Console |
| wave-rest | `PGRST_DB_URI` | `REST_DB_URI` |
| wave-rest | `PGRST_JWT_SECRET` | `JWT_SECRET` |
| wave-storage | `DATABASE_URL` | `STORAGE_DB_URL` |
| wave-storage | `ANON_KEY` / `SERVICE_KEY` | `ANON_KEY` / `SERVICE_ROLE_KEY` |
| wave-storage | `AUTH_JWT_SECRET` / `PGRST_JWT_SECRET` | `JWT_SECRET` |

No Google Cloud Console, adicione `GOOGLE_REDIRECT_URI` às URIs de redirecionamento autorizadas.

### 5. Copiar as fotos e vídeos (com os serviços no ar)

```bash
node infra/render/setup-render-db.mjs copy-files
```

### 6. Apontar site e app para o Render

- **Vercel** (projeto `wave`): `NEXT_PUBLIC_SUPABASE_URL` = `PUBLIC_API_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `ANON_KEY` → redeploy.
- **App**: `apps/mobile/.env.local` e ambientes do EAS: `EXPO_PUBLIC_SUPABASE_URL` e
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` com os mesmos valores.

Todo mundo entra de novo uma vez (a chave de assinatura mudou); senhas continuam as mesmas.

### 7. Contas oficiais e teste

```sql
insert into public.official_accounts (user_id, kind, is_default_follow, is_founder, label)
select user_id, 'founder', true, true, 'Fundador' from public.profiles where username = 'SEU_USERNAME'
on conflict (user_id) do nothing;
```

Depois siga `docs/LANCAMENTO_BETA.md` (seção de teste no aparelho).

## Ensaio local

```bash
node infra/render/generate-keys.mjs --out infra/render/local/.env
docker compose -f infra/render/local/docker-compose.yml up -d
# bootstrap + migrations como no passo 3; depois o gateway e:
node infra/render/local/e2e.mjs
```
