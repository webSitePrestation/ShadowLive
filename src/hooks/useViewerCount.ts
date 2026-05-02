'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useViewerCount(sessionId: string, initialCount: number, isActive: boolean) {
  const [count, setCount] = useState(initialCount);
  const supabase = createClient();

  useEffect(() => {
    if (!isActive) return;

    const presenceChannel = supabase.channel(`viewers:${sessionId}`, {
      config: { presence: { key: sessionId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const total = Object.keys(state).length;
        setCount(total);

        supabase
          .from('live_sessions')
          .update({ viewer_count: total })
          .eq('id', sessionId)
          .then(() => {});
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ joined_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(presenceChannel); };
  }, [sessionId, isActive]);

  return count;
}
