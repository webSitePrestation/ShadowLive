'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Users, Share2, MessageCircle, UserPlus, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { accessTokenExpiresAtIso } from '@/lib/access-token';
import { useDuoStream } from '@/hooks/useDuoStream';
import { useChat } from '@/hooks/useChat';
import { useCoins } from '@/hooks/useCoins';
import { useViewerCount } from '@/hooks/useViewerCount';
import DuoStage from '@/components/live/DuoStage';
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
import { profileIdToAgoraUid } from '@/lib/profile-agora-uid';
import Badge from '@/components/ui/Badge';
import FollowButton from '@/components/live/FollowButton';
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
  const [soumisIdsInLive, setSoumisIdsInLive] = useState<string[]>([]);
  const [duoDominaToastName, setDuoDominaToastName] = useState<string | null>(null);
  const [showDuoActivatedOverlay, setShowDuoActivatedOverlay] = useState(false);
  const prevGuestForDuoOverlayRef = useRef<string | null>(session.guest_soumis_id ?? null);

  const {
    pendingDuoInvite,
    acceptRequest,
    declineRequest,
    sendDuoRequest,
  } = useDuoRequest({
    sessionId: session.id,
    profileId: profile.id,
    isDomina,
  });

  const isDuoGuest = Boolean(guestSoumisId && profile.id === guestSoumisId);
  const agoraRole = isDomina || isDuoGuest ? 'host' : 'audience';

  const {
    localVideoTrack, remoteUsers, joined,
    error: agoraError, micMuted, camOff,
    toggleMic, toggleCam, tryPublishVideo, kickRemoteUid, leave,
  } = useDuoStream({
    channelName: session.agora_channel,
    uid: uidRef.current,
    role: agoraRole,
    enabled: agoraReady,
  });

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

  const handleAcceptDuoRequest = useCallback(async () => {
    const res = await acceptRequest();
    if (res && 'error' in res && res.error) {
      alert(res.error);
      return;
    }
    setAgoraReady(true);
    setShowDuoBanner(true);
  }, [acceptRequest]);

  const endLive = useCallback(async () => {
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
  }, [leave, isDomina, session.id, router]);

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

  const liveBanRedirectRef = useRef(false);

  useEffect(() => {
    if (!isDomina || !joined || bannedIds.length === 0) return;
    for (const bid of bannedIds) {
      void kickRemoteUid(profileIdToAgoraUid(bid));
    }
  }, [isDomina, joined, bannedIds, kickRemoteUid]);

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

      {/* Video */}
      <div className="relative flex-1 overflow-hidden">
        <DuoStage
          localVideoTrack={localVideoTrack}
          remoteUsers={remoteUsers}
          isDomina={isDomina}
          dominaName={domina?.username ?? 'Domina'}
          soumisName={
            isDomina
              ? duoUsername || undefined
              : isDuoGuest
                ? profile.username
                : undefined
          }
          dominaAvatarUrl={domina?.avatar_url}
          guestAvatarUrl={isDuoGuest ? profile.avatar_url : undefined}
          isDuoMode={isDuoMode}
          agoraJoined={joined}
          onRequestCam={isDuoGuest ? () => void tryPublishVideo() : undefined}
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

        {/* Header */}
        <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {isLive ? (
              <Badge variant="live">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="ghost">OFFLINE</Badge>
            )}
            <span className="text-white/40 text-xs flex items-center gap-1">
              <Users size={10} />
              {viewerCount}
            </span>
            {isDuoMode && (
              <Badge
                variant="gold"
                className="animate-pulse border border-amber-400/60 bg-gradient-to-r from-amber-950/90 to-yellow-900/80 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.45)] font-bold tracking-wide"
              >
                ⚡ DUO ACTIF
              </Badge>
            )}
            {isDuoGuest && localVideoTrack && !camOff && (
              <Badge variant="ghost" className="text-[10px] border border-white/15 text-white/50">
                🎬 Caméra
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isDomina && isLive && (
              <>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={generateInvite}
                  className="w-9 h-9 rounded-full glass flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                  <Share2 size={15} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowDuo(true)}
                  className="w-9 h-9 rounded-full glass flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                  <UserPlus size={15} />
                </motion.button>
              </>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowChat(s => !s)}
              className="w-9 h-9 rounded-full glass flex items-center justify-center text-white/50 hover:text-white transition-colors"
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
          onDecline={() => void declineRequest()}
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
        <AnimatePresence>
          {agoraError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-20 inset-x-4 bg-red-900/80 border border-red-700/30 rounded-xl p-3 text-red-200 text-sm text-center z-50 glass"
            >
              {agoraError}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      <div className="glass border-t border-white/5 px-4 py-3 z-10">
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
            {isDuoMode && (
              <p className="text-center text-[10px] text-amber-400/95 font-semibold tracking-wide">
                🎬 Tu es en DUO
              </p>
            )}
            <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleMic}
                disabled={!joined}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                  micMuted ? 'bg-red-900/40 border border-red-700/40' : 'bg-white/8 border border-white/8'
                }`}
              >
                {micMuted ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} className="text-white/70" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleCam}
                disabled={!joined}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                  camOff ? 'bg-red-900/40 border border-red-700/40' : 'bg-white/8 border border-white/8'
                }`}
              >
                {camOff ? <VideoOff size={16} className="text-red-400" /> : <Video size={16} className="text-white/70" />}
              </motion.button>
            </div>
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
                  coinButtonAmounts.map((amount) => (
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
          <div className="flex items-start justify-around gap-2">
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
                  coinButtonAmounts.map((amount) => (
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
        )}
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
