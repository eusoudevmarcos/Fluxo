# UI Match Checklist

## Home Web
- Status atual: auditada com usuário beta em desktop e mobile.
- Correções feitas: top menu flutuante, Composer Drop compacto, cards da Wave mais próximos do mock, tabs mobile Flow/Vibes/Discover, carrossel com rolagem e linguagem Wave/Drop/Vibes/Privs/Dahora/Presença.
- Validação: `/` carregou autenticado em 1440x900 e 390x844 sem overflow horizontal, sem controles cortados e sem respostas HTTP 4xx/5xx.
- Pendente: testar criação real de Drop com mídia e depois limpar dados de QA.

## Composer Web
- Status atual: auditado visualmente e funcionalmente em sessão autenticada.
- Correções feitas: tipos acima da caixa, placeholder "O que vai dropar hoje?", CTA "Drop", destinos Dropar na Wave/Flow/Vibes/Privs/Favoritos, fallbacks de emojis/stickers corrigidos e rail mobile convertido para grade.
- Validação: botões Flow, Vibes, Foto, Vídeo, Texto e Mais opções aparecem dentro de 390px; Flow e Vibes clicam em desktop e mobile.
- Pendente: validar upload/preview real de foto e vídeo.

## Perfil Web
- Status atual: auditado com usuário beta em desktop e mobile.
- Correções feitas: header compacto, avatar quadrado com aura, selo junto ao nome, abas Drops/Vibes/Waves/Salvos, cópia revisada, Flow ID, conexões/rolês e ações de perfil.
- Validação: `/perfil` carregou autenticado em 1440x900 e 390x844 sem overflow; abas Drops, Vibes, Waves e Salvos clicam nos dois viewports.
- Pendente: testar edição real de avatar e campos do perfil.

## Discover
- Status atual: fluxo de busca de pessoas auditado.
- Correções feitas: página dedicada para encontrar pessoas, busca por nome/@username e cards com ação de fã/perfil.
- Validação: `/discover` carregou autenticado em desktop/mobile; campo "Buscar pessoas" aceitou busca por `star` sem erro de console ou HTTP.
- Pendente: testar seguir/deixar de seguir com limpeza/estado esperado.

## Communities
- Status atual: lista e modal de criação auditados.
- Correções feitas: linguagem de Drops, hero "Drops, Salas e Regras", filtros, cards com quebra de texto e sala com ações reais de voltar/atualizar/enviar.
- Validação: `/comunidades` carregou autenticado em desktop/mobile; botão "Criar comunidade" abre e "Cancelar" fecha sem overflow ou erro.
- Pendente: testar criação real, entrar/sair, Drop interno e chat.

## Privs
- Status atual: rota e painel incluídos na auditoria autenticada.
- Correções feitas: canal realtime único por montagem, visual de lista/chat refinado, status musical preservado, atalho falso removido e cópia técnica trocada por texto de usuário.
- Validação: `/privs` e `/mensagens` carregaram em desktop/mobile sem overflow, sem erro de console e sem HTTP 4xx/5xx.
- Pendente: testar envio real de Priv e conversa ativa ponta a ponta.

## Missões
- Status atual: rota incluída na auditoria autenticada.
- Correções feitas: cópia e acentuação de Missões, Recompensas, Nível, sequência, mês e erros.
- Validação: `/missoes` carregou em desktop/mobile sem overflow, sem controles cortados e sem erro de console.
- Pendente: sprint visual contra mock aprovado.

## Auras
- Status atual: rota incluída na auditoria autenticada.
- Correções feitas: AuraAvatar com glow quadrado, grid de vitrine e nomenclatura Drop.
- Validação: `/auras` carregou em desktop/mobile sem overflow, sem controles cortados e sem erro de console.
- Pendente: decidir se as auras finais serão CSS/vetor ou PNG/WebP dedicados.

