'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DuoRequest } from '@/types';

interface UseDuoRequestArgs {
  sessionId: string;
  profileId: string;
  isDomina: boolean;
}

export function useDuoRequest({ sessionId, profileId, isDomina }: UseDuoRequestArgs) {
  const supabase = createClient();
  const [pendingRequest, setPendingRequest] = useState<DuoRequest | null>(null);
  const [dominaAcceptedSoumisId, setDominaAcceptedSoumisId] = useState<string | null>(null);

  const sendDuoRequest = useCallback(
    async (soumisId: string) => {
      if (!isDomina) return { error: 'Réservé à la Domina' as const };
      const { error } = await supabase.from('duo_requests').insert({
        session_id: sessionId,
        domina_id: profileId,
        soumis_id: soumisId,
        status: 'PENDING',
      });
      if (error) return { error: error.message };
      return {};
    },
    [isDomina, profileId, sessionId, supabase]
  );

  const acceptRequest = useCallback(async () => {
    if (!pendingRequest || isDomina) return { error: 'Aucune demande' as const };
    const { error: e1 } = await supabase
      .from('duo_requests')
      .update({ status: 'ACCEPTED' })
      .eq('id', pendingRequest.id)
      .eq('status', 'PENDING');

    if (e1) return { error: e1.message };

    const { error: e2 } = await supabase
      .from('live_sessions')
      .update({ guest_soumis_id: profileId })
      .eq('id', sessionId);

    if (e2) return { error: e2.message };

    setPendingRequest(null);
    return {};
  }, [isDomina, pendingRequest, profileId, sessionId, supabase]);

  const declineRequest = useCallback(async () => {
    if (!pendingRequest || isDomina) return;
    await supabase
      .from('duo_requests')
      .update({ status: 'DECLINED' })
      .eq('id', pendingRequest.id)
      .eq('status', 'PENDING');
    setPendingRequest(null);
  }, [isDomina, pendingRequest, supabase]);

  const clearDominaAccepted = useCallback(() => {
    setDominaAcceptedSoumisId(null);
  }, []);

  useEffect(() => {
    if (!isDomina) return;
    const ch = supabase
      .channel(`duo-requests-domina:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'duo_requests',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as DuoRequest;
          if (row.domina_id !== profileId) return;
          if (row.status === 'ACCEPTED' && row.soumis_id) {
            setDominaAcceptedSoumisId(row.soumis_id);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isDomina, profileId, sessionId, supabase]);

  useEffect(() => {
    if (isDomina) return;

    const fetchPending = async () => {
      const { data } = await supabase
        .from('duo_requests')
        .select('*')
        .eq('session_id', sessionId)
        .eq('soumis_id', profileId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPendingRequest(data as DuoRequest);
    };
    void fetchPending();

    const ch = supabase
      .channel(`duo-requests-soumis:${sessionId}:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'duo_requests',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as DuoRequest;
          if (row.soumis_id !== profileId || row.status !== 'PENDING') return;
          setPendingRequest(row);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'duo_requests',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as DuoRequest;
          if (row.soumis_id !== profileId) return;
          if (row.status !== 'PENDING') {
            setPendingRequest((cur) => (cur?.id === row.id ? null : cur));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [isDomina, profileId, sessionId, supabase]);

  return {
    pendingRequest,
    acceptRequest,
    declineRequest,
    sendDuoRequest,
    dominaAcceptedSoumisId,
    clearDominaAccepted,
  };
}
