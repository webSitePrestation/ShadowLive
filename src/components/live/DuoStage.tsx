'use client';

import { motion } from 'framer-motion';
import VideoStage from './VideoStage';
import type { ICameraVideoTrack } from '@/lib/agora/client';
import type { DuoUser } from '@/hooks/useDuoStream';
import { Crown, Loader2 } from 'lucide-react';

interface Props {
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: DuoUser[];
  isDomina: boolean;
  dominaName: string;
  soumisName?: string;
  /** Split vertical : duo confirmé + Agora prêt (vidéo distante peut arriver après) */
  isDuoMode: boolean;
}

function CameraConnectingBlock({ label }: { label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#08080a] gap-3 px-4">
      <Loader2 className="w-9 h-9 text-yellow-600/75 animate-spin" strokeWidth={2} />
      <p className="text-white/40 text-xs text-center">Connexion caméra...</p>
      {label ? (
        <p className="text-white/30 text-[11px] font-medium text-center">{label}</p>
      ) : null}
    </div>
  );
}

export default function DuoStage({
  localVideoTrack,
  remoteUsers,
  isDomina,
  dominaName,
  soumisName,
  isDuoMode,
}: Props) {
  const remoteVideoTrack = remoteUsers[0]?.videoTrack;

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

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* Split vertical — Domina en haut, Soumis en bas */}
      <div className="flex-1 relative border-b border-white/10">
        {isDomina && localVideoTrack ? (
          <VideoStage track={localVideoTrack} className="w-full h-full" mirror />
        ) : remoteVideoTrack ? (
          <VideoStage track={remoteVideoTrack} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#0a0808] px-4">
            <Crown size={32} className="text-red-700/30" />
            <p className="text-white/30 text-xs text-center">{dominaName}</p>
          </div>
        )}
        <div className="absolute bottom-2 left-3">
          <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
            <Crown size={9} className="text-yellow-600/50" />
            <span className="text-white/60 text-xs">{dominaName}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {isDomina ? (
          remoteVideoTrack ? (
            <motion.div
              key="domina-remote-soumis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="w-full h-full"
            >
              <VideoStage track={remoteVideoTrack} className="w-full h-full" />
            </motion.div>
          ) : (
            <CameraConnectingBlock label={soumisName ?? 'Soumis'} />
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
          <CameraConnectingBlock label={soumisName ?? 'Toi'} />
        )}
        <div className="absolute bottom-2 left-3">
          <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span className="text-white/60 text-xs">{soumisName ?? 'Soumis'}</span>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px bg-gradient-to-r from-transparent via-red-800/40 to-transparent pointer-events-none" />
    </div>
  );
}