## Selos
- Status atual: rota incluída na auditoria autenticada.
- Correções feitas: tridente vetorial, medalhas metalizadas, grid mais próximo das pranchas e cópia acentuada.
- Validação: `/selos` carregou em desktop/mobile sem overflow, sem controles cortados e sem erro de console.
- Pendente: decidir pacote final de ícones oficiais exportados como SVG/PNG.

## Auth e Legal
- Status atual: login beta validado.
- Validação: usuário beta entra por `/auth?mode=login` e cai em `/perfil`; cache legal de sessão foi usado na auditoria para evitar falso positivo de fetch abortado em navegação rápida.
- Pendente: revisão jurídica final antes de produção, por serem documentos legais.

## Correções Técnicas Desta Rodada
- `apps/web/src/app/perfil/page.module.css`: abas mobile do perfil agora têm padding/rolagem própria e não interceptam toque.
- `apps/web/src/components/feed/PostComposer.module.css`: seletor de tipo vira grade no mobile, evitando botões fora do container inicial.
- `apps/web/src/lib/services/presences.service.ts`: presença agora usa `upsert(..., ignoreDuplicates)` para não gerar 409 ao revisitar conteúdo já registrado.

## Validação
- Build: passou em `npm run build -w apps/web`.
- Typecheck: passou em `npm run typecheck -w apps/web`.
- Lint: passou em `npm run lint`.
- Browser autenticado: produção local via `next start`, login em `/perfil`, rotas `/`, `/perfil`, `/discover`, `/comunidades`, `/privs`, `/mensagens`, `/notificacoes`, `/missoes`, `/auras` e `/selos` em 1440x900 e 390x844.
- Resultado do browser: zero HTTP 4xx/5xx, zero erros de console, zero overflow horizontal, zero actionables cortados, gate "Preparando sua entrada" resolvido em todas as rotas.

## Sprint Fluxos Reais - 2026-07-01
- Drop real na Home: criado com usuário beta, exibido na UI e removido do Supabase ao final do teste.
- Comunidade real: criação de comunidade e Drop interno passaram. A comunidade QA criada no teste ficou ativa porque o Supabase online bloqueou update/delete por RLS; `SUPABASE_ROOM_CHAT_SQL.sql` adiciona a policy de update/delete para o dono.
- Sala de comunidade: o banco online não tem `community_room_messages`, `community_room_presence`, `join_community_room` e `leave_community_room`. O app agora bloqueia o input da sala com mensagem de migração pendente, sem chamar endpoints 404 quando `NEXT_PUBLIC_ENABLE_COMMUNITY_ROOM_CHAT` não estiver `true`.
- Privs/Mensagens: `/mensagens` e `/privs` agora renderizam o `PrivsPanel` real em vez de uma página estática. O envio de Priv real não foi feito porque não havia um segundo perfil QA; enviar para perfis reais foi evitado.
- Novo SQL: `SUPABASE_ROOM_CHAT_SQL.sql` cria mensagens/presença de salas, RPCs de entrar/sair da sala e policy de update/delete de comunidade pelo dono.
- Validações desta sprint: `npm run build -w apps/web`, `npm run typecheck -w apps/web` e `npm run lint` passaram.

## Próximas Sprints Recomendadas
- Aplicar `SUPABASE_ROOM_CHAT_SQL.sql` no Supabase e definir `NEXT_PUBLIC_ENABLE_COMMUNITY_ROOM_CHAT=true` no ambiente web quando a migração estiver aplicada.
- Criar um segundo usuário QA para testar envio real de Priv sem mandar mensagem para perfis reais.
- Sprint de ações com mídia: validar upload/preview de foto e vídeo, limpar storage e confirmar cards.
- Sprint de assets finais: exportar auras e selos como SVG/PNG/WebP oficiais para maior fidelidade ao mock.
- Sprint mobile app: empacotar beta nativo Android/iOS depois que os fluxos web autenticados estiverem fechados.
