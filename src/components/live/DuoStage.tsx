'use client';

import { motion, AnimatePresence } from 'framer-motion';
import VideoStage from './VideoStage';
import type { ICameraVideoTrack, IRemoteVideoTrack } from '@/lib/agora/client';
import type { DuoUser } from '@/hooks/useDuoStream';
import { Crown, User } from 'lucide-react';

interface Props {
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: DuoUser[];
  isDomina: boolean;
  dominaName: string;
  soumisName?: string;
  isDuoMode: boolean;
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
  const hasDuo = isDuoMode && remoteVideoTrack;

  if (!isDuoMode || !hasDuo) {
    return (
      <div className="w-full h-full relative">
        {isDomina && localVideoTrack ? (
          <VideoStage track={localVideoTrack} className="w-full h-full" mirror />
        ) : remoteVideoTrack ? (
          <VideoStage track={remoteVideoTrack} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#080808]">
            <Crown size={48} className="text-red-700/30" />
          </div>
        )}

        {/* Nom Domina */}
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
        ) : remoteUsers[1]?.videoTrack ? (
          <VideoStage track={remoteUsers[1].videoTrack} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#0a0808]">
            <Crown size={32} className="text-red-700/30" />
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
            <VideoStage track={remoteVideoTrack} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#08080a]">
              <div className="text-center space-y-2">
                <User size={32} className="mx-auto text-white/10" />
                <p className="text-white/20 text-xs">En attente du soumis...</p>
              </div>
            </div>
          )
        ) : (
          localVideoTrack ? (
            <VideoStage track={localVideoTrack} className="w-full h-full" mirror />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#08080a]">
              <User size={32} className="text-white/10" />
            </div>
          )
        )}
        <div className="absolute bottom-2 left-3">
          <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span className="text-white/60 text-xs">{soumisName ?? 'Soumis'}</span>
          </div>
        </div>
      </div>

      {/* Séparateur central */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px bg-gradient-to-r from-transparent via-red-800/40 to-transparent pointer-events-none" />
    </div>
  );
}
