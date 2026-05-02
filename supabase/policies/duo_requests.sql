-- À exécuter dans Supabase SQL Editor (table + RLS).
-- Quand c’est fait, active aussi Realtime sur la table :
-- Dashboard → Database → duo_requests → activer "Realtime" (ou) :
--   alter publication supabase_realtime add table public.duo_requests;

CREATE TABLE IF NOT EXISTS public.duo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  domina_id UUID NOT NULL REFERENCES public.profiles(id),
  soumis_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.duo_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duo_requests_all" ON public.duo_requests;
CREATE POLICY "duo_requests_all" ON public.duo_requests
  FOR ALL TO authenticated USING (
    domina_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR soumis_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
  );
