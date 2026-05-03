'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Users, Share2, MessageCircle, UserPlus, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { accessTokenExpiresAtIso } from '@/lib/access-token';
import { useMultiStream } from '@/hooks/useMultiStream';
import { useChat } from '@/hooks/useChat';
import { useCoins } from '@/hooks/useCoins';
import { useViewerCount } from '@/hooks/useViewerCount';
import StageGrid from '@/components/live/StageGrid';
import ChatPanel from '@/components/live/ChatPanel';
import CoinButton from '@/components/live/CoinButton';
import CoinRain from '@/components/live/CoinRain';
import WalletOverlay from '@/components/live/WalletOverlay';
import DuoInviteModal from '@/components/live/DuoInviteModal';
import DuoRequestToast from '@/components/live/DuoRequestToast';
import InviteToast from '@/components/live/InviteToast';
import { useInviteNotification } from '@/hooks/useInviteNotification';
import { useDuoRequest } from '@/hooks/useDuoRequest';
import { useBan } from '@/hooks/useBan';
import { useStage } from '@/hooks/useStage';
import { useStageSignals } from '@/hooks/useStageSignals';
import { profileIdToAgoraUid } from '@/lib/profile-agora-uid';
import Badge from '@/components/ui/Badge';
import FollowButton from '@/components/live/FollowButton';
import RaiseHandButton from '@/components/live/RaiseHandButton';
import StageRequestsPanel from '@/components/live/StageRequestsPanel';
import StageParticipantsList from '@/components/live/StageParticipantsList';
import type { LiveSession, Profile } from '@/types';

const STANDARD_GIFT_AMOUNTS = [10, 50, 100, 500];

/** Montants des boutons rapides : presets filtrés par [min, max], ou valeurs dérivées si l’intervalle est étroit. */
function resolveGiftCoinAmounts(minCoins: number, maxCoins: number): number[] {
  const lo = Math.min(minCoins, maxCoins);
  const hi = Math.max(minCoins, maxCoins);
  const filtered = STANDARD_GIFT_AMOUNTS.filter((a) => a >= lo && a <= hi);
  if (filtered.length > 0) return filtered;
  const raw = [lo, lo * 2, Math.floor(hi / 2), hi];
  const uniq = new Set<number>();
  for (const v of raw) {
    const r = Math.round(v);
    if (r >= lo && r <= hi && r > 0) uniq.add(r);
  }
  return [...uniq].sort((a, b) => a - b);
}

interface Props {
  session: LiveSession;
  profile: Profile;
  domina: Pick<Profile, 'id' | 'username' | 'avatar_url'> | null;
}

