'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Share2, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLiveStream } from '@/hooks/useLiveStream';
import { useChat } from '@/hooks/useChat';
import { useCoins } from '@/hooks/useCoins';
import VideoStage from '@/components/live/VideoStage';
import ChatPanel from '@/components/live/ChatPanel';
import CoinButton from '@/components/live/CoinButton';
import CoinRain from '@/components/live/CoinRain';
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

  // UID stable — jamais recalculé
  const uidRef = useRef<number>(Math.floor(Math.random() * 100000));

  const [isLive, setIsLive] = useState(session.status === 'LIVE');
  const [starting, setStarting] = useState(false);
  const [coinRainTrigger, setCoinRainTrigger] = useState(0);
  const [lastCoinAmount, setLastCoinAmount] = useState(0);
  const [viewerCount, setViewerCount] = useState(session.viewer_count);
  const [inviteLink, setInviteLink] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [agoraReady, setAgoraReady] = useState(false);

  const {
    localAudioTrack,
    localVideoTrack,
    remoteUsers,
    joined,
    error: agoraError,
    micMuted,
    camOff,
    toggleMic,
    toggleCam,
    leave,
  } = useLiveStream({
    channelName: session.agora_channel,
    uid: uidRef.current,
    role: isDomina ? 'host' : 'audience',
    enabled: agoraReady,
  });

  const { messages, sendMessage } = useChat(session.id, profile);
  const { sendCoins, balance } = useCoins(session.id, profile, session.domina_id);

  // Démarrer le live — Domina uniquement
  const startLive = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    console.log('[ShadowLive] Démarrage live:', session.id);

    const { data, error } = await supabase
      .from('live_sessions')
      .update({ status: 'LIVE', started_at: new Date().toISOString() })
      .eq('id', session.id)
      .select()
      .single();

    console.log('[ShadowLive] Update résultat:', { data, error });

    if (error) {
      console.error('[ShadowLive] Erreur startLive:', JSON.stringify(error, null, 2));
      alert(`Erreur démarrage: ${error.message}`);
      setStarting(false);
      return;
    }
    setIsLive(true);
    setAgoraReady(true);
    setStarting(false);
  }, [starting, session.id]);

  // Rejoindre automatiquement si déjà LIVE (audience)
  useEffect(() => {
    if (!isDomina && session.status === 'LIVE') {
      setAgoraReady(true);
    }
  }, [isDomina, session.status]);

  // Terminer le live
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

  // Générer un lien d'invitation
  const generateInvite = useCallback(async () => {
    const { data } = await supabase
      .from('access_tokens')
      .insert({
        session_id: session.id,
        created_by: profile.id,
        role: 'SOUMIS',
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

  // Envoi de pièces avec animation
  const handleSendCoins = useCallback(async (amount: number) => {
    const success = await sendCoins(amount);
    if (success) {
      setLastCoinAmount(amount);
      setCoinRainTrigger(t => t + 1);
      await sendMessage(`a envoyé ${amount} pièces 🪙`, 'COIN_GIFT', { amount });
    }
    return success;
  }, [sendCoins, sendMessage]);

  // Viewer count realtime
  useEffect(() => {
    const channel = supabase
      .channel(`session:${session.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_sessions',
        filter: `id=eq.${session.id}`,
      }, (payload) => {
        setViewerCount((payload.new as LiveSession).viewer_count);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      <CoinRain trigger={coinRainTrigger} amount={lastCoinAmount} />

      {/* Video Stage */}
      <div className="relative flex-1 overflow-hidden">
        {isDomina && localVideoTrack ? (
          <VideoStage track={localVideoTrack} className="w-full h-full" mirror />
        ) : remoteUsers[0]?.videoTrack ? (
          <VideoStage track={remoteUsers[0].videoTrack} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <div className="text-center space-y-3">
              <Crown size={48} className="mx-auto text-red-600/40" />
              <p className="text-white/30 text-sm">
                {isLive
                  ? joined
                    ? 'Caméra non disponible'
                    : 'Connexion en cours...'
                  : 'Live non démarré'}
              </p>
              {/* Debug info */}
              {isDomina && (
                <p className="text-white/20 text-xs">
                  isLive: {String(isLive)} | joined: {String(joined)} | ready: {String(agoraReady)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLive && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </motion.span>
            )}
            <span className="text-white/60 text-xs flex items-center gap-1">
              <Users size={11} />
              {viewerCount}
            </span>
          </div>
          {isDomina && isLive && (
            <button onClick={generateInvite} className="text-white/60 hover:text-white transition-colors">
              <Share2 size={20} />
            </button>
          )}
        </div>

        {/* Invite modal */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-x-4 top-16 bg-black/90 border border-white/10 rounded-2xl p-4 z-40"
            >
              <p className="text-white/50 text-xs mb-2 uppercase tracking-widest">Lien copié ✓</p>
              <p className="text-white text-xs font-mono break-all mb-3">{inviteLink}</p>
              <button onClick={() => setShowInvite(false)} className="text-red-500 text-sm hover:text-red-400">
                Fermer
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat */}
        <div className="absolute bottom-24 left-0 right-0 h-48 px-2">
          <ChatPanel messages={messages} onSend={sendMessage} profile={profile} />
        </div>

        {/* Bouton démarrer — Domina */}
        {isDomina && !isLive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <button
              onClick={startLive}
              disabled={starting}
              className="bg-red-700 hover:bg-red-600 active:scale-95 disabled:opacity-50 transition-all text-white font-bold text-lg px-10 py-4 rounded-2xl tracking-wide shadow-2xl"
            >
              {starting ? '⏳ Démarrage...' : '🔴 Démarrer le Live'}
            </button>
          </motion.div>
        )}

        {/* Erreur Agora */}
        {agoraError && (
          <div className="absolute top-20 inset-x-4 bg-red-900/80 border border-red-600/30 rounded-xl p-3 text-red-200 text-sm text-center z-50">
            {agoraError}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bg-black/95 border-t border-white/5 px-4 py-3">
        {isDomina ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={toggleMic}
                  disabled={!joined}
                  title={micMuted ? 'Activer le micro' : 'Couper le micro'}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-60 ${
                    micMuted ? 'bg-red-600/20 border border-red-600/40' : 'bg-white/10 border border-white/10'
                  }`}
                >
                  {micMuted ? <MicOff size={20} className="text-red-400" /> : <Mic size={20} className="text-white" />}
                </button>
                <span className="text-[10px] text-white/60">Micro</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={toggleCam}
                  disabled={!joined}
                  title={camOff ? 'Activer la camera' : 'Couper la camera'}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-60 ${
                    camOff ? 'bg-red-600/20 border border-red-600/40' : 'bg-white/10 border border-white/10'
                  }`}
                >
                  {camOff ? <VideoOff size={20} className="text-red-400" /> : <Video size={20} className="text-white" />}
                </button>
                <span className="text-[10px] text-white/60">Camera</span>
              </div>
            </div>
            <button
              onClick={endLive}
              className="w-12 h-12 rounded-full bg-red-700 hover:bg-red-600 flex items-center justify-center transition-all"
            >
              <PhoneOff size={20} className="text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-around">
            {[10, 50, 100, 500].map(amount => (
              <CoinButton key={amount} amount={amount} onSend={handleSendCoins} disabled={balance < amount} />
            ))}
            <button
              onClick={toggleMic}
              disabled={!localAudioTrack}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-30 ${
                micMuted ? 'bg-red-600/20 border border-red-600/40' : 'bg-white/10 border border-white/10'
              }`}
            >
              {micMuted ? <MicOff size={18} className="text-red-400" /> : <Mic size={18} className="text-white" />}
            </button>
            <button
              onClick={endLive}
              className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
            >
              <PhoneOff size={18} className="text-white/40" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
