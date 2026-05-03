'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StageParticipant, StageRequest } from '@/types';

interface UseStageArgs {
  sessionId: string;
  profileId: string;
  isDomina: boolean;
  agoraUid: number;
}

const MAX_STAGE_USERS = 4;

export function useStage({ sessionId, profileId, isDomina, agoraUid }: UseStageArgs) {
  const supabase = useMemo(() => createClient(), []);

  const [stageParticipants, setStageParticipants] = useState<StageParticipant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<StageRequest[]>([]);
  const [myRequest, setMyRequest] = useState<StageRequest | null>(null);

  const isOnStage = useMemo(
    () =>
      stageParticipants.some(
        (p) => p.profile_id === profileId && p.is_on_stage
      ),
    [stageParticipants, profileId]
  );

  const stageCount = stageParticipants.length + 1;
  const canJoinStage = stageParticipants.length < MAX_STAGE_USERS;

  const refreshStageParticipants = useCallback(async () => {
    const { data, error } = await supabase
      .from('stage_participants')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_on_stage', true)
      .order('joined_at', { ascending: true });

    if (error) {
      console.warn('[useStage] refresh participants', error.message);
      return;
    }

    setStageParticipants((data ?? []) as StageParticipant[]);
  }, [sessionId, supabase]);

  const refreshMyRequest = useCallback(async () => {
    const { data, error } = await supabase
      .from('stage_requests')
      .select('*')
      .eq('session_id', sessionId)
      .eq('requester_id', profileId)
      .maybeSingle();

    if (error) {
      console.warn('[useStage] refresh my request', error.message);
      return;
    }

    setMyRequest((data as StageRequest | null) ?? null);
  }, [profileId, sessionId, supabase]);

  const refreshPendingRequests = useCallback(async () => {
    if (!isDomina) {
      setPendingRequests([]);
      return;
    }

    const { data, error } = await supabase
      .from('stage_requests')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[useStage] refresh pending requests', error.message);
      return;
    }

    setPendingRequests((data ?? []) as StageRequest[]);
  }, [isDomina, sessionId, supabase]);

  useEffect(() => {
    void refreshStageParticipants();
    void refreshMyRequest();
    void refreshPendingRequests();
  }, [refreshMyRequest, refreshPendingRequests, refreshStageParticipants]);

  const wasOnStageRef = useRef(false);
  useEffect(() => {
    if (isOnStage && !wasOnStageRef.current) {
      void refreshMyRequest();
    }
    wasOnStageRef.current = isOnStage;
  }, [isOnStage, refreshMyRequest]);

  useEffect(() => {
    const ch = supabase
      .channel(`stage:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stage_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as StageParticipant;
          if (!row.is_on_stage) return;
          setStageParticipants((prev) => {
            const exists = prev.some((p) => p.id === row.id || p.profile_id === row.profile_id);
            if (exists) {
              return prev.map((p) =>
                p.id === row.id || p.profile_id === row.profile_id ? row : p
              );
            }
            return [...prev, row].sort((a, b) =>
              new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stage_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as StageParticipant;
          setStageParticipants((prev) => {
            if (!row.is_on_stage) {
              return prev.filter((p) => p.id !== row.id && p.profile_id !== row.profile_id);
            }
            const exists = prev.some((p) => p.id === row.id || p.profile_id === row.profile_id);
            if (!exists) return [...prev, row];
            return prev.map((p) =>
              p.id === row.id || p.profile_id === row.profile_id ? row : p
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stage_requests',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as StageRequest;
          if (row.requester_id === profileId) setMyRequest(row);
          /* UPSERT peut n’émettre qu’un UPDATE PostgreSQL selon les cas ;
           * refetch la liste garantit les demandes pour la Domina même sans INSERT. */
          if (isDomina) void refreshPendingRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stage_requests',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as StageRequest;
          if (row.requester_id === profileId) setMyRequest(row);
          if (isDomina) void refreshPendingRequests();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
    // Réouvre le flux si refreshPendingRequests ou isDomina changent après login / profil chargé.
  }, [isDomina, profileId, refreshPendingRequests, sessionId, supabase]);

  const raiseHand = useCallback(async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('stage_requests')
      .upsert(
        {
          session_id: sessionId,
          requester_id: profileId,
          status: 'PENDING',
          type: 'RAISE_HAND',
          updated_at: now,
        },
        { onConflict: 'session_id,requester_id' }
      )
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn('[useStage] raiseHand', error.message);
      return false;
    }

    if (data) setMyRequest(data as StageRequest);
    return true;
  }, [profileId, sessionId, supabase]);

  const cancelRequest = useCallback(async () => {
    const { data, error } = await supabase
      .from('stage_requests')
      .update({ status: 'DECLINED', updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('requester_id', profileId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn('[useStage] cancelRequest', error.message);
      return false;
    }

    if (data) setMyRequest(data as StageRequest);
    return true;
  }, [profileId, sessionId, supabase]);

  const acceptRequest = useCallback(
    async (requestId: string, requesterId: string, requesterAgoraUid: number) => {
      if (!isDomina) return false;

      const { error: reqError } = await supabase
        .from('stage_requests')
        .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('session_id', sessionId);

      if (reqError) {
        console.warn('[useStage] acceptRequest:update request', reqError.message);
        return false;
      }

      const { data: partRow, error: partError } = await supabase
        .from('stage_participants')
        .upsert(
          {
            session_id: sessionId,
            profile_id: requesterId,
            agora_uid: requesterAgoraUid,
            is_on_stage: true,
            mic_muted: false,
            cam_off: false,
          },
          { onConflict: 'session_id,profile_id' }
        )
        .select('*')
        .maybeSingle();

      if (partError) {
        console.warn('[useStage] acceptRequest:upsert participant', partError.message);
        return false;
      }

      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (partRow) {
        const row = partRow as StageParticipant;
        setStageParticipants((prev) => {
          const next = prev.filter((p) => p.profile_id !== row.profile_id);
          return [...next, row].sort(
            (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
          );
        });
      }
      /* Ne pas await refreshStageParticipants ici : un SELECT trop tôt peut renvoyer [] et
       * écraser l’état optimiste — la grille Domina repasse alors en plein écran. */
      void refreshPendingRequests();

      return true;
    },
    [isDomina, refreshPendingRequests, sessionId, supabase]
  );

  const declineRequest = useCallback(
    async (requestId: string) => {
      if (!isDomina) return false;
      const { error } = await supabase
        .from('stage_requests')
        .update({ status: 'DECLINED', updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('session_id', sessionId);

      if (error) {
        console.warn('[useStage] declineRequest', error.message);
        return false;
      }
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      void refreshPendingRequests();
      return true;
    },
    [isDomina, refreshPendingRequests, sessionId, supabase]
  );

  const removeFromStage = useCallback(
    async (targetProfileId: string) => {
      if (!isDomina) return false;

      const { error: stageError } = await supabase
        .from('stage_participants')
        .update({ is_on_stage: false })
        .eq('session_id', sessionId)
        .eq('profile_id', targetProfileId);

      if (stageError) {
        console.warn('[useStage] removeFromStage:stage', stageError.message);
        return false;
      }

      const { error: requestError } = await supabase
        .from('stage_requests')
        .update({ status: 'REMOVED', updated_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('requester_id', targetProfileId);

      if (requestError) {
        console.warn('[useStage] removeFromStage:request', requestError.message);
        return false;
      }

      setStageParticipants((prev) => prev.filter((p) => p.profile_id !== targetProfileId));
      setPendingRequests((prev) => prev.filter((r) => r.requester_id !== targetProfileId));

      return true;
    },
    [isDomina, sessionId, supabase]
  );

  const muteParticipant = useCallback(
    async (targetProfileId: string, muted: boolean) => {
      if (!isDomina) return false;
      const { error } = await supabase
        .from('stage_participants')
        .update({ mic_muted: muted })
        .eq('session_id', sessionId)
        .eq('profile_id', targetProfileId)
        .eq('is_on_stage', true);

      if (error) {
        console.warn('[useStage] muteParticipant', error.message);
        return false;
      }
      return true;
    },
    [isDomina, sessionId, supabase]
  );

  const hideCamera = useCallback(
    async (targetProfileId: string, hidden: boolean) => {
      if (!isDomina) return false;
      const { error } = await supabase
        .from('stage_participants')
        .update({ cam_off: hidden })
        .eq('session_id', sessionId)
        .eq('profile_id', targetProfileId)
        .eq('is_on_stage', true);

      if (error) {
        console.warn('[useStage] hideCamera', error.message);
        return false;
      }
      return true;
    },
    [isDomina, sessionId, supabase]
  );

  const joinStage = useCallback(
    async (nextAgoraUid?: number) => {
      const uid = nextAgoraUid ?? agoraUid;
      const { data: partRow, error } = await supabase
        .from('stage_participants')
        .upsert(
          {
            session_id: sessionId,
            profile_id: profileId,
            agora_uid: uid,
            is_on_stage: true,
          },
          { onConflict: 'session_id,profile_id' }
        )
        .select('*')
        .maybeSingle();

      if (error) {
        console.warn('[useStage] joinStage', error.message);
        return false;
      }

      if (partRow) {
        const row = partRow as StageParticipant;
        setStageParticipants((prev) => {
          const next = prev.filter((p) => p.profile_id !== row.profile_id);
          return [...next, row].sort(
            (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
          );
        });
      }
      /* Pas de refreshStageParticipants ici : le refetch peut encore renvoyer [] et écraser la ligne
       * qu’on vient d’upsert — le soumis ne se voit pas en 2e tuile. Realtime + mount refetch suffisent. */
      await refreshMyRequest();
      return true;
    },
    [agoraUid, profileId, refreshMyRequest, sessionId, supabase]
  );

  const leaveStage = useCallback(async () => {
    const { error } = await supabase
      .from('stage_participants')
      .update({ is_on_stage: false })
      .eq('session_id', sessionId)
      .eq('profile_id', profileId);

    if (error) {
      console.warn('[useStage] leaveStage', error.message);
      return false;
    }

    const { error: reqErr } = await supabase
      .from('stage_requests')
      .update({ status: 'REMOVED', updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('requester_id', profileId);

    if (reqErr) {
      console.warn('[useStage] leaveStage:request', reqErr.message);
    }

    setStageParticipants((prev) => prev.filter((p) => p.profile_id !== profileId));
    await refreshMyRequest();
    return true;
  }, [profileId, refreshMyRequest, sessionId, supabase]);

  return {
    stageParticipants,
    pendingRequests: isDomina ? pendingRequests : [],
    myRequest,
    isOnStage,
    stageCount,
    canJoinStage,
    raiseHand,
    cancelRequest,
    acceptRequest,
    declineRequest,
    removeFromStage,
    muteParticipant,
    hideCamera,
    joinStage,
    leaveStage,
  };
}
