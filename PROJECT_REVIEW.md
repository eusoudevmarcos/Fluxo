# Ocean - Revisao tecnica geral

Data: 2026-05-16

## Resumo do estado atual

A Ocean esta estruturada como monorepo com web, mobile futuro, API futura e pacotes compartilhados. O app web continua sendo a aplicacao principal, com Next.js App Router, TypeScript, CSS Modules, Supabase Auth, onboarding, perfil, temas e identidade visual oficial.

A revisao estabilizou pontos seguros sem criar funcionalidades novas e sem alterar o fluxo visual/produto principal.

## Estrutura atual

- `apps/web`: app Next.js principal.
- `apps/mobile`: scaffold Expo/React Native preparado para futuro.
- `apps/api`: servidor Node TypeScript com endpoint `/health`.
- `packages/shared`: constantes e tipos puros da Ocean.
- `packages/design-tokens`: temas e tipografia.
- `packages/database`: migrations SQL e documentacao de banco.
- `packages/api-client`: camada tipada preparada para receber clients injetados.

## Pontos revisados

- Arquitetura do monorepo e scripts raiz.
- Imports e aliases do web app.
- Separacao de telas publicas e internas.
- Auth standalone em dark mode.
- Onboarding standalone em dark mode.
- Perfil dentro do AppShell.
- Supabase no frontend usando apenas anon key.
- Ausencia de `SUPABASE_SERVICE_ROLE_KEY` em web/mobile/packages sensiveis.
- Tipografia, logo e nomenclaturas principais.
- CSS Modules e CSS global.
- Packages compartilhados sem dependencia de React.
- API `/health`.

## Problemas encontrados

- Existia um helper antigo de profile em `apps/web/src/lib/supabase/profiles.ts` com nomenclatura antiga, tipos conflitantes e schema desatualizado.
- `globals.css` ainda tinha classes globais antigas de uma landing page inicial, fora do padrao atual por CSS Modules.
- Havia textos com encoding quebrado e alguns termos antigos em componentes e paginas.
- `packages/shared/src/index.ts` tinha exports condensados em uma linha.
- `packages/design-tokens/src/typography.ts` ainda nao refletia a fonte oficial escolhida para a Ocean.
- `npm install` reportou 2 vulnerabilidades moderadas relacionadas a `postcss` via `next`. O `npm audit fix --force` sugeriu downgrade perigoso de Next, entao nao foi aplicado.

## Problemas corrigidos

- Removido helper antigo/desatualizado de profiles.
- Limpeza de CSS global antigo.
- Ajustes de textos quebrados em mobile, README, widgets, Date, PostCard e Perfil.
- Padronizacao das constantes oficiais em `packages/shared`.
- Ajuste da tipografia em `packages/design-tokens`.
- Confirmado que `/auth` e `/onboarding` nao usam AppShell.
- Confirmado que service role nao aparece em web/mobile/packages sensiveis.
- Confirmado que API responde em `/health`.

## Riscos pendentes

- `npm audit` ainda aponta 2 vulnerabilidades moderadas relacionadas a `postcss` via `next`. Nao foi aplicado fix automatico porque a sugestao era destrutiva para a versao atual do Next.
- As migrations foram renumeradas para evitar colisao de ordem. Ainda vale consolidar o historico antes de adotar Supabase CLI como fonte oficial.
- `apps/mobile` e um scaffold preparado, mas ainda nao e um app mobile completo. O root build nao depende dele.
- Alguns pacotes do web parecem sobrar de fases anteriores e podem ser auditados depois, sem pressa, para reduzir dependencias.
- Rotas legadas como `/swags` e rotas novas como `/flows` convivem por compatibilidade. Futuramente convem decidir uma nomenclatura final sem quebrar links existentes.

## TODOs importantes

- Consolidar migrations antes de uma esteira real de deploy do banco.
- Criar uma rotina segura para aplicar migrations via Supabase CLI quando o projeto estiver pronto.
- Auditar dependencias nao usadas em uma etapa separada.
- Evoluir mobile sem bloquear build web.
- Melhorar perfil e layout interno com base no novo visual oficial, em etapa visual separada.
- Conectar interesses do onboarding em tabela propria futuramente.

## Comandos

Instalar dependencias:

```bash
npm install
```

Rodar web:

```bash
npm run dev
# ou
npm run dev:web
```

Build web:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Typecheck:

```bash
npm run typecheck
```

Rodar API:

```bash
npm run dev:api
```

Testar API:

```bash
curl http://localhost:4000/health
```

Rodar mobile:

```bash
npm run dev:mobile
```

## Seguranca e Supabase

- Web e mobile devem usar somente chaves anon/publicas.
- `SUPABASE_SERVICE_ROLE_KEY` deve ficar restrita ao backend, scripts locais administrativos ou `.env.example`.
- Nao foi encontrado uso de service role em `apps/web`, `apps/mobile`, `packages/api-client`, `packages/shared`, `packages/design-tokens` ou `packages/database`.
- Migrations de profiles e onboarding estao presentes em `packages/database/migrations`.
- RLS/policies de profiles devem continuar sendo mantidas no SQL, nao no frontend.

## Auth, onboarding e perfil

- `/auth` permanece uma rota publica standalone, dark mode fixo, sem AppShell, sidebar, rightbar ou MobileNav.
- `/onboarding` permanece standalone, dark mode fixo, sem AppShell, sidebar, rightbar ou MobileNav.
- `/perfil` permanece rota interna visualmente dentro do AppShell.
- Flow ID deve ser salvo sem `~` no banco e exibido com `~` na interface.
- Avatar do onboarding/perfil deve permanecer quadrado com bordas arredondadas, nao circular.

## Validacoes executadas

- `npm install`: concluido, com 2 vulnerabilidades moderadas reportadas pelo npm audit.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npm run build:api`: passou.
- `npm run dev:api` + `GET /health`: passou com `{"ok":true,"app":"Ocean","service":"api"}`.

## Proximos passos recomendados

1. Ajustar visual de perfil e layout interno conforme os mockups oficiais, em etapa propria.
2. Consolidar migrations duplicadas antes de ativar fluxo Supabase CLI.
3. Fazer auditoria de dependencias e vulnerabilidades quando houver uma versao segura de patch do Next/postcss.
4. Avancar o mobile mantendo shared/design-tokens como base.
5. Padronizar de vez as rotas publicas entre nomes novos e legados, mantendo redirects quando necessario.
