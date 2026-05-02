'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import Badge from '@/components/ui/Badge';
import type { LiveSession, Profile } from '@/types';

interface Props {
  session: LiveSession;
  profile: Profile;
  domina: Pick<Profile, 'id' | 'username' | 'avatar_url'> | null;
}

export default function LiveClient({ session, profile, domina }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isDomina = profile.id === session.domina_id;
  const uidRef = useRef<number>(Math.floor(Math.random() * 100000));

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

  const {
    pendingRequest,
    acceptRequest,
    declineRequest,
    sendDuoRequest,
    dominaAcceptedSoumisId,
    clearDominaAccepted,
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
    toggleMic, toggleCam, leave,
  } = useDuoStream({
    channelName: session.agora_channel,
    uid: uidRef.current,
    role: agoraRole,
    enabled: agoraReady,
  });

  const isDuoMode = Boolean(guestSoumisId) && joined && (isDomina || isDuoGuest);

  const { invite: duoInviteToast, dismissInvite: dismissDuoInviteToast } =
    useInviteNotification(profile.id);

  const viewerCount = useViewerCount(session.id, session.viewer_count, isLive);
  const { messages, sendMessage } = useChat(session.id, profile);
  const { sendCoins, balance } = useCoins(session.id, profile, session.domina_id);

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
  }, [starting, session.id]);

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

  useEffect(() => {
    if (!isDomina || !dominaAcceptedSoumisId) return;
    const sid = dominaAcceptedSoumisId;
    clearDominaAccepted();
    void supabase
      .from('profiles')
      .select('username')
      .eq('id', sid)
      .single()
      .then(({ data }) => {
        setDuoDominaToastName(data?.username ?? 'Soumis');
      });
  }, [isDomina, dominaAcceptedSoumisId, clearDominaAccepted]);

  useEffect(() => {
    if (!duoDominaToastName || !isDomina) return;
    const t = window.setTimeout(() => setDuoDominaToastName(null), 3000);
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
          isDuoMode={isDuoMode}
        />

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
            {guestSoumisId && (
              <Badge variant="gold">⚡ DUO</Badge>
            )}
            {!isDomina && isDuoGuest && localVideoTrack && !camOff && (
              <Badge variant="gold" className="border border-yellow-500/40 bg-yellow-950/40">
                🎬 EN DUO
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
              <ChatPanel messages={messages} onSend={sendMessage} profile={profile} />
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
                Ta caméra et ton micro sont partagés avec {domina?.username ?? 'la Domina'}.
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
          {guestSoumisId && isDomina && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-36 left-4 right-4 z-20 surface-dark rounded-xl px-3 py-2 border border-yellow-700/20"
            >
              <p className="text-yellow-500/80 text-[10px] uppercase tracking-widest">Soumis en duo</p>
              <p className="text-white text-sm font-medium">{duoUsername || 'Connecté'}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {duoDominaToastName && isDomina && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="fixed top-4 inset-x-4 z-[55] max-w-lg mx-auto rounded-2xl px-4 py-3 border border-yellow-500/45 shadow-xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(28,24,8,0.98) 0%, rgba(6,6,8,0.99) 55%, rgba(12,10,6,0.98) 100%)',
              }}
            >
              <p className="text-yellow-200/95 text-sm font-semibold text-center tracking-tight">
                ⚡ {duoDominaToastName} a rejoint le Duo
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <DuoRequestToast
          visible={Boolean(!isDomina && pendingRequest && isLive)}
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
        ) : isDuoGuest ? (
          <div className="flex items-center justify-between gap-1.5 min-h-[52px]">
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
            <div className="flex items-center justify-center gap-0.5 flex-1 min-w-0 overflow-x-auto px-0.5">
              {[10, 50, 100, 500].map(amount => (
                <CoinButton
                  key={amount}
                  amount={amount}
                  onSend={handleSendCoins}
                  disabled={balance < amount}
                  compact
                />
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={endLive}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/8 flex items-center justify-center shrink-0"
            >
              <PhoneOff size={16} className="text-white/30" />
            </motion.button>
          </div>
        ) : (
          <div className="flex items-center justify-around gap-2">
            {[10, 50, 100, 500].map(amount => (
              <CoinButton
                key={amount}
                amount={amount}
                onSend={handleSendCoins}
                disabled={balance < amount}
              />
            ))}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={endLive}
              className="w-12 h-12 rounded-full bg-white/5 border border-white/8 flex items-center justify-center"
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
