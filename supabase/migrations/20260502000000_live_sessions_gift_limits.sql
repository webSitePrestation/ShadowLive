-- Run in Supabase SQL Editor or via migration
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS min_coins_per_gift INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_coins_per_gift INTEGER DEFAULT 500,
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER DEFAULT 0;
