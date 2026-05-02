'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function DuoRequestToast({ visible, onAccept, onDecline }: Props) {
  useEffect(() => {
    if (!visible) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([50, 30, 50]);
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 140, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 340 }}
          className="fixed left-4 right-4 z-[45] max-w-lg mx-auto"
          style={{
            bottom: 'max(6.25rem, calc(env(safe-area-inset-bottom, 0px) + 5.5rem))',
          }}
        >
          <div
            className="rounded-2xl border border-yellow-700/35 p-4 shadow-2xl"
            style={{
              background:
                'linear-gradient(165deg, rgba(24,20,12,0.97) 0%, rgba(8,8,10,0.98) 100%)',
            }}
          >
            <div className="flex gap-3">
              <div className="relative shrink-0 w-12 h-12 rounded-full bg-red-950/80 border border-red-600/40 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex items-center justify-center"
                >
                  <Crown
                    size={22}
                    className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.55)] animate-pulse"
                  />
                </motion.div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-white font-semibold text-sm leading-snug">
                  La Domina t&apos;invite en Duo 🎬
                </p>
                <p className="text-white/45 text-xs mt-1">Active ta caméra pour rejoindre</p>
                <div className="flex gap-2 mt-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={onAccept}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide text-white bg-red-800 hover:bg-red-700 border border-red-600/40 glow-red-sm transition-colors"
                  >
                    Accepter
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={onDecline}
                    className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white/55 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    Refuser
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
