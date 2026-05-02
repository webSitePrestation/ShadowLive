'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Share2, Crown, MessageCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLiveStream } from '@/hooks/useLiveStream';
import { useChat } from '@/hooks/useChat';
import { useCoins } from '@/hooks/useCoins';
import { useViewerCount } from '@/hooks/useViewerCount';
import VideoStage from '@/components/live/VideoStage';
import ChatPanel from '@/components/live/ChatPanel';
import CoinButton from '@/components/live/CoinButton';
import CoinRain from '@/components/live/CoinRain';
import WalletOverlay from '@/components/live/WalletOverlay';
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
  const viewerCount = useViewerCount(session.id, session.viewer_count, isLive);
  const [starting, setStarting] = useState(false);
  const [coinRainTrigger, setCoinRainTrigger] = useState(0);
  const [lastCoinAmount, setLastCoinAmount] = useState(0);
  const [inviteLink, setInviteLink] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [agoraReady, setAgoraReady] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  const {
    localVideoTrack, remoteUsers, joined,
    error: agoraError, micMuted, camOff,
    toggleMic, toggleCam, leave,
  } = useLiveStream({
    channelName: session.agora_channel,
    uid: uidRef.current,
    role: isDomina ? 'host' : 'audience',
    enabled: agoraReady,
  });

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

  const endLive = useCallback(async () => {
    await leave();
    if (isDomina) {
      await supabase
        .from('live_sessions')
        .update({ status: 'ENDED', ended_at: new Date().toISOString() })
        .eq('id', session.id);
    }
    router.push('/dashboard');
  }, [leave, isDomina, session.id, router]);

  const generateInvite = useCallback(async () => {
    const { data } = await supabase
      .from('access_tokens')
      .insert({ session_id: session.id, created_by: profile.id, role: 'SOUMIS' })
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
      <CoinRain trigger={coinRainTrigger} amount={lastCoinAmount} />

      {/* Video */}
      <div className="relative flex-1 overflow-hidden">
        {isDomina && localVideoTrack ? (
          <VideoStage track={localVideoTrack} className="w-full h-full" mirror />
        ) : remoteUsers[0]?.videoTrack ? (
          <VideoStage track={remoteUsers[0].videoTrack} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#080808]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-20 h-20 rounded-full bg-red-900/20 border border-red-800/20 flex items-center justify-center mx-auto">
                <Crown size={36} className="text-red-700/60" />
              </div>
              <p className="text-white/20 text-sm tracking-wide">
                {isLive ? joined ? 'Caméra non disponible' : 'Connexion...' : 'Live non démarré'}
              </p>
            </motion.div>
          </div>
        )}

        {/* Gradients */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {isLive ? (
              <Badge variant="live" className="pulse-live">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="ghost">OFFLINE</Badge>
            )}
            <span className="text-white/40 text-xs flex items-center gap-1">
              <Users size={10} />
              {viewerCount}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isDomina && isLive && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={generateInvite}
                className="w-9 h-9 rounded-full glass flex items-center justify-center text-white/50 hover:text-white transition-colors"
              >
                <Share2 size={16} />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowChat(s => !s)}
              className="w-9 h-9 rounded-full glass flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
              <MessageCircle size={16} />
            </motion.button>
          </div>
        </div>

        {/* Domina name overlay */}
        {domina && isLive && (
          <div className="absolute bottom-28 left-4 z-10">
            <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white/80 text-xs font-medium">{domina.username}</span>
            </div>
          </div>
        )}

        {/* Invite modal */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute inset-x-4 top-16 z-40 surface-luxury rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-yellow-500/70 text-xs uppercase tracking-widest">Lien copié ✓</p>
                <button onClick={() => setShowInvite(false)} className="text-white/30 hover:text-white/60">
                  <X size={16} />
                </button>
              </div>
              <p className="text-white/60 text-xs font-mono break-all leading-relaxed">{inviteLink}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat overlay */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="absolute bottom-20 left-0 right-0 h-52 z-10"
            >
              <ChatPanel messages={messages} onSend={sendMessage} profile={profile} />
            </motion.div>
          )}
        </AnimatePresence>

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
                  micMuted
                    ? 'bg-red-900/40 border border-red-700/40'
                    : 'bg-white/8 border border-white/8'
                }`}
              >
                {micMuted
                  ? <MicOff size={19} className="text-red-400" />
                  : <Mic size={19} className="text-white/70" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleCam}
                disabled={!joined}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-20 ${
                  camOff
                    ? 'bg-red-900/40 border border-red-700/40'
                    : 'bg-white/8 border border-white/8'
                }`}
              >
                {camOff
                  ? <VideoOff size={19} className="text-red-400" />
                  : <Video size={19} className="text-white/70" />}
              </motion.button>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowWallet(w => !w)}
              className="w-12 h-12 rounded-full glass border border-yellow-700/20 flex items-center justify-center text-yellow-600/60 hover:text-yellow-500 transition-colors"
            >
              <span className="text-lg">🪙</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={endLive}
              className="w-12 h-12 rounded-full bg-red-700 hover:bg-red-600 glow-red-sm flex items-center justify-center transition-all"
            >
              <PhoneOff size={19} className="text-white" />
            </motion.button>
          </div>
        ) : (
          <div className="flex items-center justify-around gap-2">
            {[10, 50, 100, 500].map(amount => (
              <CoinButton key={amount} amount={amount} onSend={handleSendCoins} disabled={balance < amount} />
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
      <AnimatePresence>
        {showWallet && isDomina && (
          <WalletOverlay
            profileId={profile.id}
            sessionId={session.id}
            onClose={() => setShowWallet(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
