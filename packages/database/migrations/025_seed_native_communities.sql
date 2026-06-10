insert into public.communities (slug, name, description, category, is_official, is_local, country, rules)
values
  (
    'eu-odeio-acordar-cedo',
    'Eu odeio acordar cedo',
    'Para quem funciona melhor depois do segundo alarme.',
    'Humor',
    true,
    false,
    'BR',
    array['Respeite os membros.', 'Nada de ataques pessoais.', 'Memes são bem-vindos.', 'Conteúdo ofensivo pode ser removido.']
  ),
  (
    'teorias-da-conspiracao',
    'Teorias da conspiração',
    'Debates, hipóteses e histórias curiosas com respeito.',
    'Debates',
    true,
    false,
    'BR',
    array['Debata ideias sem atacar pessoas.', 'Não incentive violência.', 'Evite acusações sem contexto.', 'Respeite opiniões diferentes.']
  ),
  (
    'musica',
    'Música',
    'Descobertas, playlists, artistas e o som do momento.',
    'Cultura',
    true,
    false,
    'BR',
    array['Respeite gostos diferentes.', 'Credite artistas quando possível.', 'Não pratique spam.']
  ),
  (
    'games',
    'Games',
    'Partidas, lançamentos, nostalgia e comunidade gamer.',
    'Games',
    true,
    false,
    'BR',
    array['Sem toxicidade.', 'Respeite todos os niveis de jogo.', 'Evite spoilers sem aviso.']
  ),
  (
    'filmes-e-series',
    'Filmes e séries',
    'Recomendações, teorias, cenas favoritas e maratonas.',
    'Entretenimento',
    true,
    false,
    'BR',
    array['Avise sobre spoilers.', 'Respeite opiniões diferentes.', 'Não publique pirataria.']
  ),
  (
    'relacionamentos',
    'Relacionamentos',
    'Conversas sobre conexões, encontros, amizade e vida real.',
    'Social',
    true,
    false,
    'BR',
    array['Sem exposição de terceiros.', 'Respeite limites.', 'Não pratique assédio.']
  ),
  (
    'tecnologia',
    'Tecnologia',
    'Produtos, dev, IA, startups e cultura digital.',
    'Tecnologia',
    true,
    false,
    'BR',
    array['Compartilhe conhecimento.', 'Não publique golpes.', 'Respeite iniciantes.']
  ),
  (
    'humor',
    'Humor',
    'Memes, piadas e caos controlado com respeito.',
    'Humor',
    true,
    false,
    'BR',
    array['Humor sem ataque.', 'Não use ódio como piada.', 'Respeite as diretrizes da Ocean.']
  ),
  (
    'esportes',
    'Esportes',
    'Torcida, jogos, campeonatos e resenhas.',
    'Esportes',
    true,
    false,
    'BR',
    array['Rivalidade com respeito.', 'Sem ameaças.', 'Evite spam de placar.']
  ),
  (
    'arte-e-criacao',
    'Arte e criação',
    'Desenho, design, foto, vídeo, escrita e criadores.',
    'Criadores',
    true,
    false,
    'BR',
    array['Respeite autoria.', 'Credite referências.', 'Feedback deve ser construtivo.']
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  is_official = excluded.is_official,
  is_local = excluded.is_local,
  country = excluded.country,
  rules = excluded.rules,
  updated_at = now();

insert into public.community_rooms (community_id, name, room_number, capacity, online_count)
select communities.id, 'Sala ' || rooms.room_number, rooms.room_number, 200, rooms.online_count
from public.communities
cross join (
  values
    (1, 0),
    (2, 30),
    (3, 120),
    (4, 12),
    (5, 77)
) as rooms(room_number, online_count)
where communities.slug in (
  'eu-odeio-acordar-cedo',
  'teorias-da-conspiracao',
  'musica',
  'games',
  'filmes-e-series',
  'relacionamentos',
  'tecnologia',
  'humor',
  'esportes',
  'arte-e-criacao'
)
on conflict (community_id, room_number) do update set
  capacity = excluded.capacity,
  online_count = excluded.online_count,
  updated_at = now();
