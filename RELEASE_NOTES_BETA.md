# Ocean Beta — Release Candidate

Versao: beta RC
Data: 2026-05-17

## O que esta incluido

- Auth Supabase com email/senha e Google OAuth.
- Aceite legal obrigatorio com Termos, Privacidade, Diretrizes e Conteudo/Imagem/Voz.
- Onboarding obrigatorio com profile, Flow ID, cidade, estado, GPS e dados privados de seguranca.
- Profiles reais e perfil publico por Flow ID.
- Feed real com Criacoes e Flow.
- Upload de midia por Supabase Storage para foto, video e camera mobile.
- Dahora, Wave, Presenca e Salvos/Favoritos.
- Comentarios basicos.
- Controles basicos: apagar propria criacao, apagar comentario proprio e bloquear/liberar comentarios.
- Comunidades MVP com cards, paginas individuais, membros, regras, criacoes e salas mockadas.
- Privs visual/mockado para desktop e mobile.
- Ecossistema Ocean visual em `/mais`.
- Layout desktop e layout mobile oficial.

## O que esta em beta

- Fluxos de auth, legal accept, onboarding, feed, criacao, midia, interacoes e comunidades.
- Responsividade mobile web.
- Upload de midia com limites iniciais: foto ate 10MB e video ate 100MB.
- RLS das tabelas sociais e de comunidades.
- Checklist operacional de deploy em `BETA_CHECKLIST.md`.

## O que esta mockado

- Privs/chat real.
- Salas de comunidades em tempo real.
- Ocupacao realtime das salas.
- Denuncias e moderacao avancada.
- Discover completo.
- Ecossistema Ocean como vitrine futura.
- Regras de idade, KYC, documentos e reconhecimento facial para comunidades restritas e Date.

## O que ainda nao esta disponivel

- Date real.
- Shop real.
- Stream/lives reais.
- Academy real.
- Ocean Coin real, wallet, pagamentos ou monetizacao.
- KYC, CPF ou verificacao documental.
- Restricoes por idade, CPF/RG e reconhecimento facial.
- IA, filtros, stickers, editor avancado e musica real.
- Chat realtime de Privs ou Salas.
- Painel admin completo.

## Como testar

1. Rodar `npm install`.
2. Rodar todas as migrations listadas em `BETA_CHECKLIST.md`.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Configurar Supabase Auth, Google OAuth e bucket `content-media`.
5. Rodar `npm run lint`.
6. Rodar `npm run build`.
7. Rodar `npm run dev`.
8. Testar desktop: auth, onboarding, feed, criacao, midia, interacoes, comunidades, perfil e `/mais`.
9. Testar mobile: Home, bottom nav oficial, criacao rapida, Privs/Mensagens, perfil e comunidades.
10. Testar duas contas para RLS e interacoes.

## Bugs conhecidos

- Privs e Salas ainda nao enviam mensagens reais.
- Online count das salas e mockado/manual.
- Discover ainda nao tem algoritmo/produto completo.
- Moderacao real, denuncias e bloqueios completos ficam para depois.
- Algumas rotas futuras existem como placeholders para manter navegacao estavel.

## Proximos passos pos-beta

- Validar beta com usuarios reais.
- Monitorar Supabase Auth, Database e Storage.
- Corrigir bugs criticos de uso real.
- Implementar chat real de Privs.
- Implementar Salas realtime.
- Evoluir moderacao, denuncias e bloqueios.
- Melhorar Discover.
- Definir requisitos legais e regulatorios antes de qualquer Ocean Coin, wallet ou monetizacao.
