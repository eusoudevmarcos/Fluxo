insert into public.communities (slug, name, description, category, is_official, rules)
values
  ('eu-odeio-acordar-cedo', 'Eu odeio acordar cedo', 'Para quem ama a noite, o cafe e reclamar do despertador com bom humor.', 'Humor', true, array['Respeite os membros.', 'Nada de ataques pessoais.', 'Memes sao bem-vindos.', 'Conteudo ofensivo pode ser removido.']),
  ('teorias-da-conspiracao', 'Teorias da conspiracao', 'Debates, hipoteses e conversas curiosas com respeito.', 'Debates', true, array['Debata ideias sem atacar pessoas.', 'Nao incentive violencia.', 'Evite acusacoes sem contexto.', 'Respeite opinioes diferentes.']),
  ('musica', 'Musica', 'Descobertas, playlists, artistas e o que esta tocando agora.', 'Cultura', true, array['Respeite todos os gostos musicais.', 'Credite artistas quando possivel.', 'Evite spam de links.']),
  ('games', 'Games', 'Partidas, dicas, comunidades e cultura gamer sem toxicidade.', 'Games', true, array['Sem ataques pessoais.', 'Evite spoilers sem aviso.', 'Respeite jogadores novos.']),
  ('filmes-e-series', 'Filmes e series', 'Reviews, teorias, recomendacoes e watch parties futuras.', 'Entretenimento', true, array['Avise sobre spoilers.', 'Respeite opinioes diferentes.', 'Nao publique pirataria.']),
  ('relacionamentos', 'Relacionamentos', 'Conversas sobre conexoes, date, amizade e vida social.', 'Social', true, array['Respeite limites.', 'Nao exponha dados pessoais.', 'Denuncie comportamento abusivo.']),
  ('tecnologia', 'Tecnologia', 'Dev, produto, gadgets, IA e futuro digital.', 'Tecnologia', true, array['Compartilhe conhecimento com respeito.', 'Nao faca spam.', 'Ajude iniciantes.']),
  ('humor', 'Humor', 'Memes, piadas e caos leve para respirar.', 'Humor', true, array['Humor sem ataques pessoais.', 'Evite preconceito.', 'Mantenha o clima leve.']),
  ('esportes', 'Esportes', 'Times, resenhas, jogos ao vivo e rivalidade saudavel.', 'Esportes', true, array['Rivalidade sem ofensa.', 'Respeite torcidas diferentes.', 'Evite spam.']),
  ('arte-e-criacao', 'Arte e criacao', 'Design, desenho, escrita, fotografia e criadores da Ocean.', 'Criadores', true, array['Credite trabalhos.', 'Feedback com respeito.', 'Nao copie criacoes sem permissao.'])
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    is_official = excluded.is_official,
    rules = excluded.rules,
    updated_at = now();

insert into public.community_rooms (community_id, name, room_number, capacity, online_count)
select communities.id, 'Sala ' || rooms.room_number, rooms.room_number, 200, rooms.online_count
from public.communities
cross join (
  values
    (1, 0),
    (2, 12),
    (3, 31),
    (4, 77),
    (5, 120)
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
on conflict (community_id, room_number) do update
set online_count = excluded.online_count,
    capacity = excluded.capacity,
    updated_at = now();
