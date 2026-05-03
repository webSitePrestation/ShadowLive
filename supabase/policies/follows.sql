-- Exécuter dans Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select" ON follows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "follows_insert" ON follows
  FOR INSERT TO authenticated WITH CHECK (
    follower_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "follows_delete" ON follows
  FOR DELETE TO authenticated USING (
    follower_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );
