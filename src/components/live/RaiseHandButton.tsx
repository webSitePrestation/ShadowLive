'use client';

import { motion } from 'framer-motion';
import type { StageRequest } from '@/types';

interface Props {
  myRequest: StageRequest | null;
  canJoinStage: boolean;
  /** Déjà en `stage_participants` : ne pas afficher « monter » même si `myRequest` est en retard. */
  isOnStage?: boolean;
  onRaiseHand: () => void;
  onCancelRequest: () => void;
}

export default function RaiseHandButton({
  myRequest,
  canJoinStage,
  isOnStage = false,
  onRaiseHand,
  onCancelRequest,
}: Props) {
  const status = myRequest?.status ?? null;

  if (isOnStage) {
    return null;
  }

  if (!canJoinStage && status !== 'PENDING' && status !== 'ACCEPTED') {
    return (
      <button
        type="button"
        disabled
        className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/30 text-xs font-semibold"
      >
        Scène complète (4/4)
      </button>
    );
  }

  if (status === 'PENDING') {
    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={onCancelRequest}
        className="px-4 py-2 rounded-full border border-yellow-500/30 bg-yellow-900/10 text-yellow-300/70 text-xs font-semibold animate-pulse"
      >
        ⏳ En attente...
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      disabled={!canJoinStage}
      onClick={onRaiseHand}
      className="px-4 py-2 rounded-full glass border border-white/20 text-white/60 text-xs font-semibold disabled:opacity-40"
    >
      ✋ Monter sur scène
    </motion.button>
  );
}
