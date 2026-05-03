'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFollow } from '@/hooks/useFollow';

interface Props {
  followerId: string;
  followingId: string;
  /** Affiche le nombre d’abonnés sous le bouton (live soumis) */
  showCountBelow?: boolean;
}

export default function FollowButton({ followerId, followingId, showCountBelow }: Props) {
  const { isFollowing, followersCount, toggleFollow, loading } = useFollow(followerId, followingId);
  const [heartBurst, setHeartBurst] = useState(false);

  const handleClick = async () => {
    const wasFollowing = isFollowing;
    await toggleFollow();
    if (!wasFollowing) {
      setHeartBurst(true);
      window.setTimeout(() => setHeartBurst(false), 900);
    }
  };

  return (
    <div className="relative flex flex-col items-end pointer-events-auto">
      <AnimatePresence>
        {heartBurst && (
          <motion.span
            key="burst"
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -48, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -top-1 right-2 text-2xl pointer-events-none z-10"
            aria-hidden
          >
            ❤️
          </motion.span>
        )}
      </AnimatePresence>

      <motion.button
        suppressHydrationWarning
        type="button"
        whileTap={{ scale: 0.9 }}
        disabled={Boolean(loading)}
        aria-busy={loading}
        onClick={() => void handleClick()}
        className={
          isFollowing
            ? 'px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-500/50 bg-amber-950/40 text-amber-200 shadow-[0_0_12px_rgba(234,179,8,0.15)] disabled:opacity-50'
            : 'px-3 py-1.5 rounded-full text-xs font-semibold border border-white/12 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-50'
        }
      >
        {isFollowing ? '❤️ Abonné' : '🤍 Suivre'}
      </motion.button>

      {showCountBelow && (
        <p className="text-[10px] text-white/50 tabular-nums mt-1 text-right">
          ❤️ {followersCount.toLocaleString()} abonné{followersCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
