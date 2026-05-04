-- Active Postgres → Realtime pour les tables utilisées par postgres_changes côté client.
-- Idempotent : n’ajoute la table à la publication que si elle n’y est pas déjà.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stage_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stage_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stage_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stage_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stage_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stage_signals;
  END IF;

  -- Table optionnelle : créée seulement si tu as appliqué supabase/policies/duo_requests.sql
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'duo_requests'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'duo_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duo_requests;
  END IF;
END $$;
