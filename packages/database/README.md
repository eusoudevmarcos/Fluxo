# @ocean/database

Migrations SQL da Ocean.

Por enquanto, rode os arquivos de `migrations/` manualmente no Supabase SQL Editor, nesta ordem:

1. `001_profiles.sql`
2. `002_add_onboarding_completed_to_profiles.sql`
3. `003_contents.sql`
4. `004_dahoras.sql`
5. `005_comments.sql`
6. `006_waves.sql`
7. `007_saved_contents.sql`
8. `008_presences.sql`
9. `009_profile_onboarding_details.sql`
10. `010_avatar_storage.sql`
11. `011_storage_content_media.sql`
12. `012_add_comments_enabled_to_contents.sql`

As migrations usam `create table if not exists`, `add column if not exists`, `create index if not exists` e recriam policies com `drop policy if exists` antes de `create policy` para reduzir erro em reexecucao manual.

Futuramente este pacote pode ser ligado ao Supabase CLI para versionar e aplicar migrations automaticamente.
