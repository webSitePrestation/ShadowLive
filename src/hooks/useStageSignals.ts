'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type StageSignalAction =
  | 'MUTE_MIC'
  | 'UNMUTE_MIC'
  | 'HIDE_CAM'
  | 'SHOW_CAM'
  | 'REMOVE_FROM_STAGE'
  | 'KICK';

export type StageSignalPayload = {
  id: string;
  action: StageSignalAction;
};

interface UseStageSignalsArgs {
  sessionId: string;
  profileId: string;
  isDomina: boolean;
}

const PROCESSED_SIGNAL_IDS_CAP = 200;

export function useStageSignals({ sessionId, profileId, isDomina }: UseStageSignalsArgs) {
  const supabase = useMemo(() => createClient(), []);
  const [lastSignal, setLastSignal] = useState<StageSignalPayload | null>(null);
  const processedSignalIdsRef = useRef<Set<string>>(new Set());

  const acknowledgeLastSignal = useCallback(() => setLastSignal(null), []);

  const insertSignal = useCallback(
    async (target_profile_id: string, action: StageSignalAction) => {
      const { error } = await supabase.from('stage_signals').insert({
        session_id: sessionId,
        target_profile_id,
        action,
        sent_by: profileId,
      });
      if (error) {
        console.warn('[useStageSignals] insert', error.message);
      }
    },
    [sessionId, profileId, supabase]
  );

  const sendMuteMic = useCallback(
    async (targetProfileId: string) => {
      if (!isDomina) return;
      await insertSignal(targetProfileId, 'MUTE_MIC');
    },
    [insertSignal, isDomina]
  );

  const sendUnmuteMic = useCallback(
    async (targetProfileId: string) => {
      if (!isDomina) return;
      await insertSignal(targetProfileId, 'UNMUTE_MIC');
    },
    [insertSignal, isDomina]
  );

  const sendHideCam = useCallback(
    async (targetProfileId: string) => {
      if (!isDomina) return;
      await insertSignal(targetProfileId, 'HIDE_CAM');
    },
    [insertSignal, isDomina]
  );

  const sendShowCam = useCallback(
    async (targetProfileId: string) => {
      if (!isDomina) return;
      await insertSignal(targetProfileId, 'SHOW_CAM');
    },
    [insertSignal, isDomina]
  );

  const sendRemoveFromStage = useCallback(
    async (targetProfileId: string) => {
      if (!isDomina) return;
      await insertSignal(targetProfileId, 'REMOVE_FROM_STAGE');
    },
    [insertSignal, isDomina]
  );

  const sendKick = useCallback(
    async (targetProfileId: string) => {
      if (!isDomina) return;
      await insertSignal(targetProfileId, 'KICK');
    },
    [insertSignal, isDomina]
  );

  useEffect(() => {
    if (isDomina) return;

    processedSignalIdsRef.current.clear();

    const ch = supabase
      .channel(`stage_signals:${sessionId}:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stage_signals',
          filter: `target_profile_id=eq.${profileId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            session_id?: string;
            target_profile_id?: string;
            action?: string;
          };
          if (!row?.id || !row.action || row.session_id !== sessionId) return;
          if (processedSignalIdsRef.current.has(row.id)) return;
          processedSignalIdsRef.current.add(row.id);
          if (processedSignalIdsRef.current.size > PROCESSED_SIGNAL_IDS_CAP) {
            processedSignalIdsRef.current.clear();
          }
          const a = row.action as StageSignalAction;
          setLastSignal({ id: row.id, action: a });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [isDomina, sessionId, profileId, supabase]);

  return {
    lastSignal,
    acknowledgeLastSignal,
    sendMuteMic,
    sendUnmuteMic,
    sendHideCam,
    sendShowCam,
    sendRemoveFromStage,
    sendKick,
  };
}
