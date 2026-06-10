# Ocean - Beta Release Candidate Checklist

Use este arquivo antes de liberar a beta publica. Ele cobre ambiente, banco, Storage, fluxos criticos e testes manuais.

## Comandos

```bash
npm install
npm run dev:web
npm run lint
npm run build
npm run dev:api
```

## Variaveis de ambiente

Root `.env.example` documenta todos os ambientes. Para deploy web, configurar somente:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Para `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Para API futura em `apps/api/.env`:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
API_PORT=4000
```

Regras:
- `SUPABASE_SERVICE_ROLE_KEY` nunca entra em `apps/web` ou `apps/mobile`.
- Web e mobile usam apenas anon/public keys.
- Conferir as redirect URLs do Google OAuth no Supabase antes do deploy.
- Conferir `Site URL` no Supabase com o dominio final.

## Supabase Auth e Google OAuth

Configurar no Supabase antes do deploy:
- `Site URL`: dominio final da beta
- Redirect URL local: `http://localhost:3000/auth/callback`
- Redirect URL de producao: `https://SEU-DOMINIO/auth/callback`
- Google provider habilitado
- Google OAuth Client ID e Client Secret configurados no Supabase
- Dominio final autorizado no Google Cloud Console
- Email/senha habilitado se a beta usar cadastro por email

## Migrations SQL

Rodar no Supabase SQL Editor, nesta ordem:

1. `packages/database/migrations/001_profiles.sql`
2. `packages/database/migrations/002_add_onboarding_completed_to_profiles.sql`
3. `packages/database/migrations/003_contents.sql`
4. `packages/database/migrations/004_dahoras.sql`
5. `packages/database/migrations/005_comments.sql`
6. `packages/database/migrations/006_waves.sql`
7. `packages/database/migrations/007_saved_contents.sql`
8. `packages/database/migrations/008_presences.sql`
9. `packages/database/migrations/009_profile_onboarding_details.sql`
10. `packages/database/migrations/010_avatar_storage.sql`
11. `packages/database/migrations/011_storage_content_media.sql`
12. `packages/database/migrations/012_add_comments_enabled_to_contents.sql`
13. `packages/database/migrations/013_communities.sql`
14. `packages/database/migrations/014_community_rooms.sql`
15. `packages/database/migrations/015_community_members.sql`
16. `packages/database/migrations/016_add_community_id_to_contents.sql`
17. `packages/database/migrations/017_seed_native_communities.sql`
18. `packages/database/migrations/018_legal_acceptances.sql`
19. `packages/database/migrations/020_profile_required_onboarding.sql`
20. `packages/database/migrations/021_communities.sql`
21. `packages/database/migrations/022_community_rooms.sql`
22. `packages/database/migrations/023_community_members.sql`
23. `packages/database/migrations/024_add_community_id_to_contents.sql`
24. `packages/database/migrations/025_seed_native_communities.sql`
25. `packages/database/migrations/026_gamification_core.sql`
26. `packages/database/migrations/027_aura_definitions.sql`
27. `packages/database/migrations/028_user_auras.sql`
28. `packages/database/migrations/029_missions.sql`
29. `packages/database/migrations/030_user_mission_progress.sql`
30. `packages/database/migrations/031_aura_drops.sql`
31. `packages/database/migrations/032_sticker_packs.sql`
32. `packages/database/migrations/033_official_profile_defaults.sql`
33. `packages/database/migrations/034_badge_definitions.sql`
34. `packages/database/migrations/035_user_badges.sql`
35. `packages/database/migrations/036_badge_eligibility.sql`
36. `packages/database/migrations/037_privs_conversations.sql`
37. `packages/database/migrations/038_privs_messages.sql`
38. `packages/database/migrations/039_community_room_messages.sql`
39. `packages/database/migrations/040_community_room_presence.sql`

Observacoes:
- A numeracao pula `019` por historico de sprint. Isso nao bloqueia deploy.
- Algumas migrations usam `drop policy if exists` antes de recriar policies para evitar erro de policy duplicada.
- Em banco novo, rode todas na ordem acima.
- Em banco que ja recebeu migrations antigas de Comunidades `013` a `017`, rode tambem `021` a `025` para alinhar comunidades locais e seeds finais.
- As migrations `026` a `033` ativam gamificacao, Auras, Missoes, Drops, Stickers e Perfil Oficial/Fundador.
- As migrations `034` a `036` ativam Selos, selo equipado e elegibilidade de verificacao.
- As migrations `037` a `038` ativam o Privs MVP real basico.
- As migrations `039` a `040` ativam chat basico e presenca simples nas salas de comunidades.

