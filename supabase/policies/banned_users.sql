-- Exécuter dans Supabase SQL Editor (ou via migration).
-- Bannissements par session de live.

CREATE TABLE IF NOT EXISTS banned_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  banned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, banned_user_id)
);

ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banned_users_domina" ON banned_users
  FOR ALL TO authenticated USING (
    banned_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR banned_user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "banned_users_select" ON banned_users
  FOR SELECT TO authenticated USING (true);
