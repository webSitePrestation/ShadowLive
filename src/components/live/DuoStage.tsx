'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import VideoStage from './VideoStage';
import Avatar from '@/components/ui/Avatar';
import type { ICameraVideoTrack } from '@/lib/agora/client';
import type { DuoUser } from '@/hooks/useDuoStream';
import { Crown, Loader2 } from 'lucide-react';

interface Props {
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: DuoUser[];
  isDomina: boolean;
  dominaName: string;
  soumisName?: string;
  dominaAvatarUrl?: string | null;
  guestAvatarUrl?: string | null;
  /** Split vertical dès que le duo est actif (guest en session) */
  isDuoMode: boolean;
  /** Agora a rejoint le canal — avant ça, placeholders + bandeau « Liaison vidéo » */
  agoraJoined?: boolean;
  /** Soumis sans piste locale : activer la caméra (publier une piste Agora) */
  onRequestCam?: () => void | Promise<void>;
}

function PlaceholderCamInactive({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4 bg-[#0a0808]">
      <Avatar username={name} avatarUrl={avatarUrl ?? undefined} size="lg" />
      <p className="text-white/70 text-sm font-medium text-center">{name}</p>
      <p className="text-white/45 text-xs text-center">📷 Caméra inactive</p>
    </div>
  );
}

function PlaceholderConnecting({
  name,
  avatarUrl,
  extra,
}: {
  name: string;
  avatarUrl?: string | null;
  extra?: ReactNode;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4 bg-[#08080a]">
      <Avatar username={name} avatarUrl={avatarUrl ?? undefined} size="lg" />
      <p className="text-white/70 text-sm font-medium text-center">{name}</p>
      <Loader2 className="w-8 h-8 text-amber-500/80 animate-spin" strokeWidth={2} />
      <p className="text-white/40 text-xs text-center">Connexion…</p>
      {extra}
    </div>
  );
}

export default function DuoStage({
  localVideoTrack,
  remoteUsers,
  isDomina,
  dominaName,
  soumisName,
  dominaAvatarUrl,
  guestAvatarUrl,
  isDuoMode,
  agoraJoined = true,
  onRequestCam,
}: Props) {
  const remoteVideoTrack = remoteUsers[0]?.videoTrack;
  const bottomName = soumisName ?? 'Invité';

  if (!isDuoMode) {
    return (
      <div className="w-full h-full relative">
        {isDomina && localVideoTrack ? (
          <VideoStage track={localVideoTrack} className="w-full h-full" mirror />
        ) : remoteVideoTrack ? (
          <VideoStage track={remoteVideoTrack} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#080808] px-6">
            <Crown size={48} className="text-red-700/30" />
            <p className="text-white/25 text-xs text-center">{dominaName}</p>
          </div>
        )}

        <div className="absolute bottom-4 left-4">
          <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
            <Crown size={10} className="text-yellow-600/60" />
            <span className="text-white/70 text-xs">{dominaName}</span>
          </div>
        </div>
      </div>
    );
  }

  const topPane = isDomina ? (
    localVideoTrack ? (
      <VideoStage track={localVideoTrack} className="w-full h-full" mirror />
    ) : (
      <PlaceholderCamInactive name={dominaName} avatarUrl={dominaAvatarUrl} />
    )
  ) : remoteVideoTrack ? (
    <VideoStage track={remoteVideoTrack} className="w-full h-full" />
  ) : (
    <PlaceholderCamInactive name={dominaName} avatarUrl={dominaAvatarUrl} />
  );

  const bottomPane = isDomina ? (
    remoteVideoTrack ? (
      <motion.div
        key="domina-remote-guest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full h-full"
      >
        <VideoStage track={remoteVideoTrack} className="w-full h-full" />
      </motion.div>
    ) : (
      <PlaceholderConnecting name={bottomName} avatarUrl={guestAvatarUrl} />
    )
  ) : localVideoTrack ? (
    <motion.div
      key="soumis-local"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full h-full"
    >
      <VideoStage track={localVideoTrack} className="w-full h-full" mirror />
    </motion.div>
  ) : (
    <PlaceholderConnecting
      name={bottomName}
      avatarUrl={guestAvatarUrl}
      extra={
        onRequestCam ? (
          <button
            type="button"
            onClick={() => void onRequestCam()}
            className="mt-1 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600/25 text-amber-200 border border-amber-500/40 hover:bg-amber-600/35 transition-colors"
          >
            Activer ma caméra
          </button>
        ) : null
      }
    />
  );

  return (
    <div className="w-full h-full flex flex-col relative">
      {isDuoMode && !agoraJoined && (
        <div className="absolute top-3 inset-x-0 z-30 flex justify-center pointer-events-none">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-yellow-500/90 bg-black/75 px-3 py-1 rounded-full border border-yellow-700/40">
            Liaison vidéo en cours…
          </span>
        </div>
      )}

      <div className="flex-1 relative min-h-0">
        {topPane}
        <div className="absolute bottom-2 left-3 z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
            <Crown size={9} className="text-yellow-600/50" />
            <span className="text-white/60 text-xs">{dominaName}</span>
          </div>
        </div>
      </div>

      <div
        className="h-1.5 shrink-0 w-full bg-gradient-to-r from-red-900 via-amber-500 to-red-900 shadow-[0_0_10px_rgba(251,191,36,0.45)] z-[15]"
        aria-hidden
      />

      <div className="flex-1 relative min-h-0">
        {bottomPane}
        <div className="absolute bottom-2 left-3 z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span className="text-white/60 text-xs">{bottomName}</span>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center gap-1 pointer-events-none">
        <span className="text-[9px] font-black uppercase tracking-[0.28em] text-yellow-500/95 bg-black/85 px-2.5 py-1 rounded-md border border-yellow-600/45 shadow-lg">
          Écran partagé · Duo
        </span>
      </div>
    </div>
  );
}
