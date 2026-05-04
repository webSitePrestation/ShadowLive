'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isDuoRequestsTableUnavailable } from '@/lib/duo-requests';
import type { DuoRequest } from '@/types';

export const LIVE_DUO_HANDSHAKE_CHANNEL = (sessionId: string) =>
  `live-duo-handshake:${sessionId}`;

export const LIVE_DUO_BROADCAST_EVENT = 'duo_invite_live';

interface UseDuoRequestArgs {
  sessionId: string;
  profileId: string;
  isDomina: boolean;
}

export interface SendDuoRequestContext {
  sessionTitle: string;
  dominaDisplayName: string;
}

export function useDuoRequest({ sessionId, profileId, isDomina }: UseDuoRequestArgs) {
  const supabase = createClient();
  const [pendingRequest, setPendingRequest] = useState<DuoRequest | null>(null);
  const [broadcastDuoPending, setBroadcastDuoPending] = useState(false);
  const [dominaAcceptedSoumisId, setDominaAcceptedSoumisId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const pendingDuoInvite = Boolean(pendingRequest) || broadcastDuoPending;

  const sendDuoRequest = useCallback(
    async (soumisId: string, ctx?: SendDuoRequestContext) => {
      if (!isDomina) return { error: 'Réservé à la Domina' as const };

      const { error } = await supabase.from('duo_requests').insert({
        session_id: sessionId,
        domina_id: profileId,
        soumis_id: soumisId,
        status: 'PENDING',
      });

      if (!error) return {};

      if (!isDuoRequestsTableUnavailable(error)) {
        return { error: error.message };
      }

      if (!ctx?.sessionTitle || !ctx.dominaDisplayName) {
        return {
          error:
            'Table duo_requests absente : exécute le fichier supabase/policies/duo_requests.sql dans Supabase (SQL Editor), puis rafraîchis le schéma API si besoin.',
        };
      }

      const chName = LIVE_DUO_HANDSHAKE_CHANNEL(sessionId);
      const ch = supabase.channel(chName);
      try {
        let settled = false;
        await new Promise<void>((resolve, reject) => {
          ch.subscribe(async (status) => {
            if (settled) return;
            if (status === 'SUBSCRIBED') {
              settled = true;
              const sendResult = await ch.send({
                type: 'broadcast',
                event: LIVE_DUO_BROADCAST_EVENT,
                payload: {
                  inviteeId: soumisId,
                  soumisId,
                  sessionTitle: ctx.sessionTitle,
                  dominaName: ctx.dominaDisplayName,
                },
              });
              await supabase.removeChannel(ch);
              if (sendResult !== 'ok') {
                reject(new Error(`Envoi invitation duo: ${sendResult}`));
              } else {
                resolve();
              }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              settled = true;
              reject(new Error(String(status)));
            }
          });
        });
      } catch (e: unknown) {
        return {
          error: e instanceof Error ? e.message : 'Broadcast duo impossible',
        };
      }
      return {};
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- client Supabase
    [isDomina, profileId, sessionId]
  );

  const acceptRequest = useCallback(async () => {
    if (isDomina) return { error: 'Aucune demande' as const };

    if (broadcastDuoPending) {
      const { error: e2 } = await supabase
        .from('live_sessions')
        .update({ guest_soumis_id: profileId })
        .eq('id', sessionId);
      if (e2) return { error: e2.message };
      setBroadcastDuoPending(false);
      return {};
    }

    if (!pendingRequest) return { error: 'Aucune demande' as const };

    const { error: e1 } = await supabase
      .from('duo_requests')
      .update({ status: 'ACCEPTED' })
      .eq('id', pendingRequest.id)
      .eq('status', 'PENDING');

    if (e1) {
      if (isDuoRequestsTableUnavailable(e1)) {
        setPendingRequest(null);
        const { error: e2 } = await supabase
          .from('live_sessions')
          .update({ guest_soumis_id: profileId })
          .eq('id', sessionId);
        if (e2) return { error: e2.message };
        return {};
      }
      return { error: e1.message };
    }

    const { error: e2 } = await supabase
      .from('live_sessions')
      .update({ guest_soumis_id: profileId })
      .eq('id', sessionId);

    if (e2) return { error: e2.message };

    setPendingRequest(null);
    return {};
  }, [isDomina, pendingRequest, profileId, sessionId, broadcastDuoPending, supabase]);

  const declineRequest = useCallback(async () => {
    if (isDomina) return;
    if (broadcastDuoPending) {
      setBroadcastDuoPending(false);
      return;
    }
    if (!pendingRequest) return;
    await supabase
      .from('duo_requests')
      .update({ status: 'DECLINED' })
      .eq('id', pendingRequest.id)
      .eq('status', 'PENDING');
    setPendingRequest(null);
  }, [isDomina, pendingRequest, supabase, broadcastDuoPending]);

  const clearDominaAccepted = useCallback(() => {
    setDominaAcceptedSoumisId(null);
  }, []);

  useEffect(() => {
    if (!isDomina) return;
    const chRef = { current: null as ReturnType<typeof supabase.channel> | null };
    let cancelled = false;

    void (async () => {
      const { error: probeErr } = await supabase.from('duo_requests').select('id').limit(1).maybeSingle();
      if (cancelled) return;
      if (probeErr && isDuoRequestsTableUnavailable(probeErr)) return;

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
        );
      chRef.current = ch;
      ch.subscribe();
    })();

    return () => {
      cancelled = true;
      if (chRef.current) void supabase.removeChannel(chRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- client Supabase
  }, [isDomina, profileId, sessionId]);

  useEffect(() => {
    if (isDomina) return;

    let cancelled = false;
    const ch = supabase.channel(LIVE_DUO_HANDSHAKE_CHANNEL(sessionId));

    ch.on('broadcast', { event: LIVE_DUO_BROADCAST_EVENT }, (msg) => {
      const raw =
        (msg as { payload?: { soumisId?: string; inviteeId?: string } }).payload ??
        (msg as { soumisId?: string; inviteeId?: string });
      const p = raw as { soumisId?: string; inviteeId?: string };
      if (p?.inviteeId === profileId || p?.soumisId === profileId) {
        setBroadcastDuoPending(true);
      }
    });

    void (async () => {
      const { error: probeErr } = await supabase.from('duo_requests').select('id').limit(1).maybeSingle();
      if (cancelled) return;

      const tableMissing = Boolean(probeErr && isDuoRequestsTableUnavailable(probeErr));

      if (!tableMissing) {
        const { data } = await supabase
          .from('duo_requests')
          .select('*')
          .eq('session_id', sessionId)
          .eq('soumis_id', profileId)
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && data) setPendingRequest(data as DuoRequest);

        ch.on(
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
        ).on(
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
        );
      }

      if (!cancelled) {
        channelRef.current = ch;
        ch.subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || cancelled || tableMissing) return;
          const { data: pending } = await supabase
            .from('duo_requests')
            .select('*')
            .eq('session_id', sessionId)
            .eq('soumis_id', profileId)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cancelled && pending) setPendingRequest(pending as DuoRequest);
        });
      }
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isDomina, profileId, sessionId, supabase]);

  return {
    pendingRequest,
    broadcastDuoPending,
    pendingDuoInvite,
    acceptRequest,
    declineRequest,
    sendDuoRequest,
    dominaAcceptedSoumisId,
    clearDominaAccepted,
  };
}
