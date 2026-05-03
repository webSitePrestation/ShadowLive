-- Permet à la Domina de supprimer les messages du chat de sa session (modération).
-- Adapter le nom de la contrainte FK si besoin (session_id → live_sessions).

drop policy if exists "chat_messages_delete_by_session_domina" on public.chat_messages;
create policy "chat_messages_delete_by_session_domina"
  on public.chat_messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.live_sessions ls
      join public.profiles p on p.id = ls.domina_id
      where ls.id = chat_messages.session_id
        and p.auth_user_id = auth.uid()
    )
  );
