-- Politiques RLS pour que les liens /join/[token] fonctionnent côté soumis.
-- À exécuter dans l’éditeur SQL Supabase si les invitations renvoient « Lien invalide »
-- alors que le token existe (SELECT bloqué par RLS).

-- Lecture : tout utilisateur connecté peut lire un jeton d’invitation encore valide
-- (le secret reste le UUID du token dans l’URL).
drop policy if exists "access_tokens_select_valid_invite" on public.access_tokens;
create policy "access_tokens_select_valid_invite"
  on public.access_tokens
  for select
  to authenticated
  using (
    used = false
    and (expires_at is null or expires_at > now())
  );

-- Mise à jour : marquer le jeton comme utilisé après une jointure réussie
drop policy if exists "access_tokens_update_mark_used" on public.access_tokens;
create policy "access_tokens_update_mark_used"
  on public.access_tokens
  for update
  to authenticated
  using (
    used = false
    and (expires_at is null or expires_at > now())
  )
  with check (used = true);
