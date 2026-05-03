CREATE TABLE IF NOT EXISTS stage_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REMOVED')),
  type TEXT NOT NULL DEFAULT 'RAISE_HAND'
    CHECK (type IN ('RAISE_HAND', 'DUO_INVITE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, requester_id)
);

ALTER TABLE stage_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_requests_select" ON stage_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "stage_requests_insert" ON stage_requests
  FOR INSERT TO authenticated WITH CHECK (
    requester_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "stage_requests_update" ON stage_requests
  FOR UPDATE TO authenticated USING (
    requester_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR session_id IN (
      SELECT id FROM live_sessions
      WHERE domina_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

ALTER TABLE live_sessions
ADD COLUMN IF NOT EXISTS max_stage_users INTEGER DEFAULT 4;

CREATE TABLE IF NOT EXISTS stage_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agora_uid INTEGER NOT NULL,
  mic_muted BOOLEAN NOT NULL DEFAULT false,
  cam_off BOOLEAN NOT NULL DEFAULT false,
  is_on_stage BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, profile_id)
);

ALTER TABLE stage_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_participants_all" ON stage_participants
  FOR ALL TO authenticated USING (true);