## Supabase Storage

Migration principal:

```text
packages/database/migrations/011_storage_content_media.sql
```

Configuracao esperada:
- bucket `content-media`
- leitura publica
- upload autenticado
- update/delete apenas na pasta do proprio usuario
- path usado pelo app: `{user_id}/{timestamp}-{safeFileName}`
- tipos permitidos: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `video/quicktime`
- limite do bucket: 100MB
- limite no app: imagem ate 10MB, video ate 100MB

Testes:
- criar conteudo com foto valida
- criar conteudo com video valido
- tentar arquivo invalido e confirmar erro amigavel
- tentar imagem maior que 10MB e confirmar bloqueio
- tentar video maior que 100MB e confirmar bloqueio
- confirmar que a URL publica abre apos recarregar o feed

## Rotas criticas

Validar:
- `/`
- `/auth?mode=login`
- `/auth?mode=signup`
- `/onboarding`
- `/perfil`
- `/feed`
- `/momentos`
- `/moments`
- `/swags`
- `/flows`
- `/notificacoes`
- `/privs`
- `/mais`
- `/missoes`
- `/auras`
- `/u/[username]`
- `/comunidades`
- `/comunidades/[slug]`
- `/legal`
- `/legal/termos`
- `/legal/privacidade`
- `/legal/diretrizes`
- `/legal/conteudo-imagem`
- `/legal/accept`

## Auth e onboarding

Testes:
- abrir `/legal` e todos os documentos legais
- criar conta por email/senha
- tentar criar conta por email/senha sem aceitar documentos e confirmar bloqueio
- criar conta por email/senha aceitando documentos
- confirmar email, se email confirmation estiver ativo
- login email/senha
- login Google
- usuario Google sem aceite atual vai para `/legal/accept`
- aceitar documentos em `/legal/accept`
- confirmar registro em `public.legal_acceptances`
- confirmar que usuario sem aceite atual nao entra em `/`, `/feed`, `/perfil` ou `/onboarding`
- usuario novo vai para `/onboarding`
- onboarding exige Nome, Flow ID, Estado, Cidade, etapa GPS, Sexo biologico, Foto opcional e Sobre seu flow
- tentar concluir sem Flow ID e confirmar bloqueio
- tentar concluir sem Estado/Cidade e confirmar bloqueio
- passar pela etapa GPS permitindo localizacao
- confirmar `location_lat`, `location_lng`, `location_accuracy_meters` privados no Supabase
- repetir com GPS negado e confirmar `geolocation_permission = denied`
- confirmar que GPS negado nao bloqueia conclusao se Cidade/Estado foram preenchidos
- selecionar Sexo biologico ou `Prefiro nao informar`
- confirmar `profile_required_completed = true`
- confirmar que sexo biologico e coordenadas nao aparecem em `/perfil` nem `/u/[username]`
- usuario com `onboarding_completed = true` e `profile_required_completed = true` segue para `/perfil`
- usuario antigo com `onboarding_completed = true` mas `profile_required_completed = false` volta para `/onboarding`
- usuario sem sessao nao acessa `/perfil`
- `/auth` nao usa AppShell
- `/onboarding` nao usa AppShell

## Legal

Versao atual:
- Termos de Uso: `2026-05-beta-1`
- Politica de Privacidade: `2026-05-beta-1`
- Diretrizes da Comunidade: `2026-05-beta-1`
- Termo de Conteudo, Imagem e Voz: `2026-05-beta-1`

Testes:
- abrir `/legal`
- abrir `/legal/termos`
- abrir `/legal/privacidade`
- abrir `/legal/diretrizes`
- abrir `/legal/conteudo-imagem`
- abrir `/legal/accept` sem sessao e confirmar redirect para auth
- fazer login Google com usuario sem aceite atual e confirmar redirect para `/legal/accept`
- marcar os checkboxes obrigatorios
- clicar `Aceitar e continuar`
- confirmar insert em `legal_acceptances`
- confirmar update em `profiles.legal_terms_accepted`
- confirmar redirect para `/onboarding` ou `/perfil`

## Mobile oficial

Home mobile:
- topo com logo Ocean, notificacoes, Privs e avatar
- corpo com tabs `Flow / Moments / Discover`
- bottom nav: `Inicio / + / Privs / Perfil`
- Discover nao fica na bottom nav
- Ao vivo nao fica na bottom nav
- Moments nao fica na bottom nav

Privs mobile:
- abre lista de conversas em tela cheia
- abre conversa em tela cheia
- botao voltar retorna para lista
- chat real fica para depois da beta

Criacao mobile:
- botao `+` abre sheet `Criar`
- opcoes `Criacao / Flow / Moments`
- acoes `Camera / Foto / Video / Texto rapido`
- sem URL como fluxo principal

## Criacao e midia

Testes:
- criar conteudo somente texto
- criar conteudo com foto
- criar conteudo com video
- criar Flow pelo mobile
- remover midia antes de criar
- cancelar criacao com confirmacao
- testar arquivo invalido
- testar imagem maior que 10MB
- testar video maior que 100MB
- recarregar feed e confirmar persistencia

## Interacoes sociais

Testes:
- Dahora liga/desliga e persiste
- Wave liga/desliga e persiste
- Salvos/Favoritos liga/desliga e fica privado
- Presenca registra uma vez por usuario/conteudo
- comentarios abrem/fecham
- criar comentario
- apagar comentario proprio
- autor da criacao apaga comentario da propria criacao
- bloquear e liberar comentarios

## Comunidades

Migrations principais para a beta:
- `021_communities.sql`
- `022_community_rooms.sql`
- `023_community_members.sql`
- `024_add_community_id_to_contents.sql`
- `025_seed_native_communities.sql`

Observacao:
- `013` a `017` foram a primeira versao do MVP. Em banco novo, rode a lista completa acima em ordem; em banco que ja recebeu `013` a `017`, rode tambem `021` a `025`, pois elas sao idempotentes e alinham a versao oficial com comunidades locais.

Comunidades nativas esperadas:
- Eu odeio acordar cedo
- Teorias da conspiração
- Música
- Games
- Filmes e séries
- Relacionamentos
- Tecnologia
- Humor
- Esportes
- Arte e criação

Testes:
- abrir `/comunidades`
- ver cards de comunidades oficiais
- filtrar por categoria
- filtrar por `Da minha cidade`
- criar comunidade com usuario logado
- criar comunidade local usando cidade/estado do profile
- abrir `/comunidades/eu-odeio-acordar-cedo`
- entrar na comunidade
- sair da comunidade
- criar uma Criacao dentro da comunidade
- ver a Criacao na aba `Criacoes`
- abrir aba `Salas`
- confirmar salas `Sala 1` a `Sala 5` com capacidade `0/200` ou similar
- clicar em `Entrar na sala` e abrir chat basico de texto
- abrir aba `Regras`
- confirmar que feed geral continua funcionando
- confirmar Dahora, Wave, Presenca, Salvos e Comentarios em criacoes da comunidade
- testar com duas contas: Conta B nao deve conseguir remover membership nem editar/apagar criacoes da Conta A

Comunidades ainda mockadas/parciais:
- chat das salas e basico, texto apenas, com realtime/fallback
- ocupacao realtime das salas
- criacao automatica de salas extras quando todas lotarem
- moderacao real de comunidade/sala/criacao
- denuncia real com banco e painel admin
- regras futuras de idade e verificacao: menores de 16 anos nao entram em bate-papos de comunidades, criacao/entrada em comunidades restritas exige verificacao reforcada, e Date fica condicionado a idade minima e verificacao de identidade antes de qualquer liberacao real

## Ecossistema Ocean

Testes:
- abrir `/mais`
- confirmar a seção `O Ecossistema Ocean`
- confirmar cards: Ocean Date, Ocean Shop, Ocean Stream, Ocean Academy, Creator Economy, Aura & Gamificação e Ocean Coin
- confirmar a seção `O que torna a Ocean diferente`
- confirmar cards: Presença Viva, WaveMap, Maré do Feed, Perfil Vivo e Aura Dinâmica
- confirmar que todos os recursos futuros aparecem como `Em breve`, `Preparando`, `Em evolução` ou `Visão futura`
- confirmar que Ocean Coin não é apresentada como moeda ativa, investimento, token disponível ou renda garantida
- confirmar layout limpo no mobile
- confirmar build passando

## Controles de seguranca

Testes:
- apagar propria criacao
- usuario nao autor nao ve `Apagar criacao`
- usuario nao autor ve apenas acoes TODO de denuncia/preferencia
- copiar link nao quebra a UI
- RLS impede alteracao de dados de outro usuario

## Teste com duas contas

Conta A:
- cria conteudo
- da Dahora
- comenta
- salva
- da Wave
- bloqueia comentarios
- apaga propria criacao

Conta B:
- ve conteudo da Conta A
- da Dahora
- comenta
- tenta apagar conteudo da Conta A e nao consegue
- tenta apagar comentario de outra pessoa e nao consegue, exceto se for dona da criacao
- marca Presenca apenas uma vez
- nao ve Salvos da Conta A

## RLS esperado

