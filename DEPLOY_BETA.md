# Ocean Beta - Deploy pelo GitHub + Vercel

## 1. Antes de subir para o GitHub

Confirmar localmente:

```bash
npm install
npm run typecheck -w apps/web
npm run lint
npm run build
```

Nunca subir arquivos reais de ambiente:

- `.env.local`
- `apps/web/.env.local`
- `.vercel`
- `.next`
- `node_modules`

O `.gitignore` ja protege esses arquivos.

## 2. Criar repositorio no GitHub

Criar um repositorio privado ou publico no GitHub, por exemplo:

```text
ocean-beta
```

Depois, na pasta raiz do projeto:

```bash
git init
git add .
git commit -m "Ocean beta release candidate"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/ocean-beta.git
git push -u origin main
```

Se usar GitHub Desktop:

1. File > Add local repository
2. Escolher a pasta raiz `fluxo`
3. Publicar no GitHub
4. Manter `.env.local` fora do commit

## 3. Configurar Vercel

Na Vercel:

1. Add New Project
2. Importar o repositorio do GitHub
3. Framework Preset: `Next.js`
4. Root Directory: `apps/web`
5. Install Command: manter automatico ou usar `npm install`
6. Build Command: `npm run build`
7. Output Directory: deixar automatico

A Vercel suporta monorepo com workspaces npm. O repo inteiro deve estar no GitHub para que `apps/web` consiga resolver os packages `@ocean/*`.

## 4. Variaveis de ambiente na Vercel

Adicionar em Project Settings > Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Nao adicionar `SUPABASE_SERVICE_ROLE_KEY` no projeto web.

## 5. Supabase Auth

Depois que a Vercel gerar a URL, configurar no Supabase:

Authentication > URL Configuration:

```text
Site URL:
https://SEU-DOMINIO.vercel.app
```

Redirect URLs:

```text
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
https://SEU-DOMINIO.vercel.app/auth/callback
```

Se usar dominio proprio, adicionar tambem:

```text
https://SEU-DOMINIO.com/auth/callback
```

## 6. Supabase Storage

Confirmar bucket:

```text
content-media
```

Configuracao esperada:

- bucket publico
- upload apenas autenticado
- path por `user_id`
- tipos permitidos para imagem/video
- limite conforme configurado no Supabase

## 7. SQL final antes do teste publico

Confirmar que as migrations ate `040` foram rodadas no Supabase.

As ultimas criticas para Privs e Salas:

- `037_privs_conversations.sql`
- `038_privs_messages.sql`
- `039_community_room_messages.sql`
- `040_community_room_presence.sql`

Se `037` e `038` ja tinham sido rodadas antes da correcao de RLS, rodar novamente a versao atual.

## 8. Smoke test apos deploy

Conta A:

- criar/login
- aceitar termos
- completar onboarding
- criar conteudo texto
- criar conteudo com midia
- entrar em comunidade
- entrar em sala
- enviar mensagem na sala
- iniciar Privs com Conta B

Conta B:

- criar/login
- aceitar termos
- completar onboarding
- responder Privs
- entrar na mesma comunidade/sala
- responder mensagem da sala
- interagir com conteudo da Conta A

Mobile real:

- Safari iPhone
- Chrome Android
- Home
- Criar
- Upload
- Privs
- Comunidades
- Salas
- Perfil
- Missoes/Auras/Selos

## 9. Pos-deploy

Monitorar:

- erros de build/deploy na Vercel
- erros de Auth callback
- RLS de Privs
- upload de midia
- responsividade mobile
- lentidao no feed
- mensagens duplicadas por realtime/refetch

