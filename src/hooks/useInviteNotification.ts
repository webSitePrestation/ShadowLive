'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Invite {
  token: string;
  sessionId: string;
  sessionTitle: string;
  dominaName: string;
}

export function useInviteNotification(profileId: string) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`invites:${profileId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'access_tokens',
      }, async (payload) => {
        const token = payload.new;

        const { data: session } = await supabase
          .from('live_sessions')
          .select('id, title, profiles!live_sessions_domina_id_fkey(username)')
          .eq('id', token.session_id)
          .single();

        if (session) {
          setInvite({
            token: token.token,
            sessionId: session.id,
            sessionTitle: session.title,
            dominaName: (session.profiles as any)?.username ?? 'Domina',
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileId]);

  const dismissInvite = () => setInvite(null);

  return { invite, dismissInvite };
}
