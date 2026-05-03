CREATE TABLE IF NOT EXISTS stage_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  target_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('MUTE_MIC', 'UNMUTE_MIC', 'HIDE_CAM', 'SHOW_CAM', 'REMOVE_FROM_STAGE', 'KICK')),
  sent_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stage_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signals_insert_domina" ON stage_signals
  FOR INSERT TO authenticated WITH CHECK (
    sent_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "signals_select_target" ON stage_signals
  FOR SELECT TO authenticated USING (
    target_profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR sent_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

-- Realtime : dans le tableau de bord Supabase (Database → Publications) ajouter la table `stage_signals`,
-- ou une fois dans le SQL Editor : alter publication supabase_realtime add table public.stage_signals;
