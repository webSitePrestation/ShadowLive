'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserX, X } from 'lucide-react';

interface Props {
  userId: string;
  username: string;
  onBan: (userId: string) => void | Promise<void>;
  /** Classe pour le bouton icône (ex. taille) */
  className?: string;
}

export default function BanButton({ userId, username, onBan, className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onBan(userId);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        title="Bannir du live"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          'p-1 rounded-md text-white/35 hover:text-red-400 hover:bg-red-950/40 transition-colors'
        }
      >
        <UserX size={12} strokeWidth={2.5} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 flex items-end justify-center"
            onClick={() => !busy && setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg surface-luxury rounded-t-3xl p-5 pb-8 border-t border-red-900/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-bold text-sm">Bannir du live</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center text-white/40"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-white/70 text-sm leading-relaxed mb-6">
                Bannir <span className="font-semibold text-white">{username}</span> de ce live ?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/5 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirm()}
                  className="flex-1 py-3 rounded-xl bg-red-800 hover:bg-red-700 text-white text-sm font-bold border border-red-600/40 disabled:opacity-50 transition-colors"
                >
                  {busy ? '…' : 'Confirmer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