export default function LiveClient({ session, profile, domina }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isDomina = profile.id === session.domina_id;
  const uidRef = useRef(profileIdToAgoraUid(profile.id));

  const [isLive, setIsLive] = useState(session.status === 'LIVE');
  const [starting, setStarting] = useState(false);
  const [agoraReady, setAgoraReady] = useState(false);
  const [guestSoumisId, setGuestSoumisId] = useState<string | null>(session.guest_soumis_id);
  const [duoUsername, setDuoUsername] = useState('');
  const [showDuoBanner, setShowDuoBanner] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showWallet, setShowWallet] = useState(false);
  const [showDuo, setShowDuo] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [coinRainTrigger, setCoinRainTrigger] = useState(0);
  const [lastCoinAmount, setLastCoinAmount] = useState(0);
  const [showStageAcceptedToast, setShowStageAcceptedToast] = useState(false);
  const [soumisIdsInLive, setSoumisIdsInLive] = useState<string[]>([]);
  const [duoDominaToastName, setDuoDominaToastName] = useState<string | null>(null);
  const [showDuoActivatedOverlay, setShowDuoActivatedOverlay] = useState(false);
  const prevGuestForDuoOverlayRef = useRef<string | null>(session.guest_soumis_id ?? null);
  /** Handles minuteurs navigateur (`number`), pas `@types/node` Timeout. */
  const signalToastTimerRef = useRef<number | null>(null);
  const [signalToastMessage, setSignalToastMessage] = useState<string | null>(null);
  const [micForcedMuted, setMicForcedMuted] = useState(false);
  const [camForcedOff, setCamForcedOff] = useState(false);

  const showToast = useCallback((message: string) => {
    if (signalToastTimerRef.current != null) {
      window.clearTimeout(signalToastTimerRef.current);
      signalToastTimerRef.current = null;
    }
    setSignalToastMessage(message);
    signalToastTimerRef.current = window.setTimeout(() => {
      setSignalToastMessage(null);
      signalToastTimerRef.current = null;
    }, 3000) as number;
  }, []);

  const {
    pendingDuoInvite,
    acceptRequest: acceptDuoRequest,
    declineRequest: declineDuoRequest,
    sendDuoRequest,
  } = useDuoRequest({
    sessionId: session.id,
    profileId: profile.id,
    isDomina,
  });

  const {
    stageParticipants,
    pendingRequests,
    myRequest,
    isOnStage,
    stageCount,
    canJoinStage,
    raiseHand,
    cancelRequest,
    acceptRequest,
    declineRequest,
    removeFromStage,
    joinStage,
    leaveStage,
  } = useStage({
    sessionId: session.id,
    profileId: profile.id,
    isDomina,
    agoraUid: uidRef.current,
  });

  const {
    lastSignal,
    acknowledgeLastSignal,
    sendMuteMic,
    sendUnmuteMic,
    sendHideCam,
    sendShowCam,
    sendRemoveFromStage,
    sendKick,
  } = useStageSignals({
    sessionId: session.id,
    profileId: profile.id,
    isDomina,
  });

  const isDuoGuest = Boolean(guestSoumisId && profile.id === guestSoumisId);
  const agoraRole = isDomina || isDuoGuest || isOnStage ? 'host' : 'audience';

  const {
    localVideoTrack, remoteUsers, joined,
    error: agoraError, micMuted, camOff,
    toggleMic, toggleCam, tryPublishVideo,
    muteSelf, unmuteSelf, hideCamSelf, showCamSelf, unpublishAll,
    kickUser, leave,
  } = useMultiStream({
    channelName: session.agora_channel,
    uid: uidRef.current,
    role: agoraRole,
    enabled: agoraReady,
  });

  const processedStageSignalIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    processedStageSignalIdsRef.current.clear();
  }, [session.id]);

  const participantToggleMic = useCallback(() => {
    if (!isDomina && isOnStage && micForcedMuted && micMuted) {
      showToast('🔇 La Domina contrôle ton micro');
      return;
    }
    void toggleMic();
  }, [isDomina, isOnStage, micForcedMuted, micMuted, showToast, toggleMic]);

  const participantToggleCam = useCallback(() => {
    if (!isDomina && isOnStage && camForcedOff && camOff) {
      showToast('📷 La Domina contrôle ta caméra');
      return;
    }
    void toggleCam();
  }, [camForcedOff, camOff, isDomina, isOnStage, showToast, toggleCam]);

  useEffect(() => {
    if (!isOnStage) {
      setMicForcedMuted(false);
      setCamForcedOff(false);
    }
  }, [isOnStage]);

  useEffect(() => {
    if (isDomina || !lastSignal) return;
    if (processedStageSignalIdsRef.current.has(lastSignal.id)) {
      acknowledgeLastSignal();
      return;
    }
    processedStageSignalIdsRef.current.add(lastSignal.id);

    const patchMyStageFlags = async (partial: { mic_muted?: boolean; cam_off?: boolean }) => {
      await supabase
        .from('stage_participants')
        .update(partial)
        .eq('session_id', session.id)
        .eq('profile_id', profile.id)
        .eq('is_on_stage', true);
    };

    const run = async () => {
      try {
        switch (lastSignal.action) {
          case 'MUTE_MIC':
            await muteSelf();
            setMicForcedMuted(true);
            void patchMyStageFlags({ mic_muted: true });
            showToast('🔇 La Domina a coupé ton micro');
            break;
          case 'UNMUTE_MIC':
            await unmuteSelf();
            setMicForcedMuted(false);
            void patchMyStageFlags({ mic_muted: false });
            break;
          case 'HIDE_CAM':
            await hideCamSelf();
            setCamForcedOff(true);
            void patchMyStageFlags({ cam_off: true });
            showToast('📷 La Domina a coupé ta caméra');
            break;
          case 'SHOW_CAM':
            await showCamSelf();
            setCamForcedOff(false);
            void patchMyStageFlags({ cam_off: false });
            break;
          case 'REMOVE_FROM_STAGE':
            await unpublishAll();
            await leaveStage();
            setMicForcedMuted(false);
            setCamForcedOff(false);
            showToast('⬇️ Tu as été descendu de scène');
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate([50, 30, 50]);
            }
            break;
          case 'KICK':
            await unpublishAll();
            await leaveStage();
            await leave();
            try {
              sessionStorage.setItem('shadowlive_live_removed', 'Tu as été expulsé(e) du live');
            } catch {
              /* ignore */
            }
            router.push('/explore');
            break;
          default:
            break;
        }
      } finally {
        acknowledgeLastSignal();
      }
    };

    void run();
  }, [
    acknowledgeLastSignal,
    hideCamSelf,
    isDomina,
    lastSignal,
    leave,
    leaveStage,
    muteSelf,
    profile.id,
    router,
    session.id,
    showCamSelf,
    showToast,
    supabase,
    unmuteSelf,
    unpublishAll,
  ]);

  /** Split vertical dès que le duo est actif en base (sans attendre Agora `joined`) */
  const isDuoLayout = Boolean(guestSoumisId) && (isDomina || isDuoGuest);
  const isDuoMode = isDuoLayout;

  const { invite: duoInviteToast, dismissInvite: dismissDuoInviteToast } =
    useInviteNotification(profile.id);

  const viewerCount = useViewerCount(session.id, session.viewer_count, isLive);
  const { bannedIds, banUser } = useBan(session.id, session.domina_id);
  const { messages, sendMessage, deleteMessage } = useChat(session.id, profile);

  const minGiftCoins = session.min_coins_per_gift ?? 10;
  const maxGiftCoins = session.max_coins_per_gift ?? 500;
  const giftCooldownSec = session.cooldown_seconds ?? 0;
  const giftSessionConfig = useMemo(
    () => ({
      minCoins: minGiftCoins,
      maxCoins: maxGiftCoins,
      cooldownSeconds: giftCooldownSec,
    }),
    [minGiftCoins, maxGiftCoins, giftCooldownSec]
  );
  const coinButtonAmounts = useMemo(
    () => resolveGiftCoinAmounts(minGiftCoins, maxGiftCoins),
    [minGiftCoins, maxGiftCoins]
  );
  const stageActionCoinAmounts = isOnStage ? coinButtonAmounts.slice(0, 2) : coinButtonAmounts;

  const { sendCoins, balance, timeUntilNext } = useCoins(
    session.id,
    profile,
    session.domina_id,
    giftSessionConfig
  );

  const giftRulesLine = !isDomina ? (
    <p className="text-white/20 text-xs text-center w-full mt-1">
      Min {minGiftCoins} • Max {maxGiftCoins} pièces
      {giftCooldownSec > 0 ? ` • Cooldown ${giftCooldownSec}s` : ''}
    </p>
  ) : null;

  const startLive = useCallback(async () => {
    if (starting) return;
    setStarting(true);

    const { error } = await supabase
      .from('live_sessions')
      .update({ status: 'LIVE', started_at: new Date().toISOString() })
      .eq('id', session.id);

    if (error) {
      alert(`Erreur: ${error.message}`);
      setStarting(false);
      return;
    }

    setIsLive(true);
    setAgoraReady(true);
    setStarting(false);

    try {
      await fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          sessionTitle: session.title,
          dominaName: profile.username,
        }),
      });
    } catch {
      /* ne pas bloquer le démarrage du live */
    }
  }, [starting, session.id, session.title, profile.username, supabase]);

  useEffect(() => {
    if (!isDomina && session.status === 'LIVE') setAgoraReady(true);
  }, [isDomina, session.status]);

  useEffect(() => {
    const ch = supabase
      .channel(`live-session:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const next = payload.new as LiveSession;
          if (next.guest_soumis_id !== undefined) {
            setGuestSoumisId(next.guest_soumis_id);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session.id]);

  useEffect(() => {
    if (isDuoGuest && guestSoumisId) {
      setShowDuoBanner(true);
    }
  }, [isDuoGuest, guestSoumisId]);

  useEffect(() => {
    if (!isDomina || !guestSoumisId) return;
    void supabase
      .from('profiles')
      .select('username')
      .eq('id', guestSoumisId)
      .single()
      .then(({ data }) => {
        if (data?.username) setDuoUsername(data.username);
      });
  }, [isDomina, guestSoumisId]);

  useEffect(() => {
    const prev = prevGuestForDuoOverlayRef.current;
    if (guestSoumisId && guestSoumisId !== prev) {
      setShowDuoActivatedOverlay(true);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([100, 50, 100]);
      }
      const t = window.setTimeout(() => setShowDuoActivatedOverlay(false), 3000);
      prevGuestForDuoOverlayRef.current = guestSoumisId;
      return () => window.clearTimeout(t);
    }
    prevGuestForDuoOverlayRef.current = guestSoumisId;
  }, [guestSoumisId]);

  useEffect(() => {
    if (!isLive) {
      setSoumisIdsInLive([]);
      return;
    }
    const ch = supabase.channel(`live-show:${session.id}`, {
      config: { presence: { key: profile.id } },
    });
    const syncPresence = () => {
      const state = ch.presenceState();
      setSoumisIdsInLive(Object.keys(state).filter((id) => id !== session.domina_id));
    };
    ch.on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ watching: true });
        }
      });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [isLive, session.id, session.domina_id, profile.id]);

  const prevGuestSoumisRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isDomina) return;
    const prev = prevGuestSoumisRef.current;
    if (prev === undefined) {
      prevGuestSoumisRef.current = guestSoumisId;
      return;
    }
    const next = guestSoumisId;
    if (next && next !== prev) {
      void supabase
        .from('profiles')
        .select('username')
        .eq('id', next)
        .single()
        .then(({ data }) => {
          setDuoDominaToastName(data?.username ?? 'Soumis');
        });
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([45, 30, 45, 30, 60]);
      }
    }
    prevGuestSoumisRef.current = next;
  }, [isDomina, guestSoumisId]);

  useEffect(() => {
    if (!duoDominaToastName || !isDomina) return;
    const t = window.setTimeout(() => setDuoDominaToastName(null), 5000);
    return () => window.clearTimeout(t);
  }, [duoDominaToastName, isDomina]);

  const acceptedStageRef = useRef<string | null>(null);
  useEffect(() => {
    if (!myRequest || myRequest.status !== 'ACCEPTED') {
      acceptedStageRef.current = null;
    }
  }, [myRequest?.id, myRequest?.status]);

  const leaveStageRef = useRef(leaveStage);
  leaveStageRef.current = leaveStage;
  const isOnStageCleanupRef = useRef(false);
  isOnStageCleanupRef.current = isOnStage;

  const stageLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const clear = () => {
      if (stageLeaveTimerRef.current) {
        clearTimeout(stageLeaveTimerRef.current);
        stageLeaveTimerRef.current = null;
      }
    };
    clear();
    return clear;
    // Annule un leaveStage différé au remontage (ex. Strict Mode) tout en le conservant à la vraie sortie de page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPageHide = () => {
      if (isOnStageCleanupRef.current) {
        void leaveStageRef.current();
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!isOnStageCleanupRef.current) return;
      stageLeaveTimerRef.current = setTimeout(() => {
        stageLeaveTimerRef.current = null;
        void leaveStageRef.current();
      }, 0);
    };
  }, [session.id]);

  useEffect(() => {
    if (isDomina) return;
    if (myRequest?.status !== 'ACCEPTED') return;
    if (acceptedStageRef.current === myRequest.id) return;
    acceptedStageRef.current = myRequest.id;

    void joinStage(uidRef.current);
    if (!agoraReady) setAgoraReady(true);
    setShowStageAcceptedToast(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([100, 50, 100]);
    }
    const t = window.setTimeout(() => setShowStageAcceptedToast(false), 2600);
    return () => window.clearTimeout(t);
  }, [agoraReady, isDomina, joinStage, myRequest]);

  const handleAcceptDuoRequest = useCallback(async () => {
    const res = await acceptDuoRequest();
    if (res && 'error' in res && res.error) {
      alert(res.error);
      return;
    }
    setAgoraReady(true);
    setShowDuoBanner(true);
  }, [acceptDuoRequest]);

  const endLive = useCallback(async () => {
    if (isOnStage) {
      await leaveStage();
    }
    await leave();
    if (isDomina) {
      await supabase
        .from('live_sessions')
        .update({
          status: 'ENDED',
          ended_at: new Date().toISOString(),
          guest_soumis_id: null,
        })
        .eq('id', session.id);
    }
    router.push('/dashboard');
  }, [isOnStage, leaveStage, leave, isDomina, session.id, router, supabase]);

  const generateInvite = useCallback(async () => {
    const { data } = await supabase
      .from('access_tokens')
      .insert({
        session_id: session.id,
        created_by: profile.id,
        role: 'SOUMIS',
        expires_at: accessTokenExpiresAtIso(),
      })
      .select()
      .single();

    if (data) {
      const link = `${window.location.origin}/join/${data.token}`;
      setInviteLink(link);
      setShowInvite(true);
      await navigator.clipboard.writeText(link).catch(() => {});
    }
  }, [session.id, profile.id]);

  const handleSendCoins = useCallback(async (amount: number) => {
    const success = await sendCoins(amount);
    if (success) {
      setLastCoinAmount(amount);
      setCoinRainTrigger(t => t + 1);
      await sendMessage(`a envoyé ${amount} pièces 🪙`, 'COIN_GIFT', { amount });
    }
    return success;
  }, [sendCoins, sendMessage]);

  const handleBanFromChat = useCallback(
    async (userId: string) => {
      const res = await banUser(userId);
      if (res && 'error' in res && res.error) {
        alert(res.error);
      }
    },
    [banUser]
  );

  /** Domina : retirer un intervenant (signal Agora + BDD stage / request). */
  const dominaRemoveIntervenant = useCallback(
    async (targetProfileId: string) => {
      if (!isDomina || !targetProfileId || targetProfileId === profile.id || targetProfileId === session.domina_id) return;
      await sendRemoveFromStage(targetProfileId);
      await removeFromStage(targetProfileId);
    },
    [isDomina, profile.id, removeFromStage, sendRemoveFromStage, session.domina_id]
  );

  const liveBanRedirectRef = useRef(false);

  useEffect(() => {
    if (!isDomina || !joined || bannedIds.length === 0) return;
    for (const bid of bannedIds) {
      void kickUser(profileIdToAgoraUid(bid));
    }
  }, [isDomina, joined, bannedIds, kickUser]);

  useEffect(() => {
    if (isDomina || liveBanRedirectRef.current) return;
    if (!bannedIds.includes(profile.id)) return;
    liveBanRedirectRef.current = true;
    void leave();
    try {
      sessionStorage.setItem('shadowlive_live_removed', 'Tu as été retiré de ce live');
    } catch {
      /* ignore */
    }
    router.replace('/explore');
  }, [isDomina, bannedIds, profile.id, leave, router]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {profile.role === 'SOUMIS' && (
        <InviteToast invite={duoInviteToast} onDismiss={dismissDuoInviteToast} />
      )}
      <CoinRain trigger={coinRainTrigger} amount={lastCoinAmount} />

      {/* Video : zone sous la barre d’actions (Chrome micro/cam est z-[120]) */}
      <div className="relative z-0 min-h-0 flex-1 overflow-hidden">
        <StageGrid
          localVideoTrack={localVideoTrack}
          remoteUsers={remoteUsers}
          stageParticipants={stageParticipants}
          localProfile={profile}
          dominaProfile={domina ?? { id: session.domina_id, username: 'Domina', avatar_url: null }}
          isDomina={isDomina}
          onParticipantAction={(targetProfileId, action) => {
            if (action === 'mute') void sendMuteMic(targetProfileId);
            if (action === 'hide') void sendHideCam(targetProfileId);
            if (action === 'remove') {
              void dominaRemoveIntervenant(targetProfileId);
            }
            if (action === 'kick') {
              void sendKick(targetProfileId);
              void banUser(targetProfileId);
              void kickUser(profileIdToAgoraUid(targetProfileId));
            }
          }}
        />

        {!isDomina && (
          <div className="absolute bottom-[5.5rem] right-3 z-[12]">
            <FollowButton
              followerId={profile.id}
              followingId={session.domina_id}
              showCountBelow
            />
          </div>
        )}

        {/* Gradients */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none" />

        {/* Header : droite toujours visible (flex-shrink-0), gauche peut déborder */}
        <div className="absolute top-0 inset-x-0 z-[20] flex items-start justify-between gap-2 p-4 pointer-events-none">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-hidden pointer-events-none">
            {isLive ? (
              <Badge variant="live">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="ghost">OFFLINE</Badge>
            )}
            <span className="flex shrink-0 items-center gap-1 text-white/40 text-xs">
              <Users size={10} />
              {viewerCount}
            </span>
            <Badge variant="ghost" className="shrink-0 text-[10px] border border-white/15 text-white/55">
              👥 {stageCount}/5 sur scène
            </Badge>
            {isDuoMode && (
              <Badge
                variant="gold"
                className="shrink-0 animate-pulse border border-amber-400/60 bg-gradient-to-r from-amber-950/90 to-yellow-900/80 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.45)] font-bold tracking-wide"
              >
                ⚡ DUO ACTIF
              </Badge>
            )}
            {isDuoGuest && localVideoTrack && !camOff && (
              <Badge variant="ghost" className="text-[10px] border border-white/15 text-white/50 shrink-0">
                🎬 Caméra
              </Badge>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 pointer-events-auto">
            {isDomina && pendingRequests.length > 0 && (
              <StageRequestsPanel
                requests={pendingRequests}
                onAccept={(requestId, requesterId) =>
                  void acceptRequest(requestId, requesterId, profileIdToAgoraUid(requesterId))
                }
                onDecline={(requestId) => void declineRequest(requestId)}
              />
            )}
            {isDomina && isLive && (
              <>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={generateInvite}
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass text-white/50 hover:text-white transition-colors"
                  aria-label="Partager un lien invité"
                >
                  <Share2 size={15} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowDuo(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass text-white/50 hover:text-white transition-colors"
                  aria-label="Inviter duo"
                >
                  <UserPlus size={15} />
                </motion.button>
              </>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => setShowChat(s => !s)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass text-white/50 hover:text-white transition-colors"
              aria-label="Chat"
            >
              <MessageCircle size={15} />
            </motion.button>
          </div>
        </div>

        {/* Invite link toast */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute inset-x-4 top-16 z-40 surface-luxury rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-yellow-500/70 text-xs uppercase tracking-widest">Lien copié ✓</p>
                <button onClick={() => setShowInvite(false)}>
                  <X size={14} className="text-white/30" />
                </button>
              </div>
              <p className="text-white/50 text-xs font-mono break-all">{inviteLink}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-20 left-0 right-0 h-52 z-10"
            >
              <ChatPanel
                messages={messages}
                onSend={(c) => void sendMessage(c)}
                profile={profile}
                isDomina={isDomina}
                dominaUserId={session.domina_id}
                onDelete={(id) => void deleteMessage(id)}
                onBan={isDomina ? (userId, _username) => void handleBanFromChat(userId) : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDuoBanner && isDuoGuest && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="absolute top-14 inset-x-4 z-30 surface-luxury rounded-xl p-3 border border-yellow-700/25"
            >
              <p className="text-yellow-500/90 text-xs font-semibold uppercase tracking-widest">Mode duo</p>
              <p className="text-white/80 text-sm mt-1">
                Écran coupé en deux : la Domina en haut, toi en bas. Caméra et micro partagés avec{' '}
                {domina?.username ?? 'la Domina'}.
              </p>
              <button
                type="button"
                onClick={() => setShowDuoBanner(false)}
                className="text-white/40 text-xs mt-2 hover:text-white/70"
              >
                OK
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isDuoLayout && isDomina && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-36 left-4 right-4 z-30 surface-dark rounded-xl px-3 py-2.5 border border-yellow-600/35 shadow-lg shadow-black/40"
            >
              <p className="text-yellow-500 text-[10px] font-bold uppercase tracking-widest">Duo actif</p>
              <p className="text-white text-sm font-semibold mt-0.5">
                {duoUsername || 'Soumis'} — vue partagée (toi en haut, lui en bas)
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDuoActivatedOverlay && isDuoMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 z-[48] flex items-center justify-center bg-black/55 pointer-events-none px-6"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35 }}
                className="max-w-md w-full rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-950/95 to-black/90 px-6 py-8 text-center shadow-[0_0_40px_rgba(234,179,8,0.2)]"
              >
                <p className="text-2xl sm:text-3xl font-black text-amber-100 tracking-tight">
                  ⚡ Mode Duo activé
                </p>
                <p className="mt-4 text-lg font-semibold text-white/90">
                  {domina?.username ?? 'Domina'}
                  <span className="text-amber-500/90 mx-2">vs</span>
                  {isDomina ? duoUsername || 'Invité' : profile.username}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {duoDominaToastName && isDomina && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="fixed top-4 inset-x-4 z-[55] max-w-lg mx-auto rounded-2xl px-4 py-4 border-2 border-yellow-500/60 shadow-2xl"
              style={{
                background:
                  'linear-gradient(145deg, rgba(42,32,8,0.98) 0%, rgba(8,6,4,0.99) 45%, rgba(18,14,8,0.98) 100%)',
              }}
            >
              <p className="text-yellow-400/90 text-[10px] font-bold uppercase tracking-[0.2em] text-center">
                Duo confirmé
              </p>
              <p className="text-white text-base font-bold text-center mt-1.5 tracking-tight">
                ⚡ {duoDominaToastName} a accepté le Duo
              </p>
              <p className="text-white/45 text-xs text-center mt-2">
                L&apos;écran est en deux : ta caméra en haut, la sienne en bas.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <DuoRequestToast
          visible={Boolean(!isDomina && pendingDuoInvite && isLive)}
          onAccept={() => void handleAcceptDuoRequest()}
          onDecline={() => void declineDuoRequest()}
        />

        {/* Bouton démarrer */}
        {isDomina && !isLive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center z-20"
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={startLive}
              disabled={starting}
              className="bg-red-800 hover:bg-red-700 disabled:opacity-50 glow-red text-white font-bold text-lg px-12 py-5 rounded-2xl tracking-widest transition-all border border-red-600/30"
            >
              {starting ? '⏳ Démarrage...' : '🔴 Démarrer le Live'}
            </motion.button>
          </motion.div>
        )}

        {/* Erreur */}
        <AnimatePresence mode="sync">
          {showStageAcceptedToast ? (
            <motion.div
              key="toast-stage-accepted"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute inset-x-4 top-14 z-50 rounded-xl border border-green-600/40 bg-green-900/40 px-3 py-2 text-center text-sm text-green-100"
            >
              ✅ Tu es maintenant sur scène !
            </motion.div>
          ) : null}
          {signalToastMessage ? (
            <motion.div
              key="toast-signal"
              layout={false}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute inset-x-4 top-14 z-[130] rounded-xl border border-white/15 bg-neutral-950/92 px-3 py-2 text-center text-sm text-white/90 backdrop-blur-sm"
            >
              {signalToastMessage}
            </motion.div>
          ) : null}
          {agoraError ? (
            <motion.div
              key="toast-agora-error"
              layout={false}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-20 inset-x-4 bg-red-900/80 border border-red-700/30 rounded-xl p-3 text-red-200 text-sm text-center z-50 glass"
            >
              {agoraError}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Barre chrome : au-dessus de la grille vidéo pour que micro/cam soient toujours cliquables */}
      <div className="relative z-[120] shrink-0 pointer-events-auto isolate">
      {isDomina && stageParticipants.length > 0 && (
        <div className="px-4 pt-2">
          <StageParticipantsList
            participants={stageParticipants}
            dominaProfileId={session.domina_id}
            isDomina={isDomina}
            onRemove={(targetProfileId) => void dominaRemoveIntervenant(targetProfileId)}
          />
        </div>
      )}
      <div className="glass relative z-[120] touch-manipulation border-t border-white/5 px-4 py-3 pointer-events-auto">
        {isDomina ? (
          <div className="flex flex-col gap-1">
            {isDuoMode && (
              <p className="text-center text-[10px] text-amber-400/95 font-semibold tracking-wide">
                🎬 Tu es en DUO
              </p>
            )}
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleMic}
                disabled={!joined}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                  micMuted ? 'bg-red-900/40 border border-red-700/40' : 'bg-white/8 border border-white/8'
                }`}
              >
                {micMuted ? <MicOff size={19} className="text-red-400" /> : <Mic size={19} className="text-white/70" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleCam}
                disabled={!joined}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                  camOff ? 'bg-red-900/40 border border-red-700/40' : 'bg-white/8 border border-white/8'
                }`}
              >
                {camOff ? <VideoOff size={19} className="text-red-400" /> : <Video size={19} className="text-white/70" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowWallet(w => !w)}
                className="w-12 h-12 rounded-full glass border border-yellow-700/20 flex items-center justify-center text-yellow-600/60 hover:text-yellow-500 transition-colors"
              >
                <span className="text-lg">🪙</span>
              </motion.button>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={endLive}
              className="w-12 h-12 rounded-full bg-red-700 hover:bg-red-600 glow-red-sm flex items-center justify-center"
            >
              <PhoneOff size={19} className="text-white" />
            </motion.button>
          </div>
          </div>
        ) : isDuoGuest ? (
          <div className="flex flex-col gap-1 min-h-[52px]">
            {isLive && (
              <div className="flex justify-center">
                <RaiseHandButton
                  myRequest={myRequest}
                  canJoinStage={canJoinStage}
                  isOnStage={isOnStage}
                  onRaiseHand={() => void raiseHand()}
                  onCancelRequest={() => void cancelRequest()}
                />
              </div>
            )}
            {isDuoMode && (
              <p className="text-center text-[10px] text-amber-400/95 font-semibold tracking-wide">
                🎬 Tu es en DUO
              </p>
            )}
            <div className="flex items-center justify-between gap-1.5">
              {isOnStage ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={participantToggleMic}
                    disabled={!joined}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                      micMuted ? 'bg-red-900/40 border border-red-700/40' : 'bg-white/8 border border-white/8'
                    }`}
                  >
                    {micMuted ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} className="text-white/70" />}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={participantToggleCam}
                    disabled={!joined}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                      camOff ? 'bg-red-900/40 border border-red-700/40' : 'bg-white/8 border border-white/8'
                    }`}
                  >
                    {camOff ? <VideoOff size={16} className="text-red-400" /> : <Video size={16} className="text-white/70" />}
                  </motion.button>
                </div>
              ) : null}
              <div className="flex flex-col flex-1 min-w-0 items-stretch">
                <div className="flex items-center justify-center gap-0.5 flex-1 min-w-0 overflow-x-auto px-0.5">
                  {timeUntilNext > 0 ? (
                    <motion.button
                      type="button"
                      disabled
                      className="flex h-10 w-10 min-h-10 min-w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-white/8 bg-white/5 text-center text-[10px] font-semibold leading-tight text-white/45"
                    >
                      ⏳ {timeUntilNext}s
                    </motion.button>
                  ) : (
                    stageActionCoinAmounts.map((amount) => (
                      <CoinButton
                        key={amount}
                        amount={amount}
                        onSend={handleSendCoins}
                        disabled={balance < amount}
                        compact
                      />
                    ))
                  )}
                </div>
                {giftRulesLine}
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={endLive}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/8 flex items-center justify-center shrink-0"
              >
                <PhoneOff size={16} className="text-white/30" />
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-stretch justify-around gap-2">
            {isLive && (
              <div className="flex justify-center">
                <RaiseHandButton
                  myRequest={myRequest}
                  canJoinStage={canJoinStage}
                  isOnStage={isOnStage}
                  onRaiseHand={() => void raiseHand()}
                  onCancelRequest={() => void cancelRequest()}
                />
              </div>
            )}
            <div className="flex items-start justify-around gap-2">
              {isOnStage ? (
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={participantToggleMic}
                    disabled={!joined}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                      micMuted ? 'bg-red-900/40 border border-red-700/40' : 'bg-white/8 border border-white/8'
                    }`}
                  >
                    {micMuted ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} className="text-white/70" />}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={participantToggleCam}
                    disabled={!joined}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                      camOff ? 'bg-red-900/40 border border-red-700/40' : 'bg-white/8 border border-white/8'
                    }`}
                  >
                    {camOff ? <VideoOff size={16} className="text-red-400" /> : <Video size={16} className="text-white/70" />}
                  </motion.button>
                </div>
              ) : null}
              <div className="flex flex-1 flex-col items-center gap-0.5 min-w-0">
                <div className="flex items-center justify-center gap-1.5">
                  {timeUntilNext > 0 ? (
                    <motion.button
                      type="button"
                      disabled
                      className="flex h-14 w-14 min-h-[56px] min-w-[56px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/8 bg-white/5 text-xs font-semibold text-white/45"
                    >
                      ⏳ {timeUntilNext}s
                    </motion.button>
                  ) : (
                    stageActionCoinAmounts.map((amount) => (
                      <CoinButton
                        key={amount}
                        amount={amount}
                        onSend={handleSendCoins}
                        disabled={balance < amount}
                      />
                    ))
                  )}
                </div>
                {giftRulesLine}
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={endLive}
                className="mt-0.5 w-12 h-12 shrink-0 rounded-full bg-white/5 border border-white/8 flex items-center justify-center"
              >
                <PhoneOff size={17} className="text-white/30" />
              </motion.button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showWallet && isDomina && (
          <WalletOverlay
            profileId={profile.id}
            sessionId={session.id}
            onClose={() => setShowWallet(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDuo && (
          <DuoInviteModal
            sessionId={session.id}
            sessionTitle={session.title}
            dominaDisplayName={domina?.username ?? 'Domina'}
            dominaId={profile.id}
            soumisIdsInLive={soumisIdsInLive}
            sendDuoRequest={sendDuoRequest}
            onClose={() => setShowDuo(false)}
            onInvited={(username, mode, link) => {
              setDuoUsername(username);
              setShowDuo(false);
              if (mode === 'link' && link) {
                setInviteLink(link);
                setShowInvite(true);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
