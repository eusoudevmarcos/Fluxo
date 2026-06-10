# Ocean

Monorepo da Ocean, uma rede social brasileira focada no agora acontecendo.

## Instalacao

```bash
npm install
```

## Rodar web

```bash
npm run dev
```

ou:

```bash
npm run dev:web
```

Acesse `http://localhost:3000`.

## Build web

```bash
npm run build
```

## Rodar mobile

```bash
npm run dev:mobile
```

O app mobile esta preparado com Expo para evolucao futura. Ele nao bloqueia o build web.

## Rodar API

```bash
npm run dev:api
```

Health check:

```text
http://localhost:4000/health
```

## Estrutura

- `apps/web`: app Next.js atual da Ocean.
- `apps/mobile`: scaffold Expo/React Native para o app mobile futuro.
- `apps/api`: backend Node TypeScript futuro, hoje com `/health`.
- `packages/shared`: tipos e constantes compartilhadas.
- `packages/design-tokens`: temas, cores e tipografia oficiais.
- `packages/database`: migrations SQL da Ocean.
- `packages/api-client`: camada futura de acesso a dados com client injetado.

## Ambientes

Use os arquivos `.env.example` como referencia. A chave `SUPABASE_SERVICE_ROLE_KEY` deve existir apenas em backend/server e nunca deve ser usada no web ou mobile.

Se voce ja tinha `.env.local` na raiz, copie os valores publicos do web para `apps/web/.env.local` quando for rodar o Next dentro do workspace.