- `profiles`: leitura publica; insert/update apenas do proprio `user_id`
- `contents`: leitura publica para `visibility = 'public'`; insert/update/delete apenas do autor
- `dahoras`: leitura publica; insert/delete apenas do proprio usuario
- `comments`: leitura publica em conteudo publico; insert proprio; delete pelo autor do comentario ou autor da criacao
- `waves`: leitura publica; insert/delete apenas do proprio usuario
- `saved_contents`: leitura privada apenas para o proprio usuario
- `presences`: leitura publica; insert/delete apenas do proprio usuario
- Storage `content-media`: leitura publica; upload/update/delete apenas na pasta do proprio usuario

## Deploy ready

Antes de subir:
- rodar `npm run lint`
- rodar `npm run build`
- configurar env vars no provedor de deploy
- rodar SQLs no banco final
- confirmar bucket `content-media`
- configurar Supabase `Site URL`
- configurar Google OAuth redirect URLs
- criar massa inicial de perfis e criacoes
- fazer smoke test mobile em Chrome Android e Safari iOS
- revisar logs do Supabase apos os primeiros testes

## Smoke test desktop

- abrir `/`
- abrir `/auth?mode=login`
- abrir `/auth?mode=signup`
- abrir `/legal`
- abrir `/legal/accept`
- abrir `/onboarding`
- abrir `/perfil`
- abrir `/feed`
- abrir `/comunidades`
- abrir `/mais`
- abrir `/momentos`
- criar conteudo texto
- criar conteudo com midia
- testar Dahora, Wave, Presenca, Salvos e Comentarios
- abrir/fechar Privs lateral

## Smoke test mobile

- abrir Home mobile
- confirmar topo com Ocean, notificacoes, Privs e avatar
- confirmar tabs `Flow / Moments / Discover`
- confirmar bottom nav `Inicio / + / Privs / Perfil`
- abrir criacao rapida pelo `+`
- testar camera/foto/video/texto rapido
- abrir Privs/Mensagens
- abrir perfil
- abrir comunidades
- confirmar que Discover, Ao vivo e Moments nao estao na bottom nav

## Checklist pos-deploy

- confirmar dominio final carregando com HTTPS
- testar Google OAuth no dominio final
- testar cadastro email/senha no dominio final
- criar conta nova e concluir legal accept + onboarding
- criar conteudo com foto e video no Storage de producao
- testar duas contas interagindo no mesmo conteudo
- testar Comunidades com duas contas
- revisar logs do Supabase Auth, Database e Storage
- revisar erros do provedor de deploy
- revisar responsividade em um celular real

## Gamificacao, Auras e perfil oficial

- rodar migrations `026_gamification_core.sql` ate `033_official_profile_defaults.sql`
- confirmar tabela `user_gamification`
- confirmar seed em `aura_definitions`
- confirmar seed em `mission_definitions`
- confirmar seed em `sticker_packs` e `stickers`
- criar conta do fundador/CEO normalmente pelo app
- pegar o UUID do usuario fundador em `auth.users`
- rodar no SQL Editor:

```sql
select public.apply_founder_entitlements('UUID_DO_USUARIO_FUNDADOR');

insert into public.official_accounts (user_id, kind, is_default_follow, is_founder, label)
values ('UUID_DO_USUARIO_FUNDADOR', 'founder', true, true, 'Fundador Ocean')
on conflict (user_id) do update set
  is_default_follow = true,
  is_founder = true,
  label = 'Fundador Ocean';
```

- confirmar fundador com `level = 9999`
- confirmar fundador com `has_all_auras = true`
- confirmar auras em `user_auras` para o fundador
- criar usuario comum novo e concluir onboarding
- confirmar linha level 1 em `user_gamification` ao iniciar missoes/acoes
- confirmar novo usuario seguindo conta oficial em `user_relationships`
- confirmar usuario pode remover relacionamento default depois
- criar Flow e confirmar progresso `daily_create_flow`
- fazer Wave e confirmar progresso `daily_create_wave`
- entrar em comunidade e confirmar progresso `weekly_join_5_communities`
- confirmar que erro de gamificacao nao bloqueia criacao, Wave ou comunidade
- abrir `/missoes` e confirmar nivel, XP, missoes diarias e semanais
- abrir `/auras` e confirmar cards de Auras colecionaveis
- equipar uma Aura desbloqueada e confirmar `user_auras.is_equipped = true`
- abrir `/perfil` e confirmar Aura sutil ao redor do avatar
- criar uma Criacao/Flow e confirmar Aura no avatar do PostCard
- comentar em uma Criacao e confirmar Aura no avatar do comentario
- abrir picker de Sticker no comentario e confirmar placeholder funcional
- confirmar card `Missoes & recompensas` na rightbar com dados reais quando migrations 026-033 estiverem rodadas
- testar `/missoes` e `/auras` no mobile sem alterar a bottom nav oficial

