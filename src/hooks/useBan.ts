'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * @param sessionId - live_sessions.id
 * @param dominaId - session.domina_id (profil Domina du live ; banned_by à l’insert)
 */
export function useBan(sessionId: string, dominaId: string) {
  const supabase = createClient();
  const [bannedIds, setBannedIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('banned_users')
      .select('banned_user_id')
      .eq('session_id', sessionId);
    if (error) {
      console.warn('[useBan] fetch', error.message);
      return;
    }
    setBannedIds((data ?? []).map((r: { banned_user_id: string }) => r.banned_user_id));
  }, [sessionId, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel(`banned-users:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'banned_users',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as { banned_user_id?: string };
          if (row?.banned_user_id) {
            setBannedIds((prev) =>
              prev.includes(row.banned_user_id!) ? prev : [...prev, row.banned_user_id!]
            );
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [sessionId, supabase]);

  const isBanned = useCallback(
    (userId: string) => bannedIds.includes(userId),
    [bannedIds]
  );

  const banUser = useCallback(
    async (userId: string, reason?: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: 'Non connecté.' as const };
      const { data: me } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (me?.id !== dominaId) {
        return { error: 'Seule la Domina peut bannir.' as const };
      }
      if (userId === dominaId) {
        return { error: 'Tu ne peux pas te bannir toi-même.' as const };
      }
      const { error } = await supabase.from('banned_users').insert({
        session_id: sessionId,
        banned_user_id: userId,
        banned_by: dominaId,
        reason: reason ?? null,
      });
      if (error) return { error: error.message };
      setBannedIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      return {};
    },
    [sessionId, dominaId, supabase]
  );

  return { bannedIds, banUser, isBanned, refreshBanned: refresh };
}
