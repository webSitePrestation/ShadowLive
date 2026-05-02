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
    const channelName = `invite-notify:${profileId}`;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'duo_invite' }, (msg) => {
        const raw = (msg as { payload?: Partial<Invite> }).payload ?? (msg as Partial<Invite>);
        const p = raw as Partial<Invite>;
        if (p?.token && p?.sessionId) {
          setInvite({
            token: String(p.token).trim(),
            sessionId: String(p.sessionId),
            sessionTitle: p.sessionTitle ?? 'Live',
            dominaName: p.dominaName ?? 'Domina',
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  const dismissInvite = () => setInvite(null);

  return { invite, dismissInvite };
}