## Selos V1

- rodar migrations `034_badge_definitions.sql` ate `036_badge_eligibility.sql`
- confirmar seed em `badge_definitions`
- confirmar que somente `verified-basic` tem `is_purchasable = true`
- conceder selo de fundador ao CEO apos aplicar os entitlements:

```sql
select public.apply_founder_badge('UUID_DO_USUARIO_FUNDADOR');
```

- abrir `/selos` no desktop
- abrir `/selos` no mobile
- confirmar secoes Verificados, Gamificacao, Engajamento e Fundador
- confirmar Verificado basico como `Disponivel para compra futuramente`
- confirmar demais Verificados como desbloqueados por criterios
- equipar um selo desbloqueado e confirmar `user_badges.is_equipped = true`
- abrir `/perfil` e confirmar selo ao lado do nome
- criar uma Criacao/Flow e confirmar selo no PostCard
- comentar e confirmar selo ao lado do nome no comentario
- testar elegibilidade em `user_verification_eligibility`
- confirmar que Selos nao alteram Aura: Aura fica no avatar, Selo fica no nome

## TODOs antes do deploy beta

- testar RLS com pelo menos duas contas reais
- validar Google OAuth no dominio final
- validar email/senha com confirmacao ativa
- testar upload real em producao
- testar criacao mobile com camera em dispositivo real
- testar Comunidades com duas contas
- revisar regras e moderacao minima antes de liberar comunidades para muitos usuarios
- revisar documentos legais com advogado antes de grande escala
- validar aceite legal em email/senha e Google no dominio final
- testar gamificacao em banco final apos migrations 026-033
- testar Selos em banco final apos migrations 034-036

## TODOs depois da beta

- frontend avancado de Drops, Stickers e analise manual de Selos
- painel admin para grants, drops e moderacao de recompensas
- worker/backend confiavel para distribuir Aura secreta e Aura Drop
- recursos avancados do Privs: midia, audio, chamadas, grupos reais e moderacao
- Discover real com ranking/descoberta
- lives reais
- musica real
- marcacao real de pessoas
- stickers/filtros/editor de midia
- sistema real de Fas e Seletos
- moderacao/report completo
- paginacao ou infinite scroll
- realtime
- analytics de retencao e engajamento
- recursos avancados das Salas: realtime de ocupacao, anexos, audio/video, moderacao e anti-spam
- moderacao real de Comunidades
- denuncias, bloqueios e anti-spam em Comunidades
- painel admin de versoes legais e consentimentos granulares
- politica de idade, CPF/RG, reconhecimento facial e verificacao documental para comunidades restritas, Date e recursos sensiveis, com revisao LGPD antes de implementacao

## Privs MVP real

- rodar migrations `037_privs_conversations.sql` e `038_privs_messages.sql`
- abrir Privs no desktop pelo icone do topo direito
- abrir Privs no mobile pelo topo ou bottom nav
- Conta A iniciar conversa com Conta B em `Nova conversa`
- Conta A enviar mensagem de texto
- Conta B abrir Privs e ver a mensagem
- Conta B responder
- confirmar horarios, remetente e estado de conversa
- confirmar que usuario sem membership nao le conversa de terceiros por RLS
- confirmar que midia, grupos reais, chamada, audio e video continuam fora da beta

## Salas de comunidades com chat basico

- rodar migrations `039_community_room_messages.sql` e `040_community_room_presence.sql`
- Conta A entrar em uma comunidade
- abrir aba `Salas`
- entrar na `Sala 1`
- enviar mensagem de texto
- Conta B entrar na mesma comunidade e mesma sala
- Conta B ver mensagem e responder
- confirmar contador `online/capacidade`
- confirmar que usuario precisa ser membro para enviar mensagem
- confirmar que realtime funciona ou que refresh/fallback apos envio mantem a conversa utilizavel

## Layouts preview dos menus futuros

- abrir `/date` e confirmar Ocean Date como `Em breve`
- abrir `/shop` e confirmar Ocean Shop sem compra/venda real
- abrir `/stream` e confirmar Ocean Stream sem live real
- abrir `/academy` e confirmar Ocean Academy sem cursos reais
- abrir `/discover` e confirmar preview de descoberta
- abrir `/salas` e confirmar explicacao de salas nas Comunidades
- confirmar que Ocean Coin aparece apenas como visao futura, sem moeda ativa, compra, investimento ou retorno financeiro

