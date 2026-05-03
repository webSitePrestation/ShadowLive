'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, MicOff, VideoOff, Mic, Video, ArrowDown, Ban } from 'lucide-react';
import VideoStage from './VideoStage';
import type { ICameraVideoTrack, IRemoteVideoTrack } from '@/lib/agora/client';
import type { UserRole } from '@/types';

interface Props {
  videoTrack: ICameraVideoTrack | IRemoteVideoTrack | null;
  name: string;
  role: UserRole;
  isMirror?: boolean;
  isMuted?: boolean;
  isCamOff?: boolean;
  isHost?: boolean;
  showControls?: boolean;
  controlsOpen?: boolean;
  onToggleControls?: () => void;
  onMute?: () => void;
  onHideCamera?: () => void;
  onRemove?: () => void;
  onKick?: () => void;
}

function roleBadge(role: UserRole) {
  if (role === 'ADMIN') return { icon: '👑', label: 'Admin' };
  if (role === 'DOMINA') return { icon: '⛓️', label: 'Domina' };
  return { icon: '🖤', label: 'Soumis' };
}

export default function ParticipantCell({
  videoTrack,
  name,
  role,
  isMirror = false,
  isMuted = false,
  isCamOff = false,
  isHost = false,
  showControls = false,
  controlsOpen = false,
  onToggleControls,
  onMute,
  onHideCamera,
  onRemove,
  onKick,
}: Props) {
  const shortName = useMemo(() => name?.trim() || 'Invité', [name]);
  const initial = shortName.charAt(0).toUpperCase();
  const rb = roleBadge(role);

  const onCellTap = () => {
    if (!showControls) return;
    onToggleControls?.();
  };

  return (
    <motion.div
      layout
      className="relative w-full h-full overflow-hidden rounded-2xl bg-black border border-white/10"
      onClick={onCellTap}
    >
      {showControls && (
        <div
          role="presentation"
          className="absolute top-2 left-2 z-[35] pointer-events-auto flex max-w-[min(100%,8.5rem)]"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Descendre cet intervenant de la scène"
            onClick={() => {
              onRemove?.();
            }}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-amber-500/45 bg-amber-950/90 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-100 shadow-lg shadow-black/40 touch-manipulation hover:bg-amber-900/90"
          >
            <ArrowDown size={13} />
            Descendre
          </button>
        </div>
      )}
      {videoTrack && !isCamOff ? (
        <VideoStage track={videoTrack} className="w-full h-full" mirror={isMirror} />
      ) : (
        <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-2 text-center px-2">
          <div className="w-14 h-14 rounded-full bg-white/10 text-white/80 flex items-center justify-center text-xl font-bold">
            {initial || '?'}
          </div>
          <p className="text-white/70 text-sm font-medium truncate max-w-full">{shortName}</p>
          <p className="text-white/45 text-xs">📷 Caméra inactive</p>
        </div>
      )}

      <div className="absolute bottom-2 left-2">
        <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1 border border-white/10">
          {role === 'DOMINA' ? (
            <Crown size={10} className="text-yellow-500/80" />
          ) : (
            <span className="text-[10px]">{rb.icon}</span>
          )}
          <span className="text-white/80 text-[11px] max-w-[8rem] truncate">{shortName}</span>
          <span className="text-white/35 text-[10px]">{rb.label}</span>
          {isHost && <span className="text-[10px] text-emerald-300/80 ml-0.5">LIVE</span>}
        </div>
      </div>

      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        {isMuted && (
          <span className="w-6 h-6 rounded-full bg-red-900/70 border border-red-600/50 flex items-center justify-center">
            <MicOff size={12} className="text-red-300" />
          </span>
        )}
        {isCamOff && (
          <span className="w-6 h-6 rounded-full bg-red-900/70 border border-red-600/50 flex items-center justify-center">
            <VideoOff size={12} className="text-red-300" />
          </span>
        )}
      </div>

      <AnimatePresence>
        {showControls && controlsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-2 top-2 z-20 rounded-xl bg-black/85 border border-white/15 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onMute}
                className="h-9 rounded-lg bg-white/[0.04] border border-white/15 text-white/85 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-white/[0.08]"
              >
                <Mic size={13} />
                🔇 Couper micro
              </button>
              <button
                type="button"
                onClick={onHideCamera}
                className="h-9 rounded-lg bg-white/[0.04] border border-white/15 text-white/85 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-white/[0.08]"
              >
                <Video size={13} />
                📷 Couper caméra
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="h-9 rounded-lg bg-amber-900/35 border border-amber-600/45 text-amber-100 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-amber-900/45"
              >
                <ArrowDown size={13} />
                ⬇️ Descendre de scène
              </button>
              <button
                type="button"
                onClick={onKick}
                className="h-9 rounded-lg bg-red-900/40 border border-red-600/45 text-red-100 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-red-900/55"
              >
                <Ban size={13} />
                🚫 Expulser du live
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